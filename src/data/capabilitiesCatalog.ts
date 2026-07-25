/**
 * KNOUX ONE — Authoritative capability catalog.
 *
 * The original generated catalog is retained only as a bilingual content seed in
 * `legacyCapabilitiesSeed.ts`. This module is the sole production export and
 * applies verified implementation states and explicit allowlisted handler IDs.
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

function renameService(moduleId: string, serviceNumber: number, nameEn: string, nameAr: string, descriptionEn: string, descriptionAr: string) {
  patchService(moduleId, serviceNumber, { nameEn, nameAr, descriptionEn, descriptionAr });
}

// Module 01: only verified commands remain executable.
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
    supportsQuarantine: number === 1 || number === 4 || number === 5 || number === 6 || number === 7 || number === 10,
  });
}

// Modules 15 and 16 remain explicitly planned in this phase. They expose no native handlers.
for (const moduleId of ['m15', 'm16']) {
  const module = catalog.find(item => item.id === moduleId);
  module?.services.forEach(service => {
    service.handlerId = undefined;
    service.status = 'planned';
    service.implementationState = 'planned';
    service.availabilityReasonEn = `Module ${moduleId.slice(1)} is reserved for its dedicated independently verified phase.`;
    service.availabilityReasonAr = `القسم ${Number(moduleId.slice(1))} محجوز لمرحلته المستقلة الخاضعة للتحقق.`;
  });
}

export const MODULES_CATALOG: KnouxModule[] = catalog;
export const ALL_CAPABILITIES: KnouxCapability[] = MODULES_CATALOG.flatMap(module => module.services);
export const CAPABILITY_BY_ID = new Map(ALL_CAPABILITIES.map(capability => [capability.id, capability]));
