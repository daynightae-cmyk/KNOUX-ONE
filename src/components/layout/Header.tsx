import React, { useMemo } from 'react';
import {
  Bell,
  Command,
  Languages,
  Monitor,
  Moon,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { NativeClient } from '../../services/nativeClient';

const ROUTE_TITLES: Record<string, { en: string; ar: string }> = {
  dashboard: { en: 'Dashboard', ar: 'لوحة التحكم' },
  'first-run': { en: 'First-time setup', ar: 'الإعداد لأول مرة' },
  'post-format': { en: 'After-format setup', ar: 'إعداد ما بعد الفورمات' },
  cleanup: { en: 'Smart cleanup', ar: 'التنظيف الذكي' },
  duplicates: { en: 'Duplicate finder', ar: 'الملفات المكررة' },
  storage: { en: 'Storage analyzer', ar: 'تحليل التخزين' },
  startup: { en: 'Startup & services', ar: 'بدء التشغيل والخدمات' },
  performance: { en: 'Performance center', ar: 'مركز الأداء' },
  repair: { en: 'Windows repair', ar: 'إصلاح ويندوز' },
  network: { en: 'Network & internet', ar: 'الشبكة والإنترنت' },
  privacy: { en: 'Privacy center', ar: 'مركز الخصوصية' },
  security: { en: 'Security center', ar: 'مركز الأمان' },
  backup: { en: 'Backup & recovery', ar: 'النسخ والاستعادة' },
  applications: { en: 'Applications & drivers', ar: 'البرامج والتعريفات' },
  'file-tools': { en: 'File utilities', ar: 'أدوات الملفات' },
  automation: { en: 'Automation & productivity', ar: 'الأتمتة والإنتاجية' },
  developer: { en: 'Developer studio', ar: 'استوديو المطور' },
  'project-tools': { en: 'Code & project tools', ar: 'أدوات الكود والمشروعات' },
  diagnostics: { en: 'Logs & diagnostics', ar: 'السجلات والتشخيص' },
  hardware: { en: 'Hardware health', ar: 'صحة الجهاز والمكونات' },
  cloud: { en: 'Cloud & support', ar: 'السحابة والدعم' },
  catalog: { en: 'Workspace library', ar: 'مكتبة مساحات العمل' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
  about: { en: 'About KNOUX ONE', ar: 'عن كنوكس ون' },
};

export const Header: React.FC = () => {
  const {
    currentRoute,
    theme,
    setTheme,
    language,
    setLanguage,
    setCommandPaletteOpen,
    runSmartScan,
    isScanning,
    notificationCount,
    clearNotifications,
    systemSpecs,
    t,
  } = useKnoux();

  const runtime = NativeClient.getRuntimeState();
  const routeTitle = ROUTE_TITLES[currentRoute] ?? ROUTE_TITLES.dashboard;
  const deviceLabel = useMemo(() => {
    if (!runtime.available) return t('Web preview workspace', 'مساحة معاينة الويب');
    return systemSpecs.computerName || t('Windows device', 'جهاز ويندوز');
  }, [runtime.available, systemSpecs.computerName, t]);

  return (
    <header className="knoux-topbar-shell flex shrink-0 items-center gap-4 px-4 md:px-5">
      <div className="min-w-0 shrink-0">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--knoux-text-muted)]">KNOUX ONE</p>
        <div className="mt-0.5 flex items-center gap-2 rtl:flex-row-reverse">
          <h1 className="truncate text-[16px] font-black tracking-[-.02em] text-[var(--knoux-text)]">{t(routeTitle.en, routeTitle.ar)}</h1>
          <span className="hidden rounded-full border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--knoux-text-muted)] lg:inline-flex">v3.0</span>
        </div>
      </div>

      <div className="hidden h-9 items-center gap-2 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-3 xl:flex rtl:flex-row-reverse">
        <Monitor className="h-4 w-4 text-[var(--knoux-primary-bright)]" />
        <span className="max-w-[170px] truncate text-[12px] font-bold text-[var(--knoux-text)]">{deviceLabel}</span>
        <span className={`h-2 w-2 rounded-full ${runtime.available ? 'bg-[var(--knoux-success)] shadow-[0_0_12px_var(--knoux-success)]' : 'bg-[var(--knoux-warning)]'}`} />
      </div>

      <button
        type="button"
        onClick={() => setCommandPaletteOpen(true)}
        className="group mx-auto hidden min-h-[44px] min-w-0 max-w-[520px] flex-1 items-center gap-3 rounded-[14px] border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-4 text-start transition hover:border-[var(--knoux-primary)]/35 hover:bg-[var(--knoux-surface-elevated)] md:flex rtl:flex-row-reverse"
      >
        <Search className="h-[18px] w-[18px] shrink-0 text-[var(--knoux-primary-bright)]" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--knoux-text-muted)] group-hover:text-[var(--knoux-text-secondary)]">
          {t('Search workspaces, services, settings, and activity…', 'ابحث في الأقسام والخدمات والإعدادات والعمليات…')}
        </span>
        <kbd className="hidden items-center gap-1 rounded-lg border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-2 py-1 font-mono text-[10px] font-bold text-[var(--knoux-primary-bright)] lg:inline-flex">
          <Command className="h-3 w-3" /> K
        </kbd>
      </button>

      <div className="ms-auto flex shrink-0 items-center gap-2 rtl:me-auto rtl:ms-0 rtl:flex-row-reverse">
        <button
          type="button"
          onClick={runSmartScan}
          disabled={isScanning}
          className="knoux-card-action knoux-card-action--primary hidden min-w-[128px] md:inline-flex"
        >
          <Sparkles className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? t('Reading device…', 'جاري قراءة الجهاز…') : t('Device scan', 'فحص الجهاز')}</span>
        </button>

        <div className="hidden min-h-[40px] items-center gap-2 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-3 lg:flex rtl:flex-row-reverse">
          <ShieldCheck className={`h-4 w-4 ${runtime.available ? 'text-[var(--knoux-success)]' : 'text-[var(--knoux-text-muted)]'}`} />
          <span className="text-[11px] font-bold text-[var(--knoux-text-secondary)]">{runtime.available ? t('Desktop runtime', 'بيئة سطح المكتب') : t('Preview mode', 'وضع المعاينة')}</span>
        </div>

        <button
          type="button"
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-secondary)] transition hover:border-[var(--knoux-primary)]/35 hover:text-[var(--knoux-primary-bright)]"
          title={t('Switch language', 'تبديل اللغة')}
        >
          <Languages className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-secondary)] transition hover:border-[var(--knoux-primary)]/35 hover:text-[var(--knoux-primary-bright)]"
          title={t('Switch theme', 'تبديل المظهر')}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px] text-amber-400" /> : <Moon className="h-[18px] w-[18px] text-indigo-600" />}
        </button>

        <button
          type="button"
          onClick={clearNotifications}
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-secondary)] transition hover:border-[var(--knoux-primary)]/35 hover:text-[var(--knoux-primary-bright)]"
          title={t('Notifications', 'الإشعارات')}
        >
          <Bell className="h-[18px] w-[18px]" />
          {notificationCount > 0 && (
            <span className="absolute -end-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--knoux-danger)] px-1 text-[9px] font-black text-white">{notificationCount}</span>
          )}
        </button>

        <div className="hidden items-center gap-2.5 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-1.5 pe-3 2xl:flex rtl:flex-row-reverse rtl:ps-3 rtl:pe-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[linear-gradient(135deg,var(--knoux-primary),var(--knoux-accent-blue))] text-[11px] font-black text-white">SE</div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[11px] font-extrabold text-[var(--knoux-text)]">Eng. Sadek Elgazar</p>
            <p className="truncate text-[9px] font-bold text-[var(--knoux-primary-bright)]">Knoux Founder</p>
          </div>
        </div>
      </div>
    </header>
  );
};
