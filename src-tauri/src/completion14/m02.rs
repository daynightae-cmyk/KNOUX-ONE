use crate::contracts::OperationResult;
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, UNIX_EPOCH},
};
use tauri::{AppHandle, Emitter, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

static SNAPSHOTS: Lazy<Mutex<HashMap<String, CleanupScanResult>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
static TOKENS: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupScanRequest {
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default = "default_item_limit")]
    pub max_items_per_category: usize,
}
fn default_item_limit() -> usize { 5_000 }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecuteRequest {
    pub scan_id: String,
    pub categories: Vec<String>,
    pub confirmation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupFileEvidence {
    pub path: String,
    pub root_path: String,
    pub size_bytes: u64,
    pub modified_at: String,
    pub modified_unix_ms: u128,
    pub safe_to_clean: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupCategorySummary {
    pub id: String,
    pub name_en: String,
    pub name_ar: String,
    pub file_count: u64,
    pub size_bytes: u64,
    pub requires_admin: bool,
    pub scan_only: bool,
    pub truncated: bool,
    pub items: Vec<CleanupFileEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupScanResult {
    pub scan_id: String,
    pub categories: Vec<CleanupCategorySummary>,
    pub total_files: u64,
    pub total_bytes: u64,
    pub cancelled: bool,
    pub scanned_at: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupFailureItem { pub path: String, pub reason: String }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupExecuteResult {
    pub scan_id: String,
    pub deleted_files: u64,
    pub deleted_bytes: u64,
    pub skipped_files: u64,
    pub failed_files: Vec<CleanupFailureItem>,
    pub cancelled: bool,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupProgress {
    pub operation_id: String,
    pub phase: String,
    pub category: Option<String>,
    pub files_processed: u64,
    pub bytes_processed: u64,
    pub current_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupCancelResult { pub target_operation_id: String, pub cancellation_requested: bool }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupHistoryEntry {
    pub operation_id: String,
    pub operation_type: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: String,
    pub file_count: u64,
    pub byte_count: u64,
    pub warnings: Vec<String>,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupHistoryResult { pub entries: Vec<CleanupHistoryEntry> }

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadQuarantineRecord {
    pub quarantine_id: String,
    pub original_path: String,
    pub quarantine_path: String,
    pub size_bytes: u64,
    pub hash: String,
    pub quarantined_at: String,
    pub status: String,
}

#[derive(Debug, Clone)]
enum Filter { Any, Thumbnail, Crash, Log, Installer }
#[derive(Debug, Clone)]
struct Target {
    id: String,
    name_en: String,
    name_ar: String,
    roots: Vec<PathBuf>,
    requires_admin: bool,
    quarantine: bool,
    min_age: Duration,
    filter: Filter,
}

fn result<T>(op_id:String, capability:&str, handler:&str, started_at:String, timer:Instant,
    status:&str, data:Option<T>, summary_en:String, summary_ar:String, warnings:Vec<String>,
    error_code:Option<String>, stderr:Option<String>, exit_code:Option<i32>) -> OperationResult<T> {
    OperationResult { operation_id:op_id, capability_id:capability.into(), handler_id:handler.into(),
        status:status.into(), started_at, completed_at:Some(Utc::now().to_rfc3339()),
        duration_ms:Some(timer.elapsed().as_millis() as u64), requires_restart:false, exit_code,
        stdout:None, stderr, summary_en, summary_ar, warnings, error_code, data }
}

fn local_app_data() -> Option<PathBuf> { env::var_os("LOCALAPPDATA").map(PathBuf::from) }
fn roaming_app_data() -> Option<PathBuf> { env::var_os("APPDATA").map(PathBuf::from) }
fn user_profile() -> Option<PathBuf> { env::var_os("USERPROFILE").map(PathBuf::from) }
fn windows_root() -> PathBuf { env::var_os("WINDIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")) }

fn browser_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(local) = local_app_data() {
        for (base, suffixes) in [
            (local.join("Google/Chrome/User Data"), vec!["Cache", "Code Cache", "GPUCache"]),
            (local.join("Microsoft/Edge/User Data"), vec!["Cache", "Code Cache", "GPUCache"]),
            (local.join("BraveSoftware/Brave-Browser/User Data"), vec!["Cache", "Code Cache", "GPUCache"]),
        ] {
            if let Ok(entries) = fs::read_dir(base) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|value| value.is_dir()).unwrap_or(false) {
                        let profile = entry.path();
                        for suffix in &suffixes { roots.push(profile.join(suffix)); }
                    }
                }
            }
        }
    }
    if let Some(roaming) = roaming_app_data() {
        let profiles = roaming.join("Mozilla/Firefox/Profiles");
        if let Ok(entries) = fs::read_dir(profiles) {
            for entry in entries.flatten() { roots.push(entry.path().join("cache2")); }
        }
    }
    roots
}

fn application_log_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(local) = local_app_data() {
        for fixed in [
            local.join("CrashDumps"),
            local.join("Microsoft/Windows/WER/ReportArchive"),
            local.join("Microsoft/Windows/WER/ReportQueue"),
            local.join("Temp"),
        ] { if fixed.exists() { roots.push(fixed); } }
        for entry in WalkDir::new(&local).min_depth(1).max_depth(4).follow_links(false).into_iter().filter_map(Result::ok) {
            if entry.file_type().is_dir() {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if matches!(name.as_str(), "logs" | "log" | "crashreports" | "reports") {
                    roots.push(entry.path().to_path_buf());
                    if roots.len() >= 200 { break; }
                }
            }
        }
    }
    roots.sort(); roots.dedup(); roots
}

fn targets(requested:&[String]) -> Vec<Target> {
    let ids = if requested.is_empty() { vec!["user_temp".into(),"browser_cache".into(),"thumbnail_cache".into()] } else { requested.to_vec() };
    ids.into_iter().filter_map(|id| {
        let ten_minutes = Duration::from_secs(600);
        match id.as_str() {
            "user_temp" => Some(Target{id, name_en:"Your temporary files".into(),name_ar:"ملفات حسابك المؤقتة".into(),roots:vec![env::temp_dir()],requires_admin:false,quarantine:false,min_age:ten_minutes,filter:Filter::Any}),
            "windows_temp" => Some(Target{id,name_en:"Windows temporary files".into(),name_ar:"ملفات ويندوز المؤقتة".into(),roots:vec![windows_root().join("Temp")],requires_admin:true,quarantine:false,min_age:ten_minutes,filter:Filter::Any}),
            "browser_cache" => Some(Target{id,name_en:"Browser temporary files".into(),name_ar:"ملفات المتصفحات المؤقتة".into(),roots:browser_roots(),requires_admin:false,quarantine:false,min_age:ten_minutes,filter:Filter::Any}),
            "thumbnail_cache" => Some(Target{id,name_en:"Image thumbnail files".into(),name_ar:"ملفات الصور المصغرة".into(),roots:local_app_data().map(|p|vec![p.join("Microsoft/Windows/Explorer")]).unwrap_or_default(),requires_admin:false,quarantine:false,min_age:ten_minutes,filter:Filter::Thumbnail}),
            "crash_dumps" => Some(Target{id,name_en:"Program crash reports".into(),name_ar:"تقارير انهيار البرامج".into(),roots:application_log_roots(),requires_admin:true,quarantine:false,min_age:ten_minutes,filter:Filter::Crash}),
            "application_logs" => Some(Target{id,name_en:"Old application logs".into(),name_ar:"سجلات التطبيقات القديمة".into(),roots:application_log_roots(),requires_admin:false,quarantine:false,min_age:Duration::from_secs(14*86400),filter:Filter::Log}),
            "old_downloads" => Some(Target{id,name_en:"Old installers in Downloads".into(),name_ar:"ملفات التثبيت القديمة في التنزيلات".into(),roots:user_profile().map(|p|vec![p.join("Downloads")]).unwrap_or_default(),requires_admin:false,quarantine:true,min_age:Duration::from_secs(30*86400),filter:Filter::Installer}),
            _ => None,
        }
    }).collect()
}

fn filter_match(path:&Path, filter:&Filter) -> bool {
    let name = path.file_name().and_then(|v|v.to_str()).unwrap_or_default().to_ascii_lowercase();
    let ext = path.extension().and_then(|v|v.to_str()).unwrap_or_default().to_ascii_lowercase();
    match filter {
        Filter::Any => true,
        Filter::Thumbnail => name.starts_with("thumbcache_") || name.starts_with("iconcache_") || ext=="db",
        Filter::Crash => matches!(ext.as_str(),"dmp"|"mdmp"|"wer"|"hdmp") || name.contains("crash"),
        Filter::Log => matches!(ext.as_str(),"log"|"etl"|"txt"|"dmp"|"wer") || name.ends_with(".log.1"),
        Filter::Installer => matches!(ext.as_str(),"exe"|"msi"|"msix"|"appx"|"appxbundle"|"zip"|"7z"|"rar"|"iso"),
    }
}

fn modified_ms(metadata:&fs::Metadata) -> Option<u128> {
    metadata.modified().ok()?.duration_since(UNIX_EPOCH).ok().map(|v|v.as_millis())
}
fn hash_file(path:&Path) -> Result<String,String> {
    let data=fs::read(path).map_err(|e|format!("hash_read_failed:{e}"))?;
    Ok(blake3::hash(&data).to_hex().to_string())
}
fn is_old_enough(metadata:&fs::Metadata, age:Duration)->bool {
    metadata.modified().ok().and_then(|v|v.elapsed().ok()).map(|v|v>=age).unwrap_or(false)
}

fn scan_target(app:&AppHandle, op_id:&str, target:&Target, limit:usize, token:&AtomicBool) -> CleanupCategorySummary {
    let mut items=Vec::new(); let mut count=0u64; let mut bytes=0u64; let mut truncated=false;
    let mut seen=HashSet::new();
    for root in &target.roots {
        let canonical_root=match dunce::canonicalize(root){Ok(v)=>v,Err(_)=>continue};
        for entry in WalkDir::new(&canonical_root).follow_links(false).into_iter().filter_map(Result::ok) {
            if token.load(Ordering::Relaxed){break;}
            if !entry.file_type().is_file() || entry.file_type().is_symlink(){continue;}
            let canonical=match dunce::canonicalize(entry.path()){Ok(v)=>v,Err(_)=>continue};
            if !canonical.starts_with(&canonical_root) || !seen.insert(canonical.clone()) {continue;}
            if !filter_match(&canonical,&target.filter){continue;}
            let metadata=match fs::symlink_metadata(&canonical){Ok(v)=>v,Err(_)=>continue};
            if metadata.file_type().is_symlink() || !is_old_enough(&metadata,target.min_age){continue;}
            if items.len()>=limit{truncated=true;break;}
            let size=metadata.len(); count=count.saturating_add(1); bytes=bytes.saturating_add(size);
            let modified=metadata.modified().ok().map(DateTime::<Utc>::from).unwrap_or_else(Utc::now);
            items.push(CleanupFileEvidence{path:canonical.to_string_lossy().to_string(),root_path:canonical_root.to_string_lossy().to_string(),size_bytes:size,modified_at:modified.to_rfc3339(),modified_unix_ms:modified_ms(&metadata).unwrap_or(0),safe_to_clean:true});
            if count.is_multiple_of(128){let _=app.emit("m02://progress",CleanupProgress{operation_id:op_id.into(),phase:"scanning".into(),category:Some(target.id.clone()),files_processed:count,bytes_processed:bytes,current_path:Some(canonical.to_string_lossy().to_string())});}
        }
    }
    CleanupCategorySummary{id:target.id.clone(),name_en:target.name_en.clone(),name_ar:target.name_ar.clone(),file_count:count,size_bytes:bytes,requires_admin:target.requires_admin,scan_only:false,truncated,items}
}

fn save_snapshot(scan:&CleanupScanResult){if let Ok(mut map)=SNAPSHOTS.lock(){map.insert(scan.scan_id.clone(),scan.clone());while map.len()>15{if let Some(key)=map.keys().next().cloned(){map.remove(&key);}else{break;}}}}
fn token(op_id:&str)->Arc<AtomicBool>{let value=Arc::new(AtomicBool::new(false));if let Ok(mut map)=TOKENS.lock(){map.insert(op_id.into(),value.clone());}value}
fn remove_token(op_id:&str){if let Ok(mut map)=TOKENS.lock(){map.remove(op_id);}}

fn history_path(app:&AppHandle)->Result<PathBuf,String>{let dir=app.path().app_data_dir().map_err(|e|format!("cleanup_app_data_failed:{e}"))?.join("cleanup");fs::create_dir_all(&dir).map_err(|e|format!("cleanup_history_dir_failed:{e}"))?;Ok(dir.join("history.json"))}
fn load_history(app:&AppHandle)->Vec<CleanupHistoryEntry>{history_path(app).ok().and_then(|p|fs::read(p).ok()).and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default()}
fn append_history(app:&AppHandle,entry:CleanupHistoryEntry){let mut entries=load_history(app);entries.insert(0,entry);entries.truncate(100);if let Ok(path)=history_path(app){if let Ok(payload)=serde_json::to_vec_pretty(&entries){let _=fs::write(path,payload);}}}

#[tauri::command]
pub async fn m02_cleanup_scan_complete(app:AppHandle,op_id:String,request:CleanupScanRequest)->Result<OperationResult<CleanupScanResult>,String>{
    let started_at=Utc::now().to_rfc3339();let timer=Instant::now();let control=token(&op_id);let worker_app=app.clone();let worker_op=op_id.clone();
    let execution=tauri::async_runtime::spawn_blocking(move||{let categories=targets(&request.categories);let mut summaries=Vec::new();for target in categories{if control.load(Ordering::Relaxed){break;}summaries.push(scan_target(&worker_app,&worker_op,&target,request.max_items_per_category.clamp(100,50_000),&control));}let total_files=summaries.iter().map(|v|v.file_count).sum();let total_bytes=summaries.iter().map(|v|v.size_bytes).sum();CleanupScanResult{scan_id:Uuid::new_v4().to_string(),categories:summaries,total_files,total_bytes,cancelled:control.load(Ordering::Relaxed),scanned_at:Utc::now().to_rfc3339(),warnings:Vec::new()}}).await.map_err(|e|format!("cleanup_scan_join_failed:{e}"))?;
    remove_token(&op_id);save_snapshot(&execution);append_history(&app,CleanupHistoryEntry{operation_id:op_id.clone(),operation_type:"scan".into(),status:if execution.cancelled{"cancelled".into()}else{"completed".into()},started_at:started_at.clone(),completed_at:Utc::now().to_rfc3339(),file_count:execution.total_files,byte_count:execution.total_bytes,warnings:execution.warnings.clone()});
    Ok(result(op_id,"m02_s01","m02.cleanup.scan",started_at,timer,if execution.cancelled{"cancelled"}else{"completed"},Some(execution.clone()),format!("Measured {} verified cleanup candidates.",execution.total_files),format!("تم قياس {} ملف مرشح للتنظيف مع أدلة حقيقية.",execution.total_files),execution.warnings.clone(),None,None,Some(0)))
}

#[derive(Debug,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
struct ElevatedManifest{allowed_roots:Vec<String>,items:Vec<CleanupFileEvidence>}
#[derive(Debug,Serialize,Deserialize,Default)]
#[serde(rename_all="camelCase")]
struct ElevatedResult{deleted_files:u64,deleted_bytes:u64,failed:Vec<CleanupFailureItem>}

fn is_elevated()->bool{
    #[cfg(target_os="windows")]
    {Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command","([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"]).output().map(|o|String::from_utf8_lossy(&o.stdout).trim().eq_ignore_ascii_case("true")).unwrap_or(false)}
    #[cfg(not(target_os="windows"))]{false}
}
fn ps_quote(value:&str)->String{value.replace('\'',"''")}
fn elevated_delete(app:&AppHandle,items:Vec<CleanupFileEvidence>)->Result<ElevatedResult,String>{
    if items.is_empty(){return Ok(ElevatedResult::default());}
    let dir=app.path().app_data_dir().map_err(|e|format!("cleanup_app_data_failed:{e}"))?.join("cleanup/elevated");fs::create_dir_all(&dir).map_err(|e|format!("elevated_dir_failed:{e}"))?;
    let id=Uuid::new_v4().to_string();let manifest_path=dir.join(format!("{id}.json"));let result_path=dir.join(format!("{id}.result.json"));let script_path=dir.join("verified-cleanup.ps1");
    let roots=items.iter().map(|i|i.root_path.clone()).collect::<HashSet<_>>().into_iter().collect();let manifest=ElevatedManifest{allowed_roots:roots,items};let payload=serde_json::to_vec_pretty(&manifest).map_err(|e|format!("elevated_manifest_serialize_failed:{e}"))?;let expected=hex::encode(Sha256::digest(&payload));fs::write(&manifest_path,&payload).map_err(|e|format!("elevated_manifest_write_failed:{e}"))?;
    let script=r#"param([string]$Manifest,[string]$ExpectedHash,[string]$Result)
$ErrorActionPreference='Stop'
$actual=(Get-FileHash -Algorithm SHA256 -LiteralPath $Manifest).Hash.ToLowerInvariant()
if($actual -ne $ExpectedHash.ToLowerInvariant()){throw 'manifest_hash_mismatch'}
$data=Get-Content -Raw -LiteralPath $Manifest|ConvertFrom-Json
$deleted=0L;$bytes=0L;$failed=@()
foreach($item in $data.items){try{$full=[IO.Path]::GetFullPath([string]$item.path);$allowed=$false;foreach($root in $data.allowedRoots){$r=[IO.Path]::GetFullPath([string]$root).TrimEnd('\\')+'\\';if($full.StartsWith($r,[StringComparison]::OrdinalIgnoreCase)){$allowed=$true;break}};if(-not $allowed){throw 'outside_allowed_root'};$file=Get-Item -LiteralPath $full -Force;if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'reparse_point_blocked'};if([uint64]$file.Length -ne [uint64]$item.sizeBytes){throw 'size_changed'};$ms=[DateTimeOffset]$file.LastWriteTimeUtc;$actualMs=$ms.ToUnixTimeMilliseconds();if([math]::Abs([double]$actualMs-[double]$item.modifiedUnixMs)-gt 2000){throw 'modified_time_changed'};Remove-Item -LiteralPath $full -Force -ErrorAction Stop;$deleted++;$bytes+=[uint64]$item.sizeBytes}catch{$failed+=@([pscustomobject]@{path=[string]$item.path;reason=$_.Exception.Message})}}
[pscustomobject]@{deletedFiles=$deleted;deletedBytes=$bytes;failed=$failed}|ConvertTo-Json -Depth 5|Set-Content -Encoding UTF8 -LiteralPath $Result
"#;fs::write(&script_path,script).map_err(|e|format!("elevated_script_write_failed:{e}"))?;
    #[cfg(target_os="windows")]
    {let command=format!("$a=@('-NoProfile','-ExecutionPolicy','Bypass','-File','{}','-Manifest','{}','-ExpectedHash','{}','-Result','{}');$p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $a -Wait -PassThru;exit $p.ExitCode",ps_quote(&script_path.to_string_lossy()),ps_quote(&manifest_path.to_string_lossy()),expected,ps_quote(&result_path.to_string_lossy()));let output=Command::new("powershell.exe").args(["-NoProfile","-NonInteractive","-Command",&command]).output().map_err(|e|format!("elevation_launch_failed:{e}"))?;if !output.status.success(){return Err(format!("elevation_failed:{}",String::from_utf8_lossy(&output.stderr)));}}
    #[cfg(not(target_os="windows"))]{return Err("unsupported_os".into());}
    let bytes=fs::read(&result_path).map_err(|e|format!("elevated_result_read_failed:{e}"))?;serde_json::from_slice(&bytes).map_err(|e|format!("elevated_result_parse_failed:{e}"))
}

fn quarantine_path(app:&AppHandle)->Result<PathBuf,String>{let dir=app.path().app_data_dir().map_err(|e|format!("cleanup_app_data_failed:{e}"))?.join("cleanup/download-quarantine");fs::create_dir_all(&dir).map_err(|e|format!("quarantine_dir_failed:{e}"))?;Ok(dir)}
fn quarantine_index(app:&AppHandle)->Result<PathBuf,String>{Ok(quarantine_path(app)?.join("index.json"))}
fn load_quarantine(app:&AppHandle)->Vec<DownloadQuarantineRecord>{quarantine_index(app).ok().and_then(|p|fs::read(p).ok()).and_then(|b|serde_json::from_slice(&b).ok()).unwrap_or_default()}
fn save_quarantine(app:&AppHandle,records:&[DownloadQuarantineRecord])->Result<(),String>{let p=quarantine_index(app)?;fs::write(p,serde_json::to_vec_pretty(records).map_err(|e|format!("quarantine_serialize_failed:{e}"))?).map_err(|e|format!("quarantine_write_failed:{e}"))}
fn quarantine_download(app:&AppHandle,item:&CleanupFileEvidence)->Result<DownloadQuarantineRecord,String>{let source=dunce::canonicalize(&item.path).map_err(|e|format!("quarantine_source_failed:{e}"))?;let root=dunce::canonicalize(&item.root_path).map_err(|e|format!("quarantine_root_failed:{e}"))?;if !source.starts_with(&root){return Err("quarantine_outside_root".into());}let metadata=fs::symlink_metadata(&source).map_err(|e|format!("quarantine_metadata_failed:{e}"))?;if metadata.file_type().is_symlink()||metadata.len()!=item.size_bytes||modified_ms(&metadata).unwrap_or(0).abs_diff(item.modified_unix_ms)>2000{return Err("quarantine_evidence_changed".into());}let id=Uuid::new_v4().to_string();let destination=quarantine_path(app)?.join(&id).join(source.file_name().unwrap_or_default());fs::create_dir_all(destination.parent().unwrap_or(Path::new("."))).map_err(|e|format!("quarantine_item_dir_failed:{e}"))?;let hash=hash_file(&source)?;fs::rename(&source,&destination).map_err(|e|format!("quarantine_move_failed:{e}"))?;Ok(DownloadQuarantineRecord{quarantine_id:id,original_path:source.to_string_lossy().to_string(),quarantine_path:destination.to_string_lossy().to_string(),size_bytes:item.size_bytes,hash,quarantined_at:Utc::now().to_rfc3339(),status:"quarantined".into()})}

#[tauri::command]
pub async fn m02_cleanup_execute_complete(app:AppHandle,op_id:String,request:CleanupExecuteRequest)->Result<OperationResult<CleanupExecuteResult>,String>{
    let started_at=Utc::now().to_rfc3339();let timer=Instant::now();if request.confirmation!="CLEAN"{return Ok(result(op_id,"m02_s01","m02.cleanup.execute",started_at,timer,"failed",None,"Typed confirmation CLEAN is required.".into(),"يجب كتابة CLEAN للتأكيد.".into(),Vec::new(),Some("cleanup_confirmation_required".into()),None,Some(1)));}
    let snapshot=SNAPSHOTS.lock().ok().and_then(|m|m.get(&request.scan_id).cloned());let Some(snapshot)=snapshot else{return Ok(result(op_id,"m02_s01","m02.cleanup.execute",started_at,timer,"failed",None,"The verified scan snapshot expired. Run a new scan.".into(),"انتهت صلاحية معاينة الفحص الموثقة. شغّل فحصًا جديدًا.".into(),Vec::new(),Some("cleanup_snapshot_missing".into()),None,Some(1)));};
    let selected=request.categories.into_iter().collect::<HashSet<_>>();let control=token(&op_id);let mut deleted=0u64;let mut bytes=0u64;let mut skipped=0u64;let mut failures=Vec::new();let mut elevated=Vec::new();let mut quarantine_records=load_quarantine(&app);
    for category in snapshot.categories.iter().filter(|c|selected.is_empty()||selected.contains(&c.id)){
        for item in &category.items{if control.load(Ordering::Relaxed){break;}if category.id=="old_downloads"{match quarantine_download(&app,item){Ok(record)=>{bytes=bytes.saturating_add(item.size_bytes);deleted=deleted.saturating_add(1);quarantine_records.push(record)},Err(reason)=>failures.push(CleanupFailureItem{path:item.path.clone(),reason})}continue;}if category.requires_admin&&!is_elevated(){elevated.push(item.clone());continue;}let path=PathBuf::from(&item.path);let root=PathBuf::from(&item.root_path);let canonical=match dunce::canonicalize(&path){Ok(v)=>v,Err(e)=>{failures.push(CleanupFailureItem{path:item.path.clone(),reason:e.to_string()});continue}};let canonical_root=match dunce::canonicalize(&root){Ok(v)=>v,Err(e)=>{failures.push(CleanupFailureItem{path:item.path.clone(),reason:e.to_string()});continue}};let metadata=match fs::symlink_metadata(&canonical){Ok(v)=>v,Err(e)=>{failures.push(CleanupFailureItem{path:item.path.clone(),reason:e.to_string()});continue}};if !canonical.starts_with(&canonical_root)||metadata.file_type().is_symlink()||metadata.len()!=item.size_bytes||modified_ms(&metadata).unwrap_or(0).abs_diff(item.modified_unix_ms)>2000{skipped=skipped.saturating_add(1);continue;}match fs::remove_file(&canonical){Ok(())=>{deleted=deleted.saturating_add(1);bytes=bytes.saturating_add(item.size_bytes)},Err(e)=>failures.push(CleanupFailureItem{path:item.path.clone(),reason:e.to_string()})}}
    }
    if !elevated.is_empty(){match elevated_delete(&app,elevated){Ok(value)=>{deleted=deleted.saturating_add(value.deleted_files);bytes=bytes.saturating_add(value.deleted_bytes);failures.extend(value.failed)},Err(error)=>failures.push(CleanupFailureItem{path:"<elevated-cleanup>".into(),reason:error})}}
    let _=save_quarantine(&app,&quarantine_records);remove_token(&op_id);let cancelled=control.load(Ordering::Relaxed);let warnings=if quarantine_records.is_empty(){Vec::new()}else{vec!["Old installers were moved to the reversible KNOUX cleanup quarantine instead of being permanently deleted.".into()]};let data=CleanupExecuteResult{scan_id:snapshot.scan_id.clone(),deleted_files:deleted,deleted_bytes:bytes,skipped_files:skipped,failed_files:failures.clone(),cancelled,warnings:warnings.clone()};append_history(&app,CleanupHistoryEntry{operation_id:op_id.clone(),operation_type:"cleanup".into(),status:if cancelled{"cancelled".into()}else if failures.is_empty(){"completed".into()}else{"completed_with_warnings".into()},started_at:started_at.clone(),completed_at:Utc::now().to_rfc3339(),file_count:deleted,byte_count:bytes,warnings:warnings.clone()});Ok(result(op_id,"m02_s01","m02.cleanup.execute",started_at,timer,if cancelled{"cancelled"}else if failures.is_empty(){"completed"}else{"completed_with_warnings"},Some(data),format!("Processed {deleted} verified files; {skipped} changed files were skipped."),format!("تمت معالجة {deleted} ملف موثق وتجاهل {skipped} ملف تغير بعد الفحص."),warnings,None,None,Some(0)))
}

#[tauri::command]
pub fn m02_cleanup_cancel_complete(op_id:String,target_operation_id:String)->Result<OperationResult<CleanupCancelResult>,String>{let started_at=Utc::now().to_rfc3339();let timer=Instant::now();let requested=TOKENS.lock().ok().and_then(|m|m.get(&target_operation_id).cloned()).map(|t|{t.store(true,Ordering::Relaxed);true}).unwrap_or(false);Ok(result(op_id,"m02_s01","m02.cleanup.cancel",started_at,timer,"completed",Some(CleanupCancelResult{target_operation_id,cancellation_requested:requested}),if requested{"Cancellation requested.".into()}else{"No matching active operation.".into()},if requested{"تم إرسال طلب الإلغاء.".into()}else{"لا توجد عملية نشطة مطابقة.".into()},Vec::new(),None,None,Some(0)))}
#[tauri::command]
pub fn m02_cleanup_history_complete(app:AppHandle,op_id:String)->Result<OperationResult<CleanupHistoryResult>,String>{let started_at=Utc::now().to_rfc3339();let timer=Instant::now();Ok(result(op_id,"m02_s01","m02.cleanup.history",started_at,timer,"completed",Some(CleanupHistoryResult{entries:load_history(&app)}),"Cleanup history loaded.".into(),"تم تحميل سجل التنظيف.".into(),Vec::new(),None,None,Some(0)))}

async fn scan_category(app:AppHandle,op_id:String,id:&str,capability:&str,handler:&str)->Result<OperationResult<CleanupScanResult>,String>{let mut value=m02_cleanup_scan_complete(app,op_id,CleanupScanRequest{categories:vec![id.into()],max_items_per_category:5000}).await?;value.capability_id=capability.into();value.handler_id=handler.into();Ok(value)}
#[tauri::command] pub async fn m02_scan_windows_temp_complete(app:AppHandle,op_id:String)->Result<OperationResult<CleanupScanResult>,String>{scan_category(app,op_id,"windows_temp","m02_s02","m02.scan.windows_temp").await}
#[tauri::command] pub async fn m02_scan_crash_dumps_complete(app:AppHandle,op_id:String)->Result<OperationResult<CleanupScanResult>,String>{scan_category(app,op_id,"crash_dumps","m02_s05","m02.scan.crash_dumps").await}
#[tauri::command] pub async fn m02_scan_application_logs_complete(app:AppHandle,op_id:String)->Result<OperationResult<CleanupScanResult>,String>{scan_category(app,op_id,"application_logs","m02_s07","m02.scan.application_logs").await}
#[tauri::command] pub async fn m02_scan_old_downloads_complete(app:AppHandle,op_id:String)->Result<OperationResult<CleanupScanResult>,String>{scan_category(app,op_id,"old_downloads","m02_s09","m02.scan.old_downloads").await}

#[tauri::command] pub fn m02_download_quarantine_list(app:AppHandle)->Vec<DownloadQuarantineRecord>{load_quarantine(&app)}
#[tauri::command] pub fn m02_download_quarantine_restore(app:AppHandle,op_id:String,quarantine_id:String)->Result<OperationResult<DownloadQuarantineRecord>,String>{let started_at=Utc::now().to_rfc3339();let timer=Instant::now();let mut records=load_quarantine(&app);let Some(index)=records.iter().position(|r|r.quarantine_id==quarantine_id)else{return Ok(result(op_id,"m02_s09","m02.downloads.quarantine.restore",started_at,timer,"failed",None,"Quarantine record not found.".into(),"لم يتم العثور على سجل المحجر.".into(),Vec::new(),Some("quarantine_record_missing".into()),None,Some(1)));};let record=records[index].clone();let source=PathBuf::from(&record.quarantine_path);let destination=PathBuf::from(&record.original_path);if destination.exists(){return Ok(result(op_id,"m02_s09","m02.downloads.quarantine.restore",started_at,timer,"failed",None,"The original destination already exists.".into(),"المسار الأصلي يحتوي بالفعل على ملف بنفس الاسم.".into(),Vec::new(),Some("restore_conflict".into()),None,Some(1)));}if hash_file(&source)?!=record.hash{return Ok(result(op_id,"m02_s09","m02.downloads.quarantine.restore",started_at,timer,"failed",None,"Quarantined file hash verification failed.".into(),"فشل التحقق من بصمة الملف داخل المحجر.".into(),Vec::new(),Some("quarantine_hash_mismatch".into()),None,Some(1)));}if let Some(parent)=destination.parent(){fs::create_dir_all(parent).map_err(|e|format!("restore_parent_failed:{e}"))?;}fs::rename(&source,&destination).map_err(|e|format!("restore_move_failed:{e}"))?;records[index].status="restored".into();save_quarantine(&app,&records)?;Ok(result(op_id,"m02_s09","m02.downloads.quarantine.restore",started_at,timer,"completed",Some(records[index].clone()),"Installer restored from quarantine.".into(),"تمت استعادة ملف التثبيت من المحجر.".into(),Vec::new(),None,None,Some(0)))}
