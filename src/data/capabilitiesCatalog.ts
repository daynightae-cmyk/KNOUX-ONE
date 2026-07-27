/**
 * KNOUX ONE — authoritative capability catalog.
 * A service is executable only when it has an explicit allowlisted native handler.
 */
import type { KnouxCapability, KnouxModule } from '../types';
import { MODULES_CATALOG as LEGACY_SEED } from './legacyCapabilitiesSeed';

const plannedReasonEn = 'Native implementation is scheduled for a dedicated verified phase.';
const plannedReasonAr = 'التنفيذ المحلي الحقيقي لهذه الخدمة مخطط له في مرحلة مستقلة خاضعة للتحقق.';

const catalog: KnouxModule[] = LEGACY_SEED.map(module => ({
  ...module,
  services: module.services.map(service => ({
    ...service,
    handlerId: undefined,
    runtime: 'desktop',
    status: 'planned',
    implementationState: 'planned',
    availabilityReasonEn: plannedReasonEn,
    availabilityReasonAr: plannedReasonAr,
    requiresAdmin: false,
    supportsPreview: true,
    supportsDryRun: true,
    supportsCancel: false,
    supportsUndo: false,
    supportsQuarantine: false,
  })),
}));

function patchService(moduleId: string, serviceNumber: number, patch: Partial<KnouxCapability>) {
  const module = catalog.find(item => item.id === moduleId);
  const service = module?.services.find(item => item.serviceNumber === serviceNumber);
  if (!service) throw new Error(`Missing catalog service ${moduleId}/${serviceNumber}`);
  Object.assign(service, patch);
}

function implemented(
  moduleId: string,
  serviceNumber: number,
  handlerId: string,
  reasonEn: string,
  reasonAr: string,
  options: Partial<KnouxCapability> = {},
) {
  patchService(moduleId, serviceNumber, {
    handlerId,
    status: 'available',
    implementationState: 'implemented',
    availabilityReasonEn: reasonEn,
    availabilityReasonAr: reasonAr,
    runtime: options.requiresAdmin ? 'desktop_elevated' : 'desktop',
    requiresAdmin: false,
    supportsPreview: true,
    supportsDryRun: true,
    supportsCancel: false,
    supportsUndo: false,
    supportsQuarantine: false,
    ...options,
  });
}

function setModule(moduleId: string, nameEn: string, nameAr: string, descriptionEn: string, descriptionAr: string) {
  const module = catalog.find(item => item.id === moduleId);
  if (!module) throw new Error(`Missing catalog module ${moduleId}`);
  module.nameEn = nameEn;
  module.nameAr = nameAr;
  module.descriptionEn = descriptionEn;
  module.descriptionAr = descriptionAr;
}

setModule('m01', 'Windows Setup', 'تجهيز الجهاز بعد تثبيت Windows',
  'Read verified Windows hardware evidence and install curated applications through a persistent resumable Winget queue.',
  'قراءة أدلة مكونات ويندوز الحقيقية وتثبيت البرامج المعتمدة عبر طابور Winget محفوظ وقابل للاستكمال.');
implemented('m01', 1, 'm01.system.discover',
  'Windows CIM, firmware, storage, display, Secure Boot, TPM, memory, CPU and battery evidence are measured explicitly.',
  'يتم قياس أدلة CIM والبرامج الثابتة والتخزين والعرض وSecure Boot وTPM والذاكرة والمعالج والبطارية بصورة صريحة.');
implemented('m01', 2, 'm01.winget.verify',
  'The real Winget executable path and version are verified through an explicit native command.',
  'يتم التحقق من مسار Winget الحقيقي وإصداره عبر أمر محلي صريح.');
implemented('m01', 5, 'm01.winget.install',
  'Allowlisted installation, post-install verification, persistent queue state, retries and resume commands are connected.',
  'تم ربط التثبيت المسموح والتحقق بعد التثبيت وحفظ الطابور وإعادة المحاولة والاستكمال.',
  { supportsUndo: false });

setModule('m02', 'Device Cleanup', 'تنظيف الملفات غير الضرورية',
  'Measure real disposable files, verify every mutation, request UAC only for protected evidence and quarantine old installers reversibly.',
  'قياس الملفات القابلة للتنظيف والتحقق من كل تعديل وطلب UAC للمواقع المحمية فقط ونقل ملفات التثبيت القديمة إلى محجر قابل للاستعادة.');
const m02: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm02.scan.user_temp', 'Verified current-user temporary-file scanning and unchanged-file deletion are connected.', 'تم ربط فحص ملفات المستخدم المؤقتة والحذف بعد التحقق من عدم تغير الملف.', { supportsCancel: true }],
  [2, 'm02.scan.windows_temp', 'A signed SHA-256 manifest, path containment, metadata revalidation and Windows UAC helper complete protected Temp cleanup.', 'يكمل ملف Manifest موقع بـSHA-256 والتحقق من المسار والبيانات ونافذة UAC تنظيف Temp المحمي.', { requiresAdmin: true, supportsCancel: true }],
  [3, 'm02.scan.browser_cache', 'Supported browser cache-only folders are measured and cleaned without reading history, cookies or passwords.', 'يتم قياس وتنظيف مجلدات كاش المتصفحات دون قراءة السجل أو ملفات الارتباط أو كلمات المرور.', { supportsCancel: true }],
  [4, 'm02.scan.thumbnail_cache', 'Windows thumbnail and icon caches are measured and changed-file checks precede deletion.', 'يتم قياس كاش الصور والأيقونات مع فحص تغير الملف قبل الحذف.', { supportsCancel: true }],
  [5, 'm02.scan.crash_dumps', 'User and protected crash-report locations are scanned; protected deletion uses the verified UAC manifest workflow.', 'يتم فحص مواقع تقارير الأعطال العادية والمحمية ويستخدم الحذف المحمي مسار UAC الموثق.', { requiresAdmin: true, supportsCancel: true }],
  [7, 'm02.scan.application_logs', 'Allowlisted LocalAppData log, report, WER, crash and temporary-log directories are discovered to bounded depth.', 'يتم اكتشاف مجلدات السجلات والتقارير وWER والأعطال داخل LocalAppData بعمق محدود وآمن.', { supportsCancel: true }],
  [9, 'm02.scan.old_downloads', 'Old installers are selected from a verified scan and moved to checksum-backed AppData quarantine with restore support.', 'يتم اختيار ملفات التثبيت القديمة من فحص موثق ونقلها إلى محجر AppData ببصمة رقمية ودعم الاستعادة.', { supportsQuarantine: true, supportsUndo: true, supportsCancel: true }],
];
for (const [number, handler, en, ar, options] of m02) implemented('m02', number, handler, en, ar, options);

setModule('m03', 'Duplicate Finder', 'البحث عن الملفات المكررة',
  'Verify exact duplicates, classify similar images with multiple signals, fingerprint decoded media and compare archive manifests without extraction.',
  'التحقق من الملفات المتطابقة وتصنيف الصور بعدة إشارات وإنشاء بصمات للوسائط المفكوكة ومقارنة محتوى الأرشيف دون استخراجه.');
const m03: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm03.scan.exact', 'Streaming BLAKE3 exact verification, changed-file checks and hard-link awareness are connected.', 'تم ربط التحقق التام عبر BLAKE3 وفحص تغير الملف والروابط الصلبة.'],
  [2, 'm03.scan.fast', 'Bounded partial-hash candidate scanning is connected and remains non-actionable until verified.', 'تم ربط الفحص الجزئي السريع مع منعه من تنفيذ إجراءات قبل التحقق.'],
  [3, 'm03.scan.images', 'dHash, aHash, RGB histogram, aspect ratio and decoded dimensions are combined into local review clusters.', 'يتم دمج dHash وaHash وتوزيع RGB ونسبة الأبعاد والمقاسات في مجموعات مراجعة محلية.'],
  [4, 'm03.scan.videos', 'ffprobe metadata and bounded decoded grayscale-frame fingerprints provide real local video evidence.', 'توفر بيانات ffprobe وبصمات الإطارات الرمادية المفكوكة والمحدودة أدلة فيديو محلية حقيقية.', { supportsQuarantine: true }],
  [5, 'm03.scan.audio', 'ffprobe evidence and normalized decoded PCM energy fingerprints provide metadata-independent audio comparison.', 'توفر أدلة ffprobe وبصمات طاقة PCM المفكوكة والمطبعة مقارنة صوتية مستقلة عن البيانات الوصفية.', { supportsQuarantine: true }],
  [6, 'm03.scan.documents', 'Exact document and source-file verification is connected locally.', 'تم ربط التحقق المحلي من المستندات وملفات الكود.', { supportsQuarantine: true }],
  [7, 'm03.scan.archives', 'ZIP manifests are read through the compression API and 7z/RAR manifests through 7-Zip listing without extraction.', 'تتم قراءة Manifest لملفات ZIP عبر واجهة الضغط و7z وRAR عبر قائمة 7-Zip دون فك المحتوى.', { supportsQuarantine: true }],
  [8, 'm03.scan.folders', 'Deterministic folder digests and item-level comparison are connected.', 'تم ربط بصمات المجلدات الحتمية والمقارنة على مستوى العناصر.'],
  [9, 'm03.keeper.plan', 'Explainable keeper planning blocks every group without one verified keeper.', 'يمنع تخطيط الاحتفاظ الموضح أي مجموعة لا تحتوي على نسخة أصلية موثقة.'],
  [10, 'm03.quarantine.manage', 'Checksum-verified quarantine, verify, restore, conflict handling and typed-confirmation purge are connected.', 'تم ربط المحجر الموثق بالبصمة والتحقق والاستعادة ومعالجة التعارض والحذف بتأكيد مكتوب.', { supportsQuarantine: true, supportsUndo: true }],
];
for (const [number, handler, en, ar, options] of m03) implemented('m03', number, handler, en, ar, options);

setModule('m04', 'Storage Usage', 'معرفة ما يستهلك مساحة الجهاز',
  'Measure real paths and access timestamps, inspect logical and physical storage, monitor free space and export PDF plus JSON evidence.',
  'قياس المسارات وأوقات الوصول الحقيقية وفحص التخزين المنطقي والفعلي ومراقبة المساحة وتصدير PDF مع أدلة JSON.');
const m04: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm04.storage.scan', 'Recursive real-file measurement now includes explicit access-time or labeled modification-time fallback evidence.', 'يشمل القياس الحقيقي المتكرر دليل وقت الوصول أو بديل تاريخ التعديل المسمى بوضوح.', { supportsCancel: true }],
  [2, 'm04.files.largest', 'Largest-file ranking is calculated from the measured path.', 'يتم حساب ترتيب أكبر الملفات من المسار المقاس.', { supportsCancel: true }],
  [3, 'm04.folders.largest', 'Recursive folder totals are calculated from measured files.', 'يتم حساب إجماليات المجلدات من الملفات المقاسة.', { supportsCancel: true }],
  [4, 'm04.types.distribution', 'File-category and extension totals are calculated from real metadata.', 'يتم حساب إجماليات فئات الملفات وامتداداتها من البيانات الحقيقية.', { supportsCancel: true }],
  [5, 'm04.files.old', 'Each old-file decision records whether last-access time or a labeled modification-time fallback was used.', 'يسجل كل قرار للملفات القديمة استخدام وقت الوصول أو بديل تاريخ التعديل المسمى.', { supportsCancel: true }],
  [6, 'm04.downloads.analyze', 'The real current-user Downloads directory is measured with access-time evidence.', 'يتم قياس مجلد التنزيلات الحقيقي مع دليل وقت الوصول.', { supportsCancel: true }],
  [7, 'm04.appdata.analyze', 'The real LocalAppData directory is measured read-only with access-time evidence.', 'يتم قياس LocalAppData للقراءة فقط مع دليل وقت الوصول.', { supportsCancel: true }],
  [8, 'm04.drives.external', 'Windows logical volumes and Get-PhysicalDisk media, bus, health, serial and capacity evidence are connected.', 'تم ربط وحدات التخزين المنطقية وأدلة Get-PhysicalDisk للنوع والناقل والصحة والرقم والسعة.'],
  [9, 'm04.space.check', 'Threshold configuration is persisted and an in-process monitor emits Tauri events and Windows toast alerts.', 'يتم حفظ إعداد الحد وتشغيل مراقب خلفي يرسل أحداث Tauri وتنبيهات Windows Toast.'],
  [10, 'm04.report.export', 'A valid PDF report and JSON evidence sidecar are exported from the measured native snapshot.', 'يتم تصدير تقرير PDF صالح وملف أدلة JSON من المعاينة المحلية المقاسة.'],
];
for (const [number, handler, en, ar, options] of m04) implemented('m04', number, handler, en, ar, options);

setModule('m05', 'Startup Control', 'التحكم في برامج بدء التشغيل والخدمات',
  'Inspect real Windows startup sources, protect system entries, apply reversible user changes, delay programs, save profiles and measure boot history.',
  'فحص مصادر بدء التشغيل الحقيقية وحماية عناصر النظام وتطبيق تغييرات قابلة للاستعادة وتأخير البرامج وحفظ البروفايلات وقياس سجل الإقلاع.');
const m05: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm05.registry.inspect', 'HKCU and HKLM Run/RunOnce entries are read with executable signature evidence; only non-protected user entries can be changed.', 'تتم قراءة مدخلات Run وRunOnce للمستخدم والجهاز مع دليل توقيع الملف، ولا يمكن تغيير سوى عناصر المستخدم غير المحمية.', { supportsUndo: true }],
  [2, 'm05.folders.inspect', 'User and common Startup folders are read and shortcuts are resolved; user items can be moved to a reversible AppData backup.', 'تتم قراءة مجلدي بدء التشغيل وحل الاختصارات، ويمكن نقل عناصر المستخدم إلى نسخة AppData قابلة للاستعادة.', { supportsUndo: true }],
  [3, 'm05.tasks.inspect', 'Real boot and logon scheduled tasks are enumerated read-only with Microsoft task protection labels.', 'يتم استعراض مهام الإقلاع وتسجيل الدخول الحقيقية للقراءة فقط مع تمييز مهام Microsoft المحمية.'],
  [4, 'm05.services.inspect', 'Windows services, executable paths and Authenticode publishers are inspected read-only; critical services remain protected.', 'يتم فحص خدمات ويندوز ومساراتها وناشري Authenticode للقراءة فقط، وتظل الخدمات الحرجة محمية.'],
  [5, 'm05.impact.assess', 'A transparent review score uses signature, scope and command characteristics together with measured Event 100 boot history.', 'يستخدم مؤشر مراجعة شفاف التوقيع والنطاق وخصائص الأمر مع سجل الإقلاع المقاس من الحدث 100.'],
  [6, 'm05.recommendations.generate', 'Recommendations are limited to recognized non-Microsoft user entries and never make automatic changes.', 'تقتصر التوصيات على عناصر المستخدم غير التابعة لمايكروسوفت ولا تنفذ تغييرات تلقائية.'],
  [7, 'm05.delay.manage', 'Selected mutable user entries can be moved to a verified 30/60/90-second Task Scheduler delay with one-step restoration.', 'يمكن نقل عناصر المستخدم القابلة للتغيير إلى تشغيل مؤجل موثق لمدة 30 أو 60 أو 90 ثانية مع استعادة بخطوة واحدة.', { supportsUndo: true }],
  [8, 'm05.profiles.manage', 'Named startup profiles persist selected user-entry states and apply them without touching protected or machine entries.', 'تحفظ بروفايلات التشغيل حالات عناصر المستخدم وتطبقها دون لمس عناصر الجهاز أو العناصر المحمية.', { supportsUndo: true }],
  [9, 'm05.restore.manage', 'Every user startup mutation is journaled in AppData and can be restored after typed confirmation.', 'يتم تسجيل كل تعديل لبدء التشغيل داخل AppData ويمكن استعادته بعد تأكيد مكتوب.', { supportsUndo: true }],
  [10, 'm05.boot.history', 'Measured boot duration, main-path time and post-boot time are read from Windows Diagnostics-Performance Event 100.', 'تتم قراءة زمن الإقلاع والمسار الرئيسي وما بعد الإقلاع من الحدث 100 في سجل أداء ويندوز.'],
];
for (const [number, handler, en, ar, options] of m05) implemented('m05', number, handler, en, ar, options);

setModule('m06', 'Performance Center', 'تسريع الجهاز وتحسين الأداء',
  'Measure real CPU, memory, disk, network and process activity; apply reversible process-priority and power-plan changes; save safe profiles and run a bounded local benchmark.',
  'قياس المعالج والذاكرة والأقراص والشبكة والعمليات الحقيقية، وتطبيق تغييرات أولوية وخطط طاقة قابلة للاستعادة، وحفظ بروفايلات آمنة وتشغيل قياس محلي محدود.');
const m06: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm06.cpu.monitor', 'Windows performance data provides total and per-core CPU utilization together with measured clock values.', 'توفر بيانات أداء ويندوز استخدام المعالج الكلي وكل نواة مع سرعات التشغيل المقاسة.'],
  [2, 'm06.memory.monitor', 'Physical, available, committed, cached and commit-limit memory values are read from Windows.', 'تتم قراءة الذاكرة الفعلية والمتاحة والمحجوزة والمخبأة وحد الالتزام من ويندوز.'],
  [3, 'm06.disk.activity', 'Physical-disk read, write, transfer, active-time and queue values are measured from Windows performance data.', 'يتم قياس القراءة والكتابة والعمليات ووقت النشاط وطابور الأقراص من بيانات ويندوز.'],
  [4, 'm06.network.activity', 'Adapter throughput is measured and established TCP connections are grouped by owning process without inventing per-process bandwidth.', 'يتم قياس سرعة محولات الشبكة وتجميع اتصالات TCP حسب البرنامج دون اختلاق سرعة لكل برنامج.'],
  [5, 'm06.process.explorer', 'The live process inventory includes parent, path, command, memory, CPU time, threads, handles and protected-process evidence.', 'تشمل قائمة العمليات الحية الأصل والمسار والأمر والذاكرة ووقت المعالج والخيوط والمقابض ودليل الحماية.'],
  [6, 'm06.process.heavy', 'A bounded two-sample CPU measurement and real memory values identify high-usage processes without claiming a leak from one sample.', 'تحدد عينة معالج مزدوجة محدودة وقيم الذاكرة الحقيقية البرامج الأعلى استهلاكًا دون ادعاء تسريب من عينة واحدة.'],
  [7, 'm06.priority.manage', 'Only non-protected processes can receive allowlisted non-realtime priorities after typed confirmation, with a restoration journal.', 'لا يمكن تغيير سوى العمليات غير المحمية إلى أولويات مسموحة غير Realtime بعد تأكيد مكتوب مع سجل استعادة.', { supportsUndo: true }],
  [8, 'm06.power.manage', 'Installed Windows power plans are read through powercfg and changes are typed-confirmed and journaled for restoration.', 'تتم قراءة خطط طاقة ويندوز المثبتة عبر powercfg وتأكيد التغييرات كتابيًا وتسجيلها للاستعادة.', { supportsUndo: true }],
  [9, 'm06.profiles.manage', 'Named profiles persist an installed power scheme and transparent CPU/RAM attention thresholds without hidden registry tuning.', 'تحفظ البروفايلات خطة طاقة مثبتة وحدود مراجعة واضحة للمعالج والذاكرة دون تعديلات Registry مخفية.', { supportsUndo: true }],
  [10, 'm06.benchmark.report', 'A bounded SHA-256 CPU sample and an 8 MB temporary disk write/read sample produce a local JSON evidence report and remove the temporary file.', 'تنتج عينة SHA-256 محدودة للمعالج وعينة كتابة وقراءة ملف مؤقت 8 MB تقرير JSON محليًا مع حذف الملف المؤقت.'],
];
for (const [number, handler, en, ar, options] of m06) implemented('m06', number, handler, en, ar, options);

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

setModule('m08', 'Network Diagnostics', 'إصلاح وتحسين الإنترنت',
  'Inspect real Windows adapters, IP, DNS, latency, routes, proxy and firewall evidence, then run explicit bounded repair commands only after user confirmation.',
  'فحص محولات ويندوز وعناوين IP وDNS وزمن الاستجابة والمسارات والبروكسي وجدار الحماية، ثم تشغيل إصلاحات محددة ومحدودة بعد تأكيد المستخدم.');
const m08: Array<[number, string, string, string, Partial<KnouxCapability>?]> = [
  [1, 'm08.adapters.inspect', 'Windows CIM adapter, MAC, speed, state and signed driver metadata are read without changing adapter state.', 'تتم قراءة محولات الشبكة وعنوان MAC والسرعة والحالة وبيانات التعريف الموقعة دون تغيير حالة المحول.'],
  [2, 'm08.ip.inspect', 'Local IPv4/IPv6, gateways, routes, DHCP and configured DNS servers are read from Windows without contacting a public-IP service.', 'تتم قراءة IPv4 وIPv6 والبوابات والمسارات وDHCP وخوادم DNS من ويندوز دون الاتصال بخدمة خارجية لمعرفة العنوان العام.'],
  [3, 'm08.ping.test', 'Validated targets are measured through bounded .NET Ping requests with real latency and packet-loss evidence.', 'يتم قياس الهدف بعد التحقق منه عبر طلبات Ping محدودة مع زمن الاستجابة وفقدان الحزم الحقيقي.'],
  [4, 'm08.traceroute.run', 'Validated targets use bounded tracert hop and timeout limits while preserving original command output.', 'يستخدم الهدف المتحقق منه أمر tracert بحدود واضحة لعدد القفزات والمهلة مع حفظ الخرج الأصلي.'],
  [5, 'm08.dns.benchmark', 'Cloudflare, Google and Quad9 resolution times are measured read-only without changing the configured DNS server.', 'يتم قياس استجابة Cloudflare وGoogle وQuad9 للقراءة فقط دون تغيير خادم DNS المضبوط.'],
  [6, 'm08.dns.flush', 'The official ipconfig DNS-cache flush is executed without modifying DNS server configuration.', 'يتم تشغيل تنظيف ذاكرة DNS الرسمي عبر ipconfig دون تعديل إعدادات خادم DNS.'],
  [7, 'm08.ip.renew', 'A typed-confirmed administrator operation records pre/post evidence around bounded DHCP release and renew commands.', 'تسجل عملية بصلاحية المسؤول وبعد تأكيد مكتوب أدلة قبل وبعد أوامر تحرير وتجديد DHCP المحدودة.', { requiresAdmin: true }],
  [8, 'm08.stack.reset', 'Typed-confirmed official Winsock and TCP/IP reset commands preserve their reset log and report the required restart.', 'تشغل أوامر Winsock وTCP/IP الرسمية بعد تأكيد مكتوب وتحفظ سجل الإعادة وتوضح ضرورة إعادة التشغيل.', { requiresAdmin: true }],
  [9, 'm08.proxy_firewall.inspect', 'WinHTTP, current-user proxy and Windows Defender Firewall profiles and rule counts are inspected read-only.', 'يتم فحص WinHTTP وبروكسي المستخدم وملفات جدار حماية Windows Defender وأعداد القواعد للقراءة فقط.'],
  [10, 'm08.report.export', 'A local JSON report exports measured adapter, IP, proxy, firewall, TCP/UDP and bounded ping evidence.', 'يتم تصدير تقرير JSON محلي يضم أدلة المحولات وIP والبروكسي والجدار وإحصاءات TCP/UDP وعينة Ping محدودة.'],
];
for (const [number, handler, en, ar, options] of m08) implemented('m08', number, handler, en, ar, options);

setModule('m15', 'KNOUX Developer Studio', 'استوديو المطورين KNOUX',
  'Local-first Windows developer tooling with explicit native commands and evidence reports.',
  'أدوات مطور محلية لويندوز بأوامر صريحة وتقارير أدلة.');
const m15Handlers = [
  'm15.environment.discover', 'm15.path.audit', 'm15.runtime.inspect', 'm15.git.audit',
  'm15.repositories.scan', 'm15.ports.manage', 'm15.projects.audit', 'm15.caches.manage',
  'm15.http.execute', 'm15.report.export',
];
for (let index = 0; index < m15Handlers.length; index += 1) {
  implemented('m15', index + 1, m15Handlers[index],
    'Connected to an explicit allowlisted native Windows handler with honest web fallback.',
    'متصلة بأمر ويندوز محلي صريح ومسموح مع حالة صادقة في نسخة الويب.');
}

const module16 = catalog.find(item => item.id === 'm16');
module16?.services.forEach(service => {
  service.handlerId = undefined;
  service.status = 'planned';
  service.implementationState = 'planned';
  service.availabilityReasonEn = 'Module 16 is reserved for its dedicated independently verified phase.';
  service.availabilityReasonAr = 'القسم 16 محجوز لمرحلته المستقلة الخاضعة للتحقق.';
});

export const MODULES_CATALOG: KnouxModule[] = catalog;
export const ALL_CAPABILITIES: KnouxCapability[] = MODULES_CATALOG.flatMap(module => module.services);
export const CAPABILITY_BY_ID = new Map(ALL_CAPABILITIES.map(capability => [capability.id, capability]));
