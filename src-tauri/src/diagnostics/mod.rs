mod bsod;
mod contracts;
mod crashes;
mod errors;
mod events;
mod exports;
mod hardware;
mod network;
mod persistence;
mod powershell;
mod redaction;
mod reliability;
mod services;
mod updates;

pub use contracts::*;

use crate::contracts::OperationResult;
use chrono::Utc;
use errors::DiagnosticError;
use serde::Serialize;
use std::time::Instant;
use tauri::AppHandle;

fn success<T: Serialize>(app:&AppHandle,operation_id:String,capability_id:&str,handler_id:&str,started_at:String,timer:Instant,summary_en:String,summary_ar:String,data:T,mut warnings:Vec<String>)->OperationResult<T>{
 let evidence=serde_json::to_value(&data).unwrap_or(serde_json::Value::Null);if let Err(error)=persistence::record_session(app,capability_id,"completed",&evidence,&warnings){warnings.push(error);}OperationResult{operation_id,capability_id:capability_id.into(),handler_id:handler_id.into(),status:if warnings.is_empty(){"completed"}else{"completed_with_warnings"}.into(),started_at,completed_at:Some(Utc::now().to_rfc3339()),duration_ms:Some(timer.elapsed().as_millis() as u64),requires_restart:false,exit_code:Some(0),stdout:None,stderr:None,summary_en,summary_ar,warnings,error_code:None,data:Some(data)}}
fn failure<T>(operation_id:String,capability_id:&str,handler_id:&str,started_at:String,timer:Instant,error:DiagnosticError)->OperationResult<T>{OperationResult{operation_id,capability_id:capability_id.into(),handler_id:handler_id.into(),status:if matches!(&error,DiagnosticError::UnsupportedOs){"unavailable"}else{"failed"}.into(),started_at,completed_at:Some(Utc::now().to_rfc3339()),duration_ms:Some(timer.elapsed().as_millis() as u64),requires_restart:false,exit_code:Some(1),stdout:None,stderr:Some(error.to_string()),summary_en:error.to_string(),summary_ar:format!("فشل التشخيص المحلي: {error}"),warnings:Vec::new(),error_code:Some(error.code().into()),data:None}}

macro_rules! diagnostic_command {($name:ident,$request:ty,$result:ty,$cap:literal,$handler:literal,$worker:path,$summary_en:expr,$summary_ar:expr)=>{#[tauri::command] pub async fn $name(app:AppHandle,op_id:String,request:$request)->Result<OperationResult<$result>,String>{let started=Utc::now().to_rfc3339();let timer=Instant::now();let result=tauri::async_runtime::spawn_blocking(move||$worker(&request)).await.map_err(|e|format!("diagnostic_worker_join_failed: {e}"))?;Ok(match result{Ok(data)=>{let warnings=data.warnings.clone();success(&app,op_id,$cap,$handler,started,timer,$summary_en(&data),$summary_ar(&data),data,warnings)},Err(error)=>failure(op_id,$cap,$handler,started,timer,error)})}}}

diagnostic_command!(m17_events_query,EventQueryRequest,EventQueryResult,"m17_s01","m17.events.query",events::query,|d:&EventQueryResult|format!("Read {} Windows event records.",d.events.len()),|d:&EventQueryResult|format!("تمت قراءة {} سجل من أحداث ويندوز.",d.events.len()));
diagnostic_command!(m17_crashes_correlate,CrashCorrelationRequest,CrashCorrelationResult,"m17_s02","m17.crashes.correlate",crashes::correlate,|d:&CrashCorrelationResult|format!("Correlated {} application crash events.",d.total_events),|d:&CrashCorrelationResult|format!("تم ربط {} حدثًا لانهيار التطبيقات.",d.total_events));
diagnostic_command!(m17_bsod_triage,BsodTriageRequest,BsodTriageResult,"m17_s03","m17.bsod.triage",bsod::triage,|d:&BsodTriageResult|format!("Found {} BugCheck events and {} minidumps.",d.bugchecks.len(),d.minidumps.len()),|d:&BsodTriageResult|format!("تم العثور على {} حدث شاشة زرقاء و{} ملف Minidump.",d.bugchecks.len(),d.minidumps.len()));
diagnostic_command!(m17_reliability_timeline,ReliabilityRequest,ReliabilityResult,"m17_s04","m17.reliability.timeline",reliability::timeline,|d:&ReliabilityResult|format!("Read {} Windows reliability records.",d.records.len()),|d:&ReliabilityResult|format!("تمت قراءة {} سجلًا من موثوقية ويندوز.",d.records.len()));
diagnostic_command!(m17_services_diagnose,ServiceDiagnosticsRequest,ServiceDiagnosticsResult,"m17_s05","m17.services.diagnose",services::diagnose,|d:&ServiceDiagnosticsResult|format!("Found {} service failure events and {} automatic services not running.",d.failures.len(),d.automatic_not_running.len()),|d:&ServiceDiagnosticsResult|format!("تم العثور على {} حدث فشل و{} خدمة تلقائية غير عاملة.",d.failures.len(),d.automatic_not_running.len()));
diagnostic_command!(m17_updates_analyze,UpdateDiagnosticsRequest,UpdateDiagnosticsResult,"m17_s06","m17.updates.analyze",updates::analyze,|d:&UpdateDiagnosticsResult|format!("Analyzed {} Windows Update events.",d.events.len()),|d:&UpdateDiagnosticsResult|format!("تم تحليل {} حدثًا من تحديثات ويندوز.",d.events.len()));
diagnostic_command!(m17_hardware_warnings,HardwareWarningsRequest,HardwareWarningsResult,"m17_s07","m17.hardware.warnings",hardware::warnings,|d:&HardwareWarningsResult|format!("Read {} hardware, driver, storage, and kernel warnings.",d.events.len()),|d:&HardwareWarningsResult|format!("تمت قراءة {} تحذيرًا للعتاد والتعريفات والتخزين والنواة.",d.events.len()));
diagnostic_command!(m17_network_diagnose,NetworkDiagnosticsRequest,NetworkDiagnosticsResult,"m17_s08","m17.network.diagnose",network::diagnose,|d:&NetworkDiagnosticsResult|format!("Inspected {} network adapters and {} incident events.",d.adapters.len(),d.events.len()),|d:&NetworkDiagnosticsResult|format!("تم فحص {} محول شبكة و{} حدث اتصال.",d.adapters.len(),d.events.len()));

#[tauri::command] pub async fn m17_bundle_export(app:AppHandle,op_id:String,request:DiagnosticExportRequest)->Result<OperationResult<DiagnosticExportResult>,String>{let started=Utc::now().to_rfc3339();let timer=Instant::now();let worker_app=app.clone();let result=tauri::async_runtime::spawn_blocking(move||exports::bundle(&worker_app,&request)).await.map_err(|e|format!("diagnostic_worker_join_failed: {e}"))?;Ok(match result{Ok(data)=>{let mut warnings=data.warnings.clone();if let Err(e)=persistence::record_export(&app,&data.export_id,"bundle",&data.path,&data.sha256,data.size_bytes,data.redaction_count){warnings.push(e);}success(&app,op_id,"m17_s09","m17.bundle.export",started,timer,format!("Created a redacted diagnostic support bundle at {}.",data.path),format!("تم إنشاء حزمة دعم تشخيصية منقحة في {}.",data.path),data,warnings)},Err(error)=>failure(op_id,"m17_s09","m17.bundle.export",started,timer,error)})}
#[tauri::command] pub async fn m17_report_export(app:AppHandle,op_id:String,request:DiagnosticExportRequest)->Result<OperationResult<DiagnosticExportResult>,String>{let started=Utc::now().to_rfc3339();let timer=Instant::now();let worker_app=app.clone();let result=tauri::async_runtime::spawn_blocking(move||exports::report(&worker_app,&request)).await.map_err(|e|format!("diagnostic_worker_join_failed: {e}"))?;Ok(match result{Ok(data)=>{let mut warnings=data.warnings.clone();if let Err(e)=persistence::record_export(&app,&data.export_id,"report",&data.path,&data.sha256,data.size_bytes,data.redaction_count){warnings.push(e);}success(&app,op_id,"m17_s10","m17.report.export",started,timer,format!("Created a redacted diagnostic report at {}.",data.path),format!("تم إنشاء تقرير تشخيصي منقح في {}.",data.path),data,warnings)},Err(error)=>failure(op_id,"m17_s10","m17.report.export",started,timer,error)})}
