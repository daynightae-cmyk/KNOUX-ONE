/**
 * KNOUX ONE — Authoritative capability catalog.
 * The legacy catalog is a bilingual content seed only. This module owns all
 * executable states and explicit native handler bindings.
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
    supportsCancel: true,
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

function renameService(
  moduleId: string,
  serviceNumber: number,
  nameEn: string,
  nameAr: string,
  descriptionEn: string,
  descriptionAr: string,
) {
  patchService(moduleId, serviceNumber, { nameEn, nameAr, descriptionEn, descriptionAr });
}

patchService('m01', 1, {
  handlerId: 'm01.system.discover',
  implementationState: 'partial',
  status: 'available',
  availabilityReasonEn: 'Real Windows CIM discovery is connected; some hardware fields remain best-effort.',
  availabilityReasonAr: 'اكتشاف ويندوز الحقيقي عبر CIM متصل، وبعض حقول المكونات تظل حسب توفر النظام.',
});
patchService('m01', 2, {
  handlerId: 'm01.winget.verify',
  implementationState: 'implemented',
  status: 'available',
  availabilityReasonEn: 'The real Winget executable path and version are verified through an explicit native command.',
  availabilityReasonAr: 'يتم التحقق من مسار Winget الحقيقي وإصداره عبر أمر محلي صريح.',
});
patchService('m01', 5, {
  handlerId: 'm01.winget.install',
  implementationState: 'partial',
  status: 'available',
  runtime: 'desktop_elevated',
  requiresAdmin: true,
  availabilityReasonEn: 'Allowlisted Winget installation and post-install verification are connected; full resumable queue work remains planned.',
  availabilityReasonAr: 'تثبيت Winget للحزم المسموحة والتحقق بعد التثبيت متصلان، بينما يظل الطابور القابل للاستئناف مخططًا.',
});

const module02 = catalog.find(item => item.id === 'm02');
if (module02) {
  module02.nameEn = 'Device Cleanup';
  module02.nameAr = 'تنظيف الملفات غير الضرورية';
  module02.descriptionEn = 'Inspect real temporary locations, review measured file sizes, and remove verified disposable files without touching personal documents.';
  module02.descriptionAr = 'فحص مواقع الملفات المؤقتة الحقيقية وعرض الأحجام المقاسة ثم حذف الملفات المتحقق من أمانها دون المساس بالمستندات الشخصية.';
}

const module02Names: Array<[number, string, string, string, string]> = [
  [1, 'Your temporary files', 'ملفات حسابك المؤقتة', 'Inspect the current Windows user temporary directory and remove only unchanged files from the verified scan snapshot.', 'فحص مجلد الملفات المؤقتة لحساب ويندوز الحالي وحذف الملفات التي لم تتغير منذ المعاينة فقط.'],
  [2, 'Windows temporary files', 'ملفات ويندوز المؤقتة', 'Inspect the real Windows Temp directory; cleanup depends on desktop administrator permissions.', 'فحص مجلد Windows Temp الحقيقي، ويعتمد الحذف على تشغيل التطبيق بصلاحية المسؤول.'],
  [3, 'Browser temporary files', 'ملفات المتصفحات المؤقتة', 'Inspect cache-only folders for supported browsers without reading history, cookies, or passwords.', 'فحص مجلدات الكاش فقط للمتصفحات المدعومة دون قراءة السجل أو ملفات الارتباط أو كلمات المرور.'],
  [4, 'Image thumbnail files', 'ملفات الصور المصغرة', 'Inspect Windows thumbnail and icon cache databases and remove only files verified by the current scan.', 'فحص قواعد بيانات الصور والأيقونات المصغرة في ويندوز وحذف الملفات المطابقة للمعاينة الحالية فقط.'],
  [5, 'Program crash reports', 'تقارير انهيار البرامج', 'Inspect local crash dumps and Windows error-report folders; protected locations may require administrator rights.', 'فحص تقارير الأعطال المحلية ومجلدات تقارير أخطاء ويندوز، وقد تتطلب المواقع المحمية صلاحية المسؤول.'],
  [6, 'Windows update delivery files', 'ملفات تسليم تحديثات ويندوز', 'Reserved until service coordination, rollback evidence, and elevation are independently verified.', 'مؤجلة حتى يتم التحقق مستقلًا من تنسيق خدمات التحديث والتراجع والصلاحيات المرتفعة.'],
  [7, 'Old application logs', 'سجلات التطبيقات القديمة', 'Inspect old log, ETL, and temporary files in the current user temp location; Windows Event Logs are not modified.', 'فحص ملفات السجل وETL والملفات المؤقتة القديمة داخل مجلد المستخدم فقط، دون تعديل سجلات أحداث ويندوز.'],
  [8, 'Recycle Bin review', 'مراجعة سلة المحذوفات', 'Reserved until selective restore and purge can be implemented without fabricating item evidence.', 'مؤجلة حتى يتم تنفيذ المعاينة والاستعادة والحذف الانتقائي دون إنشاء بيانات وهمية.'],
  [9, 'Old installers in Downloads', 'ملفات التثبيت القديمة في التنزيلات', 'Read-only review of installer and archive files older than 30 days; automatic deletion is disabled.', 'مراجعة للقراءة فقط لملفات التثبيت والملفات المضغوطة الأقدم من 30 يومًا، مع تعطيل الحذف التلقائي.'],
  [10, 'Automatic cleanup schedules', 'جداول التنظيف التلقائي', 'Reserved until a verified Windows Task Scheduler integration and execution history are implemented.', 'مؤجلة حتى يتم تنفيذ تكامل موثق مع Windows Task Scheduler وسجل تشغيل حقيقي.'],
];
for (const [number, nameEn, nameAr, descriptionEn, descriptionAr] of module02Names) {
  renameService('m02', number, nameEn, nameAr, descriptionEn, descriptionAr);
}

const m02States: Array<[number, string | undefined, KnouxCapability['implementationState'], KnouxCapability['status'], boolean, string, string]> = [
  [1, 'm02.scan.user_temp', 'implemented', 'available', false, 'Real filesystem scan and verified cleanup are connected for the current user temporary directory.', 'تم ربط فحص الملفات الحقيقي والتنظيف المتحقق منه لمجلد الملفات المؤقتة للمستخدم الحالي.'],
  [2, 'm02.scan.windows_temp', 'partial', 'available', true, 'Real scanning is connected; deletion succeeds only when the desktop process already has the required Windows permissions.', 'تم ربط الفحص الحقيقي، ويعمل الحذف فقط عندما تكون عملية سطح المكتب حاصلة بالفعل على صلاحيات ويندوز المطلوبة.'],
  [3, 'm02.scan.browser_cache', 'implemented', 'available', false, 'Real cache-only discovery, scan evidence, and verified deletion are connected for supported browser profiles.', 'تم ربط اكتشاف مجلدات الكاش الحقيقية ومعاينتها وحذف الملفات المتحقق منها للمتصفحات المدعومة.'],
  [4, 'm02.scan.thumbnail_cache', 'implemented', 'available', false, 'Real Windows thumbnail-cache discovery, evidence capture, and verified deletion are connected.', 'تم ربط اكتشاف كاش الصور المصغرة الحقيقي وحفظ الأدلة والحذف المتحقق منه.'],
  [5, 'm02.scan.crash_dumps', 'partial', 'available', true, 'Real crash-report scanning is connected; some protected report folders require an elevated desktop process.', 'تم ربط فحص تقارير الأعطال الحقيقي، بينما تحتاج بعض المجلدات المحمية إلى تشغيل التطبيق بصلاحية مرتفعة.'],
  [6, undefined, 'planned', 'planned', true, plannedReasonEn, plannedReasonAr],
  [7, 'm02.scan.application_logs', 'partial', 'available', false, 'Real old-log scanning is limited to the current user temporary location; Windows Event Logs remain untouched.', 'الفحص الحقيقي للسجلات القديمة محدود بمجلد المستخدم المؤقت، ولا يتم تعديل سجلات أحداث ويندوز.'],
  [8, undefined, 'planned', 'planned', false, plannedReasonEn, plannedReasonAr],
  [9, 'm02.scan.old_downloads', 'partial', 'available', false, 'Real read-only review is connected for old installer files; deletion is intentionally unavailable.', 'تم ربط المراجعة الحقيقية للقراءة فقط لملفات التثبيت القديمة، والحذف غير متاح عمدًا.'],
  [10, undefined, 'planned', 'planned', false, plannedReasonEn, plannedReasonAr],
];
for (const [number, handlerId, implementationState, status, requiresAdmin, availabilityReasonEn, availabilityReasonAr] of m02States) {
  patchService('m02', number, {
    handlerId,
    implementationState,
    status,
    requiresAdmin,
    runtime: requiresAdmin ? 'desktop_elevated' : 'desktop',
    availabilityReasonEn,
    availabilityReasonAr,
    supportsCancel: Boolean(handlerId),
    supportsDryRun: true,
    supportsUndo: false,
    supportsQuarantine: false,
  });
}

const module03Names: Array<[number, string, string, string, string]> = [
  [1, 'Exact Duplicate Scan', 'فحص التطابق التام', 'Verify byte-identical files using size grouping, partial BLAKE3, full streaming BLAKE3, changed-file checks, and hard-link awareness.', 'التحقق من الملفات المتطابقة باستخدام الحجم ثم BLAKE3 الجزئي والكامل مع اكتشاف تغير الملف والروابط الصلبة.'],
  [2, 'Fast Candidate Scan', 'الفحص السريع للمرشحين', 'Create non-actionable partial-hash candidates that require full verification before quarantine.', 'إنشاء مرشحين بالبصمة الجزئية لا يمكن نقلهم إلى المحجر قبل التحقق الكامل.'],
  [3, 'Similar Image Review', 'مراجعة الصور المتشابهة', 'Decode images locally and compare perceptual dHash evidence; manual review is mandatory.', 'فك الصور محليًا ومقارنة بصمة dHash البصرية مع إلزام المراجعة اليدوية.'],
  [4, 'Video Duplicate Review', 'مراجعة الفيديوهات المكررة', 'Verify exact video files locally; advanced stream similarity requires ffprobe configuration.', 'التحقق محليًا من الفيديوهات المتطابقة، بينما يتطلب تشابه المسارات المتقدم إعداد ffprobe.'],
  [5, 'Audio Duplicate Review', 'مراجعة الملفات الصوتية', 'Verify exact audio files locally; acoustic fingerprinting requires a reviewed optional engine.', 'التحقق محليًا من الصوتيات المتطابقة، بينما تحتاج البصمة الصوتية إلى محرك اختياري معتمد.'],
  [6, 'Document Duplicate Review', 'مراجعة المستندات المكررة', 'Verify exact documents, configuration files, and source code without uploading content.', 'التحقق من المستندات وملفات الإعداد والكود المتطابقة دون رفع المحتوى.'],
  [7, 'Archive Duplicate Review', 'مراجعة الأرشيف المكرر', 'Verify exact archives without unsafe automatic extraction; internal-manifest comparison remains review-only.', 'التحقق من الأرشيف المتطابق دون فك ضغط تلقائي غير آمن، مع إبقاء فحص المحتوى الداخلي للمراجعة.'],
  [8, 'Folder Comparison', 'مقارنة المجلدات', 'Build deterministic folder digests and item-level overlap evidence.', 'إنشاء بصمات حتمية للمجلدات وعرض أدلة التداخل على مستوى العناصر.'],
  [9, 'Keeper Rule Planning', 'تخطيط قواعد الاحتفاظ', 'Generate explainable keeper plans and block groups without one verified keeper.', 'إنشاء خطط موضحة لاختيار النسخة المحتفظ بها ومنع أي مجموعة بلا نسخة موثقة.'],
  [10, 'Verified Quarantine & Restore', 'المحجر الموثق والاستعادة', 'Move, verify, persist, restore, and purge files through checksum-verified transactions.', 'نقل الملفات والتحقق منها وحفظها واستعادتها أو حذفها عبر معاملات موثقة بالبصمة.'],
];
for (const [number, nameEn, nameAr, descriptionEn, descriptionAr] of module03Names) {
  renameService('m03', number, nameEn, nameAr, descriptionEn, descriptionAr);
}

const m03States: Array<[number, string, KnouxCapability['implementationState'], KnouxCapability['status'], string, string]> = [
  [1, 'm03.scan.exact', 'implemented', 'available', 'Real exact scan, full verification, file-change checks, and hard-link handling are connected.', 'تم ربط الفحص التام والتحقق الكامل وفحص تغير الملفات ومعالجة الروابط الصلبة.'],
  [2, 'm03.scan.fast', 'implemented', 'available', 'Real partial-hash candidate scanning is connected and remains non-actionable.', 'تم ربط الفحص الحقيقي للمرشحين بالبصمة الجزئية مع إبقائه غير قابل للإجراء.'],
  [3, 'm03.scan.images', 'partial', 'available', 'Local image decoding and dHash comparison are connected; advanced classification remains limited.', 'تم ربط فك الصور محليًا ومقارنة dHash، بينما يظل التصنيف المتقدم محدودًا.'],
  [4, 'm03.scan.videos', 'partial', 'available', 'Exact video verification is connected; advanced stream similarity requires ffprobe.', 'تم ربط التحقق من الفيديو المتطابق، بينما يحتاج التشابه المتقدم إلى ffprobe.'],
  [5, 'm03.scan.audio', 'partial', 'available', 'Exact audio verification is connected; acoustic fingerprinting requires configuration.', 'تم ربط التحقق من الصوت المتطابق، بينما تحتاج البصمة الصوتية إلى إعداد إضافي.'],
  [6, 'm03.scan.documents', 'implemented', 'available', 'Exact local document and source-file verification is connected.', 'تم ربط التحقق المحلي من المستندات وملفات الكود المتطابقة.'],
  [7, 'm03.scan.archives', 'partial', 'available', 'Exact archive verification is connected; safe internal-manifest analysis remains planned.', 'تم ربط التحقق من الأرشيف المتطابق، بينما يظل تحليل المحتوى الداخلي الآمن مخططًا.'],
  [8, 'm03.scan.folders', 'implemented', 'available', 'Deterministic folder digests and item-level comparison are connected.', 'تم ربط بصمات المجلدات الحتمية والمقارنة على مستوى العناصر.'],
  [9, 'm03.keeper.plan', 'implemented', 'available', 'Explainable keeper planning is connected and blocks groups without a keeper.', 'تم ربط تخطيط الاحتفاظ الموضح ومنع المجموعات التي لا تحتوي على نسخة أصلية.'],
  [10, 'm03.quarantine.manage', 'implemented', 'available', 'Checksum-verified quarantine, list, verify, restore, conflict handling, and typed-confirmation purge are connected.', 'تم ربط المحجر والقائمة والتحقق والاستعادة ومعالجة التعارض والحذف النهائي بتأكيد مكتوب.'],
];
for (const [number, handlerId, implementationState, status, availabilityReasonEn, availabilityReasonAr] of m03States) {
  patchService('m03', number, {
    handlerId,
    implementationState,
    status,
    availabilityReasonEn,
    availabilityReasonAr,
    supportsQuarantine: [1, 4, 5, 6, 7, 10].includes(number),
  });
}

const module04 = catalog.find(item => item.id === 'm04');
if (module04) {
  module04.nameEn = 'Storage Usage';
  module04.nameAr = 'معرفة ما يستهلك مساحة الجهاز';
  module04.descriptionEn = 'Measure a real folder or drive, find the largest files and folders, review file types and old data, inspect connected drives, and export local evidence.';
  module04.descriptionAr = 'قياس مجلد أو قرص حقيقي ومعرفة أكبر الملفات والمجلدات وأنواع البيانات والملفات القديمة وفحص الأقراص المتصلة وتصدير الأدلة محليًا.';
}

const module04Names: Array<[number, string, string, string, string]> = [
  [1, 'Storage map', 'خريطة استخدام المساحة', 'Measure the selected path recursively and create a proportional storage breakdown from real files.', 'قياس المسار المحدد بالكامل وإنشاء توزيع نسبي للمساحة من الملفات الحقيقية.'],
  [2, 'Largest files', 'أكبر الملفات', 'Rank the largest measured files under the selected path with size, type, and modification date.', 'ترتيب أكبر الملفات المقاسة داخل المسار المحدد مع الحجم والنوع وتاريخ التعديل.'],
  [3, 'Largest folders', 'أكبر المجلدات', 'Calculate recursive folder sizes from the files actually reached by the scan.', 'حساب أحجام المجلدات داخليًا من الملفات التي وصل إليها الفحص بالفعل.'],
  [4, 'File types', 'أنواع الملفات', 'Group measured storage by file category and extension without opening file contents.', 'تجميع المساحة المقاسة حسب فئة الملف وامتداده دون فتح محتوى الملفات.'],
  [5, 'Old files', 'الملفات القديمة', 'Find files whose modification date is older than the selected threshold.', 'العثور على الملفات التي يسبق تاريخ تعديلها الحد الزمني المحدد.'],
  [6, 'Downloads folder', 'تحليل مجلد التنزيلات', 'Measure the current Windows user Downloads folder and show its largest items.', 'قياس مجلد التنزيلات لحساب ويندوز الحالي وعرض أكبر العناصر داخله.'],
  [7, 'Program data folders', 'تحليل مساحة البرامج', 'Measure the current user Local AppData directory without changing application data.', 'قياس مجلد Local AppData للمستخدم الحالي دون تعديل بيانات البرامج.'],
  [8, 'Connected drives', 'الأقراص المتصلة', 'Read logical-drive type and real capacity values from Windows, including removable and remote drives when available.', 'قراءة نوع الأقراص المنطقية وسعتها الحقيقية من ويندوز، بما فيها الأقراص الخارجية والبعيدة عند توفرها.'],
  [9, 'Low-space check', 'فحص انخفاض المساحة', 'Run a one-time comparison of current free space against a selected threshold.', 'إجراء مقارنة لحظية بين المساحة الحرة الحالية والحد الذي يحدده المستخدم.'],
  [10, 'Export storage report', 'تصدير تقرير التخزين', 'Export the current measured scan snapshot as a JSON evidence report in protected application data.', 'تصدير لقطة الفحص المقاسة الحالية كتقرير أدلة JSON داخل بيانات التطبيق المحمية.'],
];
for (const [number, nameEn, nameAr, descriptionEn, descriptionAr] of module04Names) {
  renameService('m04', number, nameEn, nameAr, descriptionEn, descriptionAr);
}

const m04States: Array<[number, string, KnouxCapability['implementationState'], string, string, boolean]> = [
  [1, 'm04.storage.scan', 'implemented', 'Real recursive measurement, bounded evidence, progress, and cancellation are connected.', 'تم ربط القياس الحقيقي المتكرر والأدلة المحدودة والتقدم والإلغاء.', true],
  [2, 'm04.files.largest', 'implemented', 'Largest-file ranking is calculated from the real selected-path scan.', 'يتم حساب ترتيب أكبر الملفات من الفحص الحقيقي للمسار المحدد.', true],
  [3, 'm04.folders.largest', 'implemented', 'Recursive folder totals are derived from measured files with a bounded directory map.', 'يتم اشتقاق إجماليات المجلدات من الملفات المقاسة مع حد آمن لخريطة المجلدات.', true],
  [4, 'm04.types.distribution', 'implemented', 'File-category and extension totals are calculated from real metadata without reading contents.', 'يتم حساب إجماليات فئات الملفات وامتداداتها من البيانات الوصفية الحقيقية دون قراءة المحتوى.', true],
  [5, 'm04.files.old', 'partial', 'Old-file evidence uses modification time because reliable last-access tracking is not guaranteed on Windows.', 'تعتمد أدلة الملفات القديمة على تاريخ التعديل لأن تتبع آخر وصول ليس مضمونًا في ويندوز.', true],
  [6, 'm04.downloads.analyze', 'implemented', 'The real current-user Downloads directory is discovered and measured.', 'يتم اكتشاف مجلد التنزيلات الحقيقي للمستخدم الحالي وقياسه.', true],
  [7, 'm04.appdata.analyze', 'implemented', 'The real current-user Local AppData directory is measured read-only.', 'يتم قياس مجلد Local AppData الحقيقي للمستخدم الحالي للقراءة فقط.', true],
  [8, 'm04.drives.external', 'partial', 'Windows logical-drive inventory and capacity are connected; exhaustive disconnected-media and network-share discovery is not.', 'تم ربط جرد الأقراص المنطقية وسعتها في ويندوز، دون اكتشاف شامل للوسائط غير المتصلة ومشاركات الشبكة.', false],
  [9, 'm04.space.check', 'partial', 'A real one-time threshold check is connected; background notifications are not enabled.', 'تم ربط فحص حقيقي لحظي للحد، بينما إشعارات الخلفية غير مفعلة.', false],
  [10, 'm04.report.export', 'partial', 'Measured JSON report export is connected; PDF generation remains unimplemented.', 'تم ربط تصدير التقرير المقاس بصيغة JSON، بينما إنشاء PDF غير منفذ.', false],
];
for (const [number, handlerId, implementationState, availabilityReasonEn, availabilityReasonAr, supportsCancel] of m04States) {
  patchService('m04', number, {
    handlerId,
    implementationState,
    status: 'available',
    availabilityReasonEn,
    availabilityReasonAr,
    requiresAdmin: false,
    runtime: 'desktop',
    supportsPreview: true,
    supportsDryRun: true,
    supportsCancel,
    supportsUndo: false,
    supportsQuarantine: false,
  });
}

const module15 = catalog.find(item => item.id === 'm15');
if (module15) {
  module15.nameEn = 'KNOUX Developer Studio';
  module15.nameAr = 'استوديو المطورين KNOUX';
  module15.descriptionEn = 'A local-first Windows workspace for toolchains, runtimes, Git, repositories, ports, project health, caches, HTTP testing, and evidence reports.';
  module15.descriptionAr = 'مساحة عمل محلية لويندوز لإدارة أدوات التطوير وبيئات التشغيل وGit والمستودعات والمنافذ وصحة المشروعات والكاش واختبار HTTP والتقارير.';
}

const module15Names: Array<[number, string, string, string, string]> = [
  [1, 'Workstation Toolchain Discovery', 'اكتشاف أدوات محطة التطوير', 'Resolve real executable paths and versions for major compilers, runtimes, package managers, containers, and editors.', 'اكتشاف المسارات التنفيذية والإصدارات الحقيقية للمترجمات وبيئات التشغيل ومديري الحزم والحاويات والمحررات.'],
  [2, 'PATH Diagnostics Laboratory', 'مختبر تشخيص PATH', 'Audit user and machine PATH entries, variable expansion, missing folders, and normalized duplicates without editing the registry.', 'تدقيق PATH للمستخدم والنظام وتوسيع المتغيرات واكتشاف المسارات المفقودة والمكررة دون تعديل السجل.'],
  [3, 'Runtime & Version Manager Inspector', 'فاحص مديري الإصدارات', 'Detect NVM, FNM, Volta, pyenv-win, Rustup, and developer home variables.', 'اكتشاف NVM وFNM وVolta وpyenv-win وRustup ومتغيرات مجلدات التطوير.'],
  [4, 'Secure Git Configuration Audit', 'تدقيق إعدادات Git الآمن', 'Inspect selected global Git configuration without collecting passwords, tokens, or credential payloads.', 'فحص إعدادات Git العامة المحددة دون جمع كلمات المرور أو الرموز أو بيانات الاعتماد.'],
  [5, 'Repository Intelligence Scanner', 'ماسح ذكاء المستودعات', 'Discover Git repositories and report branch, dirty state, upstream divergence, redacted remote, and latest commit.', 'اكتشاف مستودعات Git وعرض الفرع والتغييرات والانحراف والرابط المنقح وآخر التزام.'],
  [6, 'Ports & Process Control', 'التحكم في المنافذ والعمليات', 'Inspect TCP/UDP listeners and terminate user-approved non-protected processes with exact confirmation.', 'فحص منافذ TCP وUDP وإنهاء العمليات غير المحمية بعد تأكيد المستخدم الدقيق.'],
  [7, 'Multi-Ecosystem Project Health', 'صحة المشروعات متعددة البيئات', 'Discover Node, Rust, Python, Go, Java, and .NET projects and validate manifests and lockfiles.', 'اكتشاف مشروعات Node وRust وPython وGo وJava و.NET والتحقق من ملفات المشروع والقفل.'],
  [8, 'Developer Cache Control', 'إدارة كاش المطور', 'Measure and clean allowlisted package-manager and build caches with typed confirmation.', 'قياس وتنظيف كاش مديري الحزم والبناء المسموح به بعد تأكيد كتابي.'],
  [9, 'Local HTTP & API Laboratory', 'مختبر HTTP وواجهات API', 'Execute explicit HTTP/HTTPS requests with timeout, headers, body, response timing, and bounded previews.', 'تنفيذ طلبات HTTP وHTTPS مع المهلة والترويسات والمحتوى وقياس الاستجابة ومعاينة محدودة.'],
  [10, 'Developer Evidence Report', 'تقرير أدلة بيئة التطوير', 'Export the loaded developer evidence as JSON or Markdown inside protected application data.', 'تصدير أدلة بيئة التطوير المحملة بصيغة JSON أو Markdown داخل بيانات التطبيق المحمية.'],
];
const m15Handlers = [
  'm15.environment.discover',
  'm15.path.audit',
  'm15.runtime.inspect',
  'm15.git.audit',
  'm15.repositories.scan',
  'm15.ports.manage',
  'm15.projects.audit',
  'm15.caches.manage',
  'm15.http.execute',
  'm15.report.export',
];
for (const [number, nameEn, nameAr, descriptionEn, descriptionAr] of module15Names) {
  renameService('m15', number, nameEn, nameAr, descriptionEn, descriptionAr);
  patchService('m15', number, {
    handlerId: m15Handlers[number - 1],
    status: 'available',
    implementationState: 'implemented',
    availabilityReasonEn: 'Connected to an explicit allowlisted native Windows handler with honest web fallback.',
    availabilityReasonAr: 'متصلة بأمر ويندوز محلي صريح ومسموح مع حالة صادقة في نسخة الويب.',
    requiresAdmin: false,
    supportsPreview: true,
    supportsDryRun: number !== 9,
    supportsCancel: false,
    supportsUndo: false,
  });
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
