import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AppWindow,
  Archive,
  Boxes,
  Braces,
  BriefcaseBusiness,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Cpu,
  Database,
  Download,
  FileArchive,
  FileClock,
  FileCog,
  FileSearch,
  FolderCog,
  Gauge,
  GitBranch,
  HardDrive,
  Import,
  Layers3,
  ListChecks,
  MonitorCog,
  Network,
  PackageCheck,
  PanelTop,
  RefreshCw,
  Rocket,
  ScanSearch,
  Settings2,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  Upload,
  WandSparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import type { ImplementationState, KnouxCapability } from '../../types';

export const MODULE_ROUTE_MAP: Record<string, string> = {
  m01: 'first-run',
  m02: 'cleanup',
  m03: 'duplicates',
  m04: 'storage',
  m05: 'startup',
  m06: 'performance',
  m07: 'repair',
  m08: 'network',
  m09: 'privacy',
  m10: 'security',
  m11: 'backup',
  m12: 'applications',
  m13: 'file-tools',
  m14: 'automation',
  m15: 'developer',
  m16: 'project-tools',
  m17: 'diagnostics',
  m18: 'hardware',
  m19: 'cloud',
};

export const MODULE_ICONS: Record<string, LucideIcon> = {
  m01: Rocket,
  m02: Trash2,
  m03: Copy,
  m04: HardDrive,
  m05: SlidersHorizontal,
  m06: Gauge,
  m07: Wrench,
  m08: Network,
  m09: ShieldEllipsis,
  m10: ShieldCheck,
  m11: Archive,
  m12: AppWindow,
  m13: FileCog,
  m14: WandSparkles,
  m15: TerminalSquare,
  m16: Braces,
  m17: Activity,
  m18: Cpu,
  m19: Cloud,
};

export const MODULE_ACCENTS: Record<string, string> = {
  m01: 'violet',
  m02: 'emerald',
  m03: 'blue',
  m04: 'cyan',
  m05: 'amber',
  m06: 'blue',
  m07: 'rose',
  m08: 'cyan',
  m09: 'violet',
  m10: 'emerald',
  m11: 'blue',
  m12: 'violet',
  m13: 'amber',
  m14: 'violet',
  m15: 'cyan',
  m16: 'blue',
  m17: 'rose',
  m18: 'emerald',
  m19: 'violet',
};

const includesAny = (value: string, words: string[]) => words.some(word => value.includes(word));

export function getServiceIcon(capability: KnouxCapability): LucideIcon {
  const value = `${capability.nameEn} ${capability.descriptionEn}`.toLowerCase();

  if (includesAny(value, ['install', 'package', 'software catalog', 'application'])) return PackageCheck;
  if (includesAny(value, ['uninstall', 'remove', 'delete', 'cleanup', 'temporary'])) return Trash2;
  if (includesAny(value, ['update', 'upgrade', 'refresh', 'renew'])) return RefreshCw;
  if (includesAny(value, ['repair', 'restore', 'reset', 'fix'])) return Wrench;
  if (includesAny(value, ['scan', 'discover', 'detect', 'inspect', 'diagnostic'])) return ScanSearch;
  if (includesAny(value, ['export', 'backup'])) return Upload;
  if (includesAny(value, ['import'])) return Import;
  if (includesAny(value, ['duplicate', 'compare'])) return Copy;
  if (includesAny(value, ['archive', 'compress', 'extract'])) return FileArchive;
  if (includesAny(value, ['storage', 'disk', 'drive'])) return HardDrive;
  if (includesAny(value, ['network', 'dns', 'ping', 'proxy', 'internet'])) return Network;
  if (includesAny(value, ['security', 'defender', 'firewall', 'secure boot', 'tpm'])) return ShieldCheck;
  if (includesAny(value, ['process', 'startup', 'service', 'performance'])) return Gauge;
  if (includesAny(value, ['git', 'code', 'project', 'json', 'yaml', 'api'])) return Code2;
  if (includesAny(value, ['profile', 'workflow', 'automation', 'schedule'])) return Settings2;
  if (includesAny(value, ['log', 'history', 'report'])) return FileClock;
  if (includesAny(value, ['cloud', 'sync', 'support', 'license'])) return Cloud;
  return Boxes;
}

export type ActionKind =
  | 'inspect'
  | 'install'
  | 'update'
  | 'repair'
  | 'clean'
  | 'create'
  | 'export'
  | 'import'
  | 'manage'
  | 'analyze'
  | 'open';

export function getActionKind(capability: KnouxCapability): ActionKind {
  const value = capability.nameEn.toLowerCase();
  if (includesAny(value, ['install'])) return 'install';
  if (includesAny(value, ['update', 'upgrade'])) return 'update';
  if (includesAny(value, ['repair', 'restore', 'reset'])) return 'repair';
  if (includesAny(value, ['cleanup', 'clean', 'delete', 'remove'])) return 'clean';
  if (includesAny(value, ['create', 'generate'])) return 'create';
  if (includesAny(value, ['export', 'backup'])) return 'export';
  if (includesAny(value, ['import'])) return 'import';
  if (includesAny(value, ['manage', 'control', 'editor', 'profiles', 'queue'])) return 'manage';
  if (includesAny(value, ['analy', 'scan', 'detect', 'discover', 'diagnostic', 'monitor'])) return 'analyze';
  return 'inspect';
}

export function getActionLabel(capability: KnouxCapability, language: 'en' | 'ar'): string {
  const kind = getActionKind(capability);
  const labels: Record<ActionKind, { en: string; ar: string }> = {
    inspect: { en: 'Review service', ar: 'مراجعة الخدمة' },
    install: { en: 'Install', ar: 'تثبيت' },
    update: { en: 'Check updates', ar: 'فحص التحديثات' },
    repair: { en: 'Review repair', ar: 'مراجعة الإصلاح' },
    clean: { en: 'Review cleanup', ar: 'مراجعة التنظيف' },
    create: { en: 'Create', ar: 'إنشاء' },
    export: { en: 'Export', ar: 'تصدير' },
    import: { en: 'Import', ar: 'استيراد' },
    manage: { en: 'Open manager', ar: 'فتح الإدارة' },
    analyze: { en: 'Start analysis', ar: 'بدء التحليل' },
    open: { en: 'Open', ar: 'فتح' },
  };
  return labels[kind][language];
}

export function getImplementationLabel(state: ImplementationState | undefined, language: 'en' | 'ar'): string {
  const value = state ?? 'planned';
  const labels: Record<ImplementationState, { en: string; ar: string }> = {
    implemented: { en: 'Ready', ar: 'جاهزة' },
    partial: { en: 'Desktop preview', ar: 'معاينة سطح المكتب' },
    planned: { en: 'Roadmap', ar: 'ضمن الخطة' },
    requires_configuration: { en: 'Setup required', ar: 'تحتاج إعدادًا' },
    unsupported: { en: 'Unavailable', ar: 'غير متاحة' },
  };
  return labels[value][language];
}

export function getImplementationIcon(state: ImplementationState | undefined): LucideIcon {
  switch (state) {
    case 'implemented':
      return CheckCircle2;
    case 'partial':
      return PanelTop;
    case 'requires_configuration':
      return Settings2;
    case 'unsupported':
      return ShieldEllipsis;
    default:
      return FileClock;
  }
}

export function getModuleSummary(moduleId: string, language: 'en' | 'ar'): string {
  const summaries: Record<string, { en: string; ar: string }> = {
    m01: { en: 'Prepare a fresh Windows installation and install essential software.', ar: 'تجهيز ويندوز بعد الفورمات وتثبيت البرامج الأساسية.' },
    m02: { en: 'Review safe cleanup opportunities before removing temporary data.', ar: 'مراجعة فرص التنظيف الآمن قبل حذف البيانات المؤقتة.' },
    m03: { en: 'Find exact and similar duplicate files with keeper controls.', ar: 'اكتشاف الملفات المكررة والمتشابهة مع اختيار النسخة الأساسية.' },
    m04: { en: 'Understand where disk space is used and locate the largest items.', ar: 'فهم استهلاك مساحة التخزين والوصول إلى أكبر الملفات والمجلدات.' },
    m05: { en: 'Control startup entries, scheduled tasks, and Windows services.', ar: 'إدارة عناصر بدء التشغيل والمهام المجدولة وخدمات ويندوز.' },
    m06: { en: 'Monitor resources, processes, power plans, and device performance.', ar: 'متابعة الموارد والعمليات وخطط الطاقة وأداء الجهاز.' },
    m07: { en: 'Run focused Windows integrity and component repair workflows.', ar: 'تشغيل مسارات إصلاح دقيقة لسلامة ويندوز ومكوناته.' },
    m08: { en: 'Inspect adapters and run targeted network diagnostics and repairs.', ar: 'فحص محولات الشبكة وتشغيل التشخيصات والإصلاحات المستهدفة.' },
    m09: { en: 'Review Windows privacy permissions and reversible controls.', ar: 'مراجعة أذونات الخصوصية وإعدادات التحكم القابلة للاستعادة.' },
    m10: { en: 'Inspect Defender, Firewall, UAC, Secure Boot, and TPM state.', ar: 'فحص Defender والجدار الناري وUAC وSecure Boot وTPM.' },
    m11: { en: 'Create verified backups, restore points, and recovery bundles.', ar: 'إنشاء نسخ احتياطية ونقاط استعادة وحزم تعافٍ قابلة للتحقق.' },
    m12: { en: 'Manage installed applications, updates, and device drivers.', ar: 'إدارة البرامج المثبتة والتحديثات وتعريفات الأجهزة.' },
    m13: { en: 'Rename, compare, archive, hash, and convert local files.', ar: 'إعادة تسمية الملفات ومقارنتها وأرشفتها وتشفيرها وتحويلها.' },
    m14: { en: 'Build reusable workflows, schedules, snippets, and workspaces.', ar: 'إنشاء مسارات عمل وجداول ومقتطفات ومساحات عمل قابلة لإعادة الاستخدام.' },
    m15: { en: 'Inspect and maintain developer tools, runtimes, PATH, and ports.', ar: 'فحص وصيانة أدوات التطوير والبيئات ومسار PATH والمنافذ.' },
    m16: { en: 'Work with repositories, dependencies, project data, and APIs.', ar: 'العمل مع المستودعات والاعتماديات وبيانات المشروعات وواجهات API.' },
    m17: { en: 'Review event logs, crashes, update failures, and support reports.', ar: 'مراجعة سجلات الأحداث والأعطال ومشاكل التحديث وتقارير الدعم.' },
    m18: { en: 'Inspect CPU, GPU, memory, disks, battery, BIOS, and sensors.', ar: 'فحص المعالج والرسوميات والذاكرة والأقراص والبطارية وBIOS والمستشعرات.' },
    m19: { en: 'Access KNOUX account, release, feedback, and support capabilities.', ar: 'الوصول إلى حساب كنوكس والإصدارات والملاحظات وخدمات الدعم.' },
  };
  return (summaries[moduleId] ?? { en: 'Open this KNOUX workspace.', ar: 'فتح مساحة عمل كنوكس.' })[language];
}

export const WORKSPACE_DECORATIVE_ICONS = {
  activity: Activity,
  database: Database,
  layers: Layers3,
  list: ListChecks,
  monitor: MonitorCog,
  folder: FolderCog,
  branch: GitBranch,
  search: FileSearch,
  briefcase: BriefcaseBusiness,
  zap: Zap,
  download: Download,
  sparkles: Sparkles,
};
