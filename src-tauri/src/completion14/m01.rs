use crate::contracts::OperationResult;
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    fs,
    path::PathBuf,
    process::Command,
    sync::Mutex,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

static INSTALL_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareItem {
    pub name: String,
    pub manufacturer: String,
    pub model: String,
    pub serial_number: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskItem {
    pub device_id: String,
    pub model: String,
    pub media_type: String,
    pub interface_type: String,
    pub serial_number: String,
    pub size_bytes: Option<u64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuItem {
    pub name: String,
    pub driver_version: String,
    pub adapter_ram_bytes: Option<u64>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemDiscoveryData {
    pub computer_name: String,
    pub manufacturer: String,
    pub computer_model: String,
    pub system_type: String,
    pub os_product_name: String,
    pub os_edition: String,
    pub os_version: String,
    pub build_number: String,
    pub architecture: String,
    pub install_date: String,
    pub last_boot_time: String,
    pub total_ram_gb: Option<f64>,
    pub available_ram_gb: Option<f64>,
    pub cpu_model: String,
    pub cpu_cores: Option<u32>,
    pub cpu_logical_processors: Option<u32>,
    pub active_user: String,
    pub secure_boot_enabled: Option<bool>,
    pub tpm_available: Option<bool>,
    pub tpm_ready: Option<bool>,
    pub bios: Vec<HardwareItem>,
    pub baseboards: Vec<HardwareItem>,
    pub disks: Vec<DiskItem>,
    pub gpus: Vec<GpuItem>,
    pub batteries: Vec<HardwareItem>,
    pub evidence_source: String,
    pub measured_at: String,
}

fn result<T>(
    op_id: String,
    capability: &str,
    handler: &str,
    started_at: String,
    timer: Instant,
    data: Option<T>,
    status: &str,
    summary_en: String,
    summary_ar: String,
    warnings: Vec<String>,
    error_code: Option<String>,
    stderr: Option<String>,
    exit_code: Option<i32>,
) -> OperationResult<T> {
    OperationResult {
        operation_id: op_id,
        capability_id: capability.into(),
        handler_id: handler.into(),
        status: status.into(),
        started_at,
        completed_at: Some(Utc::now().to_rfc3339()),
        duration_ms: Some(timer.elapsed().as_millis() as u64),
        requires_restart: false,
        exit_code,
        stdout: None,
        stderr,
        summary_en,
        summary_ar,
        warnings,
        error_code,
        data,
    }
}

#[tauri::command]
pub fn m01_system_discover_complete(
    op_id: String,
) -> Result<OperationResult<SystemDiscoveryData>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();

    #[cfg(target_os = "windows")]
    {
        let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$os = Get-CimInstance Win32_OperatingSystem
$computer = Get-CimInstance Win32_ComputerSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$secureBoot = $null
$tpmPresent = $null
$tpmReady = $null
try { $secureBoot = Confirm-SecureBootUEFI } catch {}
try { $tpm = Get-Tpm; $tpmPresent = $tpm.TpmPresent; $tpmReady = $tpm.TpmReady } catch {}
$bios = @(Get-CimInstance Win32_BIOS | ForEach-Object {
  [pscustomobject]@{ name=[string]$_.Name; manufacturer=[string]$_.Manufacturer; model=[string]$_.SMBIOSBIOSVersion; serialNumber=[string]$_.SerialNumber; status=[string]$_.Status }
})
$boards = @(Get-CimInstance Win32_BaseBoard | ForEach-Object {
  [pscustomobject]@{ name=[string]$_.Product; manufacturer=[string]$_.Manufacturer; model=[string]$_.Model; serialNumber=[string]$_.SerialNumber; status=[string]$_.Status }
})
$disks = @(Get-CimInstance Win32_DiskDrive | ForEach-Object {
  [pscustomobject]@{ deviceId=[string]$_.DeviceID; model=[string]$_.Model; mediaType=[string]$_.MediaType; interfaceType=[string]$_.InterfaceType; serialNumber=[string]$_.SerialNumber; sizeBytes=if ($_.Size) {[uint64]$_.Size} else {$null}; status=[string]$_.Status }
})
$gpus = @(Get-CimInstance Win32_VideoController | ForEach-Object {
  [pscustomobject]@{ name=[string]$_.Name; driverVersion=[string]$_.DriverVersion; adapterRamBytes=if ($_.AdapterRAM) {[uint64]$_.AdapterRAM} else {$null}; status=[string]$_.Status }
})
$batteries = @(Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue | ForEach-Object {
  [pscustomobject]@{ name=[string]$_.Name; manufacturer=[string]$_.Manufacturer; model=[string]$_.DeviceID; serialNumber=[string]$_.PNPDeviceID; status=[string]$_.Status }
})
[pscustomobject]@{
  computerName = [string]$env:COMPUTERNAME
  manufacturer = [string]$computer.Manufacturer
  computerModel = [string]$computer.Model
  systemType = [string]$computer.SystemType
  osProductName = [string]$os.Caption
  osEdition = [string]$os.OperatingSystemSKU
  osVersion = [string]$os.Version
  buildNumber = [string]$os.BuildNumber
  architecture = [string]$os.OSArchitecture
  installDate = if ($os.InstallDate) { ([datetime]$os.InstallDate).ToUniversalTime().ToString('o') } else { '' }
  lastBootTime = if ($os.LastBootUpTime) { ([datetime]$os.LastBootUpTime).ToUniversalTime().ToString('o') } else { '' }
  totalRamGB = if ($computer.TotalPhysicalMemory) { [math]::Round($computer.TotalPhysicalMemory / 1GB, 2) } else { $null }
  availableRamGB = if ($os.FreePhysicalMemory) { [math]::Round(($os.FreePhysicalMemory * 1KB) / 1GB, 2) } else { $null }
  cpuModel = [string]$cpu.Name
  cpuCores = if ($cpu.NumberOfCores) { [uint32]$cpu.NumberOfCores } else { $null }
  cpuLogicalProcessors = if ($cpu.NumberOfLogicalProcessors) { [uint32]$cpu.NumberOfLogicalProcessors } else { $null }
  activeUser = if ($computer.UserName) { [string]$computer.UserName } else { [string]$env:USERNAME }
  secureBootEnabled = $secureBoot
  tpmAvailable = $tpmPresent
  tpmReady = $tpmReady
  bios = $bios
  baseboards = $boards
  disks = $disks
  gpus = $gpus
  batteries = $batteries
  evidenceSource = 'Windows CIM, Secure Boot and TPM providers'
  measuredAt = [datetime]::UtcNow.ToString('o')
} | ConvertTo-Json -Depth 6 -Compress
"#;
        let output = Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .map_err(|error| format!("system_discovery_launch_failed:{error}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        if !output.status.success() {
            return Ok(result(
                op_id,
                "m01_s01",
                "m01.system.discover",
                started_at,
                timer,
                None,
                "failed",
                "Windows hardware discovery failed.".into(),
                "فشل اكتشاف مكونات جهاز ويندوز.".into(),
                Vec::new(),
                Some("system_discovery_failed".into()),
                Some(stderr),
                output.status.code(),
            ));
        }
        let data: SystemDiscoveryData = serde_json::from_str(&stdout)
            .map_err(|error| format!("system_discovery_parse_failed:{error}"))?;
        let mut warnings = Vec::new();
        if data.disks.is_empty() {
            warnings.push("No physical disk evidence was returned by Windows CIM.".into());
        }
        if data.gpus.is_empty() {
            warnings.push("No display-adapter evidence was returned by Windows CIM.".into());
        }
        Ok(result(
            op_id,
            "m01_s01",
            "m01.system.discover",
            started_at,
            timer,
            Some(data),
            if warnings.is_empty() { "completed" } else { "completed_with_warnings" },
            "Windows hardware, firmware, storage, display and security evidence was measured.".into(),
            "تم قياس أدلة مكونات الجهاز والبرامج الثابتة والتخزين والعرض والأمان من ويندوز.".into(),
            warnings,
            None,
            if stderr.is_empty() { None } else { Some(stderr) },
            output.status.code(),
        ))
    }

    #[cfg(not(target_os = "windows"))]
    {
        Ok(result(
            op_id,
            "m01_s01",
            "m01.system.discover",
            started_at,
            timer,
            None,
            "unavailable",
            "Windows desktop runtime is required.".into(),
            "يلزم تشغيل التطبيق على ويندوز.".into(),
            Vec::new(),
            Some("unsupported_os".into()),
            Some("Windows host is required.".into()),
            None,
        ))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallQueueItem {
    pub queue_id: String,
    pub package_id: String,
    pub status: String,
    pub attempts: u32,
    pub queued_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub exit_code: Option<i32>,
    pub requires_restart: bool,
    pub last_error: Option<String>,
}

fn allowed_package_ids() -> HashSet<&'static str> {
    [
        "Google.Chrome", "Mozilla.Firefox", "Brave.Brave", "7zip.7zip",
        "Microsoft.PowerToys", "voidtools.Everything", "Notepad++.Notepad++",
        "Telegram.TelegramDesktop", "WhatsApp.WhatsApp", "Discord.Discord",
        "VideoLAN.VLC", "Spotify.Spotify", "Microsoft.VisualStudioCode", "Git.Git",
        "OpenJS.NodeJS.LTS", "Python.Python.3.12", "Microsoft.WindowsTerminal", "Figma.Figma",
    ]
    .into_iter()
    .collect()
}

fn queue_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("install_queue_app_data_failed:{error}"))?
        .join("install-queue");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("install_queue_directory_failed:{error}"))?;
    Ok(directory.join("queue.json"))
}

fn load_queue(app: &AppHandle) -> Result<Vec<InstallQueueItem>, String> {
    let path = queue_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let payload = fs::read(&path).map_err(|error| format!("install_queue_read_failed:{error}"))?;
    serde_json::from_slice(&payload).map_err(|error| format!("install_queue_parse_failed:{error}"))
}

fn save_queue(app: &AppHandle, queue: &[InstallQueueItem]) -> Result<(), String> {
    let path = queue_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let payload = serde_json::to_vec_pretty(queue)
        .map_err(|error| format!("install_queue_serialize_failed:{error}"))?;
    fs::write(&temporary, payload)
        .map_err(|error| format!("install_queue_write_failed:{error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("install_queue_commit_failed:{error}"))
}

fn install_one(app: &AppHandle, queue_id: &str) -> Result<InstallQueueItem, String> {
    let _guard = INSTALL_LOCK
        .lock()
        .map_err(|_| "install_queue_lock_poisoned".to_string())?;
    let mut queue = load_queue(app)?;
    let index = queue
        .iter()
        .position(|item| item.queue_id == queue_id)
        .ok_or_else(|| "install_queue_item_missing".to_string())?;
    let package_id = queue[index].package_id.clone();
    queue[index].status = "running".into();
    queue[index].attempts = queue[index].attempts.saturating_add(1);
    queue[index].started_at = Some(Utc::now().to_rfc3339());
    queue[index].last_error = None;
    save_queue(app, &queue)?;

    #[cfg(target_os = "windows")]
    let execution = Command::new("winget.exe")
        .args([
            "install", "--id", &package_id, "--exact", "--silent",
            "--disable-interactivity", "--accept-package-agreements", "--accept-source-agreements",
        ])
        .output()
        .map_err(|error| format!("winget_install_launch_failed:{error}"));

    #[cfg(not(target_os = "windows"))]
    let execution: Result<std::process::Output, String> = Err("unsupported_os".into());

    let mut queue = load_queue(app)?;
    let index = queue
        .iter()
        .position(|item| item.queue_id == queue_id)
        .ok_or_else(|| "install_queue_item_missing_after_run".to_string())?;
    match execution {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let verified = if output.status.success() {
                Command::new("winget.exe")
                    .args(["list", "--id", &package_id, "--exact", "--disable-interactivity"])
                    .output()
                    .map(|check| check.status.success() && String::from_utf8_lossy(&check.stdout).to_ascii_lowercase().contains(&package_id.to_ascii_lowercase()))
                    .unwrap_or(false)
            } else {
                false
            };
            queue[index].status = if verified { "completed" } else { "failed" }.into();
            queue[index].completed_at = Some(Utc::now().to_rfc3339());
            queue[index].exit_code = output.status.code();
            queue[index].requires_restart = stdout.to_ascii_lowercase().contains("restart");
            queue[index].last_error = if verified { None } else { Some(if stderr.is_empty() { "Post-install verification failed.".into() } else { stderr }) };
        }
        Err(error) => {
            queue[index].status = "failed".into();
            queue[index].completed_at = Some(Utc::now().to_rfc3339());
            queue[index].exit_code = Some(1);
            queue[index].last_error = Some(error);
        }
    }
    save_queue(app, &queue)?;
    Ok(queue[index].clone())
}

#[tauri::command]
pub fn m01_winget_install_queued(
    app: AppHandle,
    op_id: String,
    package_id: String,
) -> Result<OperationResult<String>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    if !allowed_package_ids().contains(package_id.as_str()) {
        return Ok(result(
            op_id,
            "m01_s05",
            "m01.winget.install",
            started_at,
            timer,
            None,
            "failed",
            "The package is not in the curated installation manifest.".into(),
            "الحزمة غير موجودة في قائمة التثبيت المعتمدة.".into(),
            Vec::new(),
            Some("package_not_allowlisted".into()),
            Some(format!("Package is not allowlisted: {package_id}")),
            Some(1),
        ));
    }

    let mut queue = load_queue(&app)?;
    let item = InstallQueueItem {
        queue_id: Uuid::new_v4().to_string(),
        package_id: package_id.clone(),
        status: "queued".into(),
        attempts: 0,
        queued_at: Utc::now().to_rfc3339(),
        started_at: None,
        completed_at: None,
        exit_code: None,
        requires_restart: false,
        last_error: None,
    };
    queue.push(item.clone());
    save_queue(&app, &queue)?;
    let completed = install_one(&app, &item.queue_id)?;
    let success = completed.status == "completed";
    Ok(result(
        op_id,
        "m01_s05",
        "m01.winget.install",
        started_at,
        timer,
        Some(package_id.clone()),
        if success { "completed" } else { "failed" },
        if success {
            format!("{package_id} was installed, verified, and recorded in the resumable queue.")
        } else {
            format!("{package_id} remains in the resumable queue after a failed attempt.")
        },
        if success {
            format!("تم تثبيت {package_id} والتحقق منه وحفظه في طابور التثبيت القابل للاستكمال.")
        } else {
            format!("بقيت الحزمة {package_id} في طابور التثبيت بعد فشل المحاولة ويمكن إعادة تشغيلها.")
        },
        Vec::new(),
        if success { None } else { Some("winget_install_failed".into()) },
        completed.last_error,
        completed.exit_code,
    ))
}

#[tauri::command]
pub fn m01_winget_queue_list(app: AppHandle) -> Result<Vec<InstallQueueItem>, String> {
    load_queue(&app)
}

#[tauri::command]
pub fn m01_winget_queue_resume(
    app: AppHandle,
    op_id: String,
) -> Result<OperationResult<Vec<InstallQueueItem>>, String> {
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let pending = load_queue(&app)?
        .into_iter()
        .filter(|item| matches!(item.status.as_str(), "queued" | "failed" | "interrupted"))
        .map(|item| item.queue_id)
        .collect::<Vec<_>>();
    for queue_id in pending {
        let _ = install_one(&app, &queue_id);
    }
    let queue = load_queue(&app)?;
    let failed = queue.iter().filter(|item| item.status == "failed").count();
    Ok(result(
        op_id,
        "m01_s05",
        "m01.winget.queue.resume",
        started_at,
        timer,
        Some(queue),
        if failed == 0 { "completed" } else { "completed_with_warnings" },
        format!("The resumable installation queue was processed; {failed} items still need review."),
        format!("تمت معالجة طابور التثبيت القابل للاستكمال؛ ما زالت {failed} حزمة تحتاج إلى مراجعة."),
        if failed == 0 { Vec::new() } else { vec![format!("{failed} queue items failed.")] },
        None,
        None,
        Some(0),
    ))
}
