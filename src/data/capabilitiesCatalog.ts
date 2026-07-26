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
