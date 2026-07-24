import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AppWindow,
  Archive,
  Braces,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Code2,
  Copy,
  Cpu,
  FileCog,
  Gauge,
  Grid3X3,
  HardDrive,
  HelpCircle,
  History,
  Info,
  LayoutDashboard,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Rocket,
  Settings,
  ShieldCheck,
  ShieldEllipsis,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  WandSparkles,
  Wrench,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { getOfficialKnouxLogo } from '../../data/officialBrand';

interface NavItem {
  id: string;
  route: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: React.ElementType;
}

interface NavGroup {
  id: string;
  titleEn: string;
  titleAr: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    id: 'overview',
    titleEn: 'Overview',
    titleAr: 'الرئيسية',
    items: [
      { id: 'dashboard', route: 'dashboard', titleEn: 'Dashboard', titleAr: 'لوحة التحكم', descriptionEn: 'Device overview and recommendations', descriptionAr: 'نظرة عامة وتوصيات الجهاز', icon: LayoutDashboard },
      { id: 'first-run', route: 'first-run', titleEn: 'First-time setup', titleAr: 'الإعداد لأول مرة', descriptionEn: 'Prepare KNOUX ONE for this device', descriptionAr: 'تجهيز كنوكس ون لهذا الجهاز', icon: Sparkles },
      { id: 'post-format', route: 'post-format', titleEn: 'After-format setup', titleAr: 'إعداد ما بعد الفورمات', descriptionEn: 'Install essential software and profiles', descriptionAr: 'تثبيت البرامج الأساسية والبروفايلات', icon: Rocket },
      { id: 'catalog', route: 'catalog', titleEn: 'Workspace library', titleAr: 'مكتبة مساحات العمل', descriptionEn: 'Browse all modules and services', descriptionAr: 'استعراض جميع الأقسام والخدمات', icon: Grid3X3 },
      { id: 'support', route: 'support', titleEn: 'Activity & support', titleAr: 'العمليات والدعم', descriptionEn: 'History, reports, and support drafts', descriptionAr: 'السجل والتقارير ومسودات الدعم', icon: History },
    ],
  },
  {
    id: 'system-care',
    titleEn: 'System care',
    titleAr: 'العناية بالنظام',
    items: [
      { id: 'cleanup', route: 'cleanup', titleEn: 'Smart cleanup', titleAr: 'التنظيف الذكي', descriptionEn: 'Review safe cleanup opportunities', descriptionAr: 'مراجعة فرص التنظيف الآمن', icon: Trash2 },
      { id: 'duplicates', route: 'duplicates', titleEn: 'Duplicate finder', titleAr: 'الملفات المكررة', descriptionEn: 'Find exact and similar copies', descriptionAr: 'اكتشاف النسخ المتطابقة والمتشابهة', icon: Copy },
      { id: 'storage', route: 'storage', titleEn: 'Storage analyzer', titleAr: 'تحليل التخزين', descriptionEn: 'Understand disk usage', descriptionAr: 'فهم استهلاك مساحة القرص', icon: HardDrive },
      { id: 'startup', route: 'startup', titleEn: 'Startup & services', titleAr: 'بدء التشغيل والخدمات', descriptionEn: 'Manage startup behavior', descriptionAr: 'إدارة بدء التشغيل والخدمات', icon: SlidersHorizontal },
      { id: 'performance', route: 'performance', titleEn: 'Performance center', titleAr: 'مركز الأداء', descriptionEn: 'Monitor resources and processes', descriptionAr: 'متابعة الموارد والعمليات', icon: Gauge },
    ],
  },
  {
    id: 'windows-security',
    titleEn: 'Windows & security',
    titleAr: 'ويندوز والأمان',
    items: [
      { id: 'repair', route: 'repair', titleEn: 'Windows repair', titleAr: 'إصلاح ويندوز', descriptionEn: 'Integrity and component repair', descriptionAr: 'إصلاح سلامة النظام ومكوناته', icon: Wrench },
      { id: 'network', route: 'network', titleEn: 'Network & internet', titleAr: 'الشبكة والإنترنت', descriptionEn: 'Diagnostics and targeted repairs', descriptionAr: 'التشخيص والإصلاحات المستهدفة', icon: Network },
      { id: 'privacy', route: 'privacy', titleEn: 'Privacy center', titleAr: 'مركز الخصوصية', descriptionEn: 'Review reversible privacy controls', descriptionAr: 'مراجعة إعدادات الخصوصية القابلة للاستعادة', icon: ShieldEllipsis },
      { id: 'security', route: 'security', titleEn: 'Security center', titleAr: 'مركز الأمان', descriptionEn: 'Defender, Firewall, UAC, TPM', descriptionAr: 'Defender والجدار الناري وUAC وTPM', icon: ShieldCheck },
      { id: 'backup', route: 'backup', titleEn: 'Backup & recovery', titleAr: 'النسخ والاستعادة', descriptionEn: 'Backups, restore points, recovery', descriptionAr: 'النسخ الاحتياطي ونقاط الاستعادة', icon: Archive },
    ],
  },
  {
    id: 'apps-tools',
    titleEn: 'Applications & tools',
    titleAr: 'التطبيقات والأدوات',
    items: [
      { id: 'applications', route: 'applications', titleEn: 'Apps & drivers', titleAr: 'البرامج والتعريفات', descriptionEn: 'Install, update, and review drivers', descriptionAr: 'تثبيت البرامج وتحديثها ومراجعة التعريفات', icon: AppWindow },
      { id: 'file-tools', route: 'file-tools', titleEn: 'File utilities', titleAr: 'أدوات الملفات', descriptionEn: 'Rename, compare, archive, hash', descriptionAr: 'إعادة التسمية والمقارنة والأرشفة', icon: FileCog },
      { id: 'automation', route: 'automation', titleEn: 'Automation', titleAr: 'الأتمتة والإنتاجية', descriptionEn: 'Workflows, schedules, workspaces', descriptionAr: 'مسارات العمل والجداول ومساحات العمل', icon: WandSparkles },
    ],
  },
  {
    id: 'developer',
    titleEn: 'Development & diagnostics',
    titleAr: 'التطوير والتشخيص',
    items: [
      { id: 'developer', route: 'developer', titleEn: 'Developer studio', titleAr: 'استوديو المطور', descriptionEn: 'Runtimes, PATH, tools, ports', descriptionAr: 'البيئات وPATH والأدوات والمنافذ', icon: TerminalSquare },
      { id: 'project-tools', route: 'project-tools', titleEn: 'Code & projects', titleAr: 'الكود والمشروعات', descriptionEn: 'Repositories, dependencies, APIs', descriptionAr: 'المستودعات والاعتماديات وواجهات API', icon: Braces },
      { id: 'diagnostics', route: 'diagnostics', titleEn: 'Logs & diagnostics', titleAr: 'السجلات والتشخيص', descriptionEn: 'Events, crashes, update failures', descriptionAr: 'الأحداث والأعطال ومشاكل التحديث', icon: Activity },
      { id: 'hardware', route: 'hardware', titleEn: 'Hardware health', titleAr: 'صحة الجهاز والمكونات', descriptionEn: 'CPU, GPU, memory, disks, battery', descriptionAr: 'المعالج والرسوميات والذاكرة والأقراص', icon: Cpu },
    ],
  },
  {
    id: 'knoux',
    titleEn: 'KNOUX',
    titleAr: 'كنوكس',
    items: [
      { id: 'cloud', route: 'cloud', titleEn: 'Cloud & support', titleAr: 'السحابة والدعم', descriptionEn: 'Account and support capabilities', descriptionAr: 'خدمات الحساب والدعم', icon: Cloud },
      { id: 'settings', route: 'settings', titleEn: 'Settings', titleAr: 'الإعدادات', descriptionEn: 'Appearance, language, accessibility', descriptionAr: 'المظهر واللغة وإمكانية الوصول', icon: Settings },
      { id: 'about', route: 'about', titleEn: 'About KNOUX ONE', titleAr: 'عن كنوكس ون', descriptionEn: 'Product identity and architecture', descriptionAr: 'هوية المنتج ومعماريته', icon: Info },
    ],
  },
];

export const Sidebar: React.FC = () => {
  const { currentRoute, setCurrentRoute, t, theme } = useKnoux();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('knoux.sidebar.collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
      return;
    }
    setCollapsed(window.innerWidth < 1420);
  }, []);

  useEffect(() => {
    window.localStorage.setItem('knoux.sidebar.collapsed', String(collapsed));
  }, [collapsed]);

  const activeGroup = useMemo(
    () => GROUPS.find(group => group.items.some(item => item.route === currentRoute))?.id,
    [currentRoute],
  );

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(previous => ({ ...previous, [groupId]: !previous[groupId] }));
  };

  return (
    <aside className={`knoux-sidebar-shell flex h-full shrink-0 flex-col transition-[width] duration-300 ${collapsed ? 'w-[82px]' : 'w-[264px]'}`}>
      <div className="border-b border-[var(--knoux-border)] p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3 rounded-2xl p-2`}>
          <button
            type="button"
            onClick={() => setCurrentRoute('dashboard')}
            className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-3'} text-start`}
            title={t('Open dashboard', 'فتح لوحة التحكم')}
          >
            <div className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--knoux-glass-border-strong)] bg-[var(--knoux-surface-elevated)] shadow-[0_10px_28px_rgba(139,92,246,.2)]">
              {!logoFailed ? (
                <img
                  src={getOfficialKnouxLogo(theme)}
                  alt="KNOUX ONE"
                  className="h-full w-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <span className="text-base font-black text-[var(--knoux-primary-bright)]">K</span>
              )}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-[15px] font-black tracking-[-.02em] text-[var(--knoux-text)]">KNOUX ONE</p>
                <p className="truncate text-[11px] font-semibold text-[var(--knoux-text-muted)]">{t('Windows Intelligence Suite', 'منظومة ذكاء ويندوز')}</p>
              </div>
            )}
          </button>

          {!collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)] transition hover:border-[var(--knoux-primary)]/35 hover:text-[var(--knoux-primary-bright)]"
              title={t('Collapse navigation', 'طي القائمة')}
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {collapsed && (
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="grid h-11 w-full place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-primary-bright)] transition hover:border-[var(--knoux-primary)]/40"
            title={t('Expand navigation', 'توسيع القائمة')}
          >
            <PanelLeftOpen className="h-5 w-5" />
          </button>
        </div>
      )}

      <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-4">
          {GROUPS.map(group => {
            const groupCollapsed = collapsedGroups[group.id];
            const groupActive = activeGroup === group.id;
            return (
              <section key={group.id}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className={`mb-1.5 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-[.1em] transition ${groupActive ? 'text-[var(--knoux-primary-bright)]' : 'text-[var(--knoux-text-muted)] hover:text-[var(--knoux-text-secondary)]'}`}
                  >
                    <span>{t(group.titleEn, group.titleAr)}</span>
                    {groupCollapsed ? <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}

                {(!groupCollapsed || collapsed) && (
                  <div className="space-y-1.5">
                    {group.items.map(item => {
                      const Icon = item.icon;
                      const active = currentRoute === item.route;
                      return (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => setCurrentRoute(item.route)}
                          title={collapsed ? t(item.titleEn, item.titleAr) : undefined}
                          className={`group relative flex w-full items-center rounded-xl border text-start transition-all duration-150 ${collapsed ? 'h-11 justify-center px-2' : 'min-h-[48px] gap-3 px-3 py-2'} ${active ? 'border-[var(--knoux-primary)]/35 bg-[linear-gradient(135deg,rgba(139,92,246,.18),rgba(76,141,255,.07))] text-[var(--knoux-text)] shadow-[0_10px_24px_rgba(139,92,246,.12)]' : 'border-transparent text-[var(--knoux-text-secondary)] hover:border-[var(--knoux-border)] hover:bg-[var(--knoux-surface-muted)] hover:text-[var(--knoux-text)]'}`}
                        >
                          {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[linear-gradient(to_bottom,var(--knoux-primary-bright),var(--knoux-accent-blue))]" />}
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition ${active ? 'bg-[var(--knoux-primary)]/18 text-[var(--knoux-primary-bright)]' : 'bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)] group-hover:text-[var(--knoux-primary-bright)]'}`}>
                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                          </span>
                          {!collapsed && (
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-bold">{t(item.titleEn, item.titleAr)}</span>
                              <span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--knoux-text-muted)]">{t(item.descriptionEn, item.descriptionAr)}</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[var(--knoux-border)] p-3">
        <div className={`rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] ${collapsed ? 'p-2' : 'p-3'}`}>
          {collapsed ? (
            <div className="grid place-items-center text-[var(--knoux-primary-bright)]">
              <Code2 className="h-5 w-5" />
            </div>
          ) : (
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(135deg,var(--knoux-primary),var(--knoux-accent-blue))] text-[12px] font-black text-white">SE</div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-extrabold text-[var(--knoux-text)]">Eng. Sadek Elgazar</p>
                <p className="truncate text-[10px] font-semibold text-[var(--knoux-primary-bright)]">Knoux • Abu Dhabi</p>
              </div>
              <HelpCircle className="ms-auto h-4 w-4 text-[var(--knoux-text-muted)]" />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
