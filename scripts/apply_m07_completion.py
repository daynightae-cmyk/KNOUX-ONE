from pathlib import Path

root = Path(__file__).resolve().parents[1]

catalog_path = root / "src/data/capabilitiesCatalog.ts"
catalog = catalog_path.read_text(encoding="utf-8")
marker = "for (const [number, handler, en, ar, options] of m06) implemented('m06', number, handler, en, ar, options);\n\nsetModule('m15'"
block = """for (const [number, handler, en, ar, options] of m06) implemented('m06', number, handler, en, ar, options);

setModule('m07', 'Windows Repair', 'إصلاح مشاكل Windows',
  'Run official Windows integrity checks and focused component repairs with typed confirmation, original command evidence and reversible Windows Update backups.',
  'تشغيل فحوص سلامة ويندوز الرسمية وإصلاحات محددة للمكونات مع تأكيد مكتوب وأدلة الأوامر الأصلية ونسخ قابلة للاستعادة لتحديثات ويندوز.');
const m07: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm07.sfc.manage', 'Official SFC verify and repair modes preserve the original Windows output and require typed confirmation before repair.', 'يوفر SFC وضع الفحص والإصلاح الرسمي مع حفظ خرج ويندوز الأصلي وطلب تأكيد مكتوب قبل الإصلاح.', { requiresAdmin: true }],
  [2, 'm07.dism.check_health', 'DISM CheckHealth reads the online component-store state through the official executable.', 'يقرأ DISM CheckHealth حالة مخزن مكونات ويندوز عبر الأداة الرسمية.', { requiresAdmin: true }],
  [3, 'm07.dism.scan_health', 'DISM ScanHealth performs a comprehensive read-only component-store scan.', 'ينفذ DISM ScanHealth فحصًا شاملًا لمخزن المكونات دون تعديل.', { requiresAdmin: true }],
  [4, 'm07.dism.restore_health', 'DISM RestoreHealth uses the default official Windows repair source after exact typed confirmation.', 'يستخدم DISM RestoreHealth مصدر إصلاح ويندوز الرسمي بعد تأكيد مكتوب مطابق.', { requiresAdmin: true }],
  [5, 'm07.update.manage', 'Windows Update services and folders are inspected, reset by unique renaming rather than deletion, and recorded for restoration.', 'يتم فحص خدمات ومجلدات Windows Update وإعادة ضبطها بإعادة تسمية فريدة بدل الحذف وتسجيلها للاستعادة.', { requiresAdmin: true, supportsUndo: true }],
  [6, 'm07.cache.manage', 'Only allowlisted LocalAppData icon and thumbnail cache files are inspected and removed for Explorer rebuild.', 'يتم فحص وحذف ملفات كاش الأيقونات والمصغرات المسموح بها فقط داخل LocalAppData لإعادة بناء Explorer.'],
  [7, 'm07.wmi.manage', 'WMI repository verification and safe salvage are available while destructive resetrepository is blocked.', 'يتوفر التحقق من مستودع WMI وإصلاح Salvage الآمن مع منع resetrepository العنيف.', { requiresAdmin: true }],
  [8, 'm07.installer.manage', 'The Windows Installer service is inspected and only official System32 and SysWOW64 msiexec binaries are re-registered.', 'يتم فحص Windows Installer وإعادة تسجيل ملفات msiexec الرسمية فقط من System32 وSysWOW64.', { requiresAdmin: true }],
  [9, 'm07.vss.manage', 'VSS services and writers are inspected and repaired without broad version-sensitive DLL registration recipes.', 'يتم فحص وإصلاح خدمات وكتّاب VSS دون وصفات تسجيل DLL عامة وحساسة لإصدار ويندوز.', { requiresAdmin: true }],
  [10, 'm07.store.manage', 'Microsoft Store package and services can be inspected, reset with wsreset and re-registered for the current user.', 'يمكن فحص حزمة وخدمات Microsoft Store وإعادة ضبطها عبر wsreset وإعادة تسجيلها للمستخدم الحالي.'],
];
for (const [number, handler, en, ar, options] of m07) implemented('m07', number, handler, en, ar, options);

setModule('m15'"""
if "const m07: Array" not in catalog:
    if marker not in catalog:
        raise SystemExit("catalog insertion marker not found")
    catalog = catalog.replace(marker, block, 1)
catalog_path.write_text(catalog, encoding="utf-8")

for test_path in (root / "src/tests").glob("*.test.ts"):
    text = test_path.read_text(encoding="utf-8")
    text = text.replace("toHaveLength(60)", "toHaveLength(70)")
    text = text.replace("toHaveLength(130)", "toHaveLength(120)")
    test_path.write_text(text, encoding="utf-8")

workspace_path = root / "src/features/repair/WindowsRepairWorkspace.tsx"
workspace = workspace_path.read_text(encoding="utf-8")
workspace = workspace.replace(
    "  const latestBackup = backups.findLast?.(item => !item.restoredAt)\n    ?? [...backups].reverse().find(item => !item.restoredAt);",
    "  const latestBackup = [...backups].reverse().find(item => !item.restoredAt);",
)
workspace_path.write_text(workspace, encoding="utf-8")

native_path = root / "src-tauri/src/windows_repair/mod.rs"
native = native_path.read_text(encoding="utf-8")
native = native.replace("fn invalid_action<T>(\n    app: &AppHandle,", "fn invalid_action<T>(\n    _app: &AppHandle,")
native = native.replace(
    "software_backup.file_name().unwrap_or_default().to_string_lossy().as_ref()",
    "software_backup.file_name().and_then(|item| item.to_str()).unwrap_or(\"\")",
)
native = native.replace(
    "catroot_backup.file_name().unwrap_or_default().to_string_lossy().as_ref()",
    "catroot_backup.file_name().and_then(|item| item.to_str()).unwrap_or(\"\")",
)
native = native.replace(
    "software_current.file_name().unwrap_or_default().to_string_lossy().as_ref()",
    "software_current.file_name().and_then(|item| item.to_str()).unwrap_or(\"\")",
)
native = native.replace(
    "catroot_current.file_name().unwrap_or_default().to_string_lossy().as_ref()",
    "catroot_current.file_name().and_then(|item| item.to_str()).unwrap_or(\"\")",
)

old_confirmation = '''fn confirmation_failure(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    error: String,
) -> OperationResult<RepairReport> {
    execute_steps(
        app,
        capability_id,
        handler_id,
        service,
        action,
        false,
        false,
        Vec::new(),
        Vec::new(),
        Vec::new(),
        vec![error.clone()],
        &error,
        &format!("التأكيد المكتوب غير صحيح: {error}"),
    )
}
'''
new_confirmation = '''fn confirmation_failure(
    app: &AppHandle,
    capability_id: &str,
    handler_id: &str,
    service: &str,
    action: &str,
    error: String,
) -> OperationResult<RepairReport> {
    let operation_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();
    let timer = Instant::now();
    let report = RepairReport {
        service: service.into(),
        action: action.into(),
        elevated: is_elevated(),
        requires_restart: false,
        commands: Vec::new(),
        artifacts: Vec::new(),
        update_backups: Vec::new(),
        notes: vec![error.clone()],
        evidence_path: None,
        measured_at: Utc::now().to_rfc3339(),
    };
    report_result(
        app,
        operation_id,
        capability_id,
        handler_id,
        started_at,
        timer,
        report,
        Some(error.clone()),
        Vec::new(),
        &error,
        &format!("التأكيد المكتوب غير صحيح: {error}"),
    )
}
'''
if old_confirmation not in native:
    raise SystemExit("confirmation_failure block not found")
native = native.replace(old_confirmation, new_confirmation, 1)

old_reset = '''            let step = powershell_step(script, true);
            let evidence = run_step(&step);
            let mut history = update_history(&app).unwrap_or_default();
            if evidence.success {
                history.push(UpdateBackup {
                    id,
                    software_distribution_backup: software_backup.exists().then(|| software_backup.to_string_lossy().to_string()),
                    catroot2_backup: catroot_backup.exists().then(|| catroot_backup.to_string_lossy().to_string()),
                    created_at: Utc::now().to_rfc3339(),
                    restored_at: None,
                });
                let _ = save_update_history(&app, &history);
            }
            execute_steps(
                &app,
                "m07_s05",
                "m07.update.manage",
                "windows_update",
                "reset",
                true,
                true,
                vec![Step::owned(&evidence.program, evidence.arguments.clone(), true)],
                Vec::new(),
                history,
                vec!["SoftwareDistribution and catroot2 are renamed to unique KNOUX backup paths instead of being permanently deleted.".into()],
                "Windows Update reset completed with reversible backups",
                "اكتملت إعادة ضبط Windows Update مع نسخ احتياطية قابلة للاستعادة",
            )
'''
new_reset = '''            let mut history = update_history(&app).unwrap_or_default();
            let mut result = execute_steps(
                &app,
                "m07_s05",
                "m07.update.manage",
                "windows_update",
                "reset",
                true,
                true,
                vec![powershell_step(script, true)],
                Vec::new(),
                history.clone(),
                vec!["SoftwareDistribution and catroot2 are renamed to unique KNOUX backup paths instead of being permanently deleted.".into()],
                "Windows Update reset completed with reversible backups",
                "اكتملت إعادة ضبط Windows Update مع نسخ احتياطية قابلة للاستعادة",
            );
            if result.status != "failed" {
                history.push(UpdateBackup {
                    id,
                    software_distribution_backup: software_backup.exists().then(|| software_backup.to_string_lossy().to_string()),
                    catroot2_backup: catroot_backup.exists().then(|| catroot_backup.to_string_lossy().to_string()),
                    created_at: Utc::now().to_rfc3339(),
                    restored_at: None,
                });
                let _ = save_update_history(&app, &history);
                if let Some(data) = result.data.as_mut() {
                    data.update_backups = history;
                }
            }
            result
'''
if old_reset not in native:
    raise SystemExit("Windows Update reset block not found")
native = native.replace(old_reset, new_reset, 1)
native_path.write_text(native, encoding="utf-8")

matrix_path = root / "REAL_IMPLEMENTATION_MATRIX.md"
matrix = matrix_path.read_text(encoding="utf-8")
if "## Module 07 — Windows Repair" not in matrix:
    matrix += """

## Module 07 — Windows Repair

- Catalog state after this phase: 70 implemented, 0 partial, 120 planned.
- Dedicated UI: `src/features/repair/WindowsRepairWorkspace.tsx`.
- Typed bridge: `src/features/repair/repairClient.ts` and `repairContracts.ts`.
- Native engine: `src-tauri/src/windows_repair/mod.rs`.
- Explicit allowlist mappings: `src/services/nativeCommandRegistry.ts`.
- Registered Tauri commands: `src-tauri/src/main.rs`.
- Safety: typed confirmation, administrator checks, original stdout/stderr evidence, reversible Windows Update folder backups, WMI resetrepository blocked, broad regsvr32 recipes blocked.
- Integrity gate: `src/tests/m07Integrity.test.ts`.
"""
matrix_path.write_text(matrix, encoding="utf-8")
