import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  Cpu,
  HardDrive,
  Layers3,
  MemoryStick,
  Monitor,
  PackageCheck,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  WandSparkles,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { getOfficialKnouxLogo } from '../../data/officialBrand';
import { NativeClient } from '../../services/nativeClient';
import {
  MODULE_ACCENTS,
  MODULE_ICONS,
  MODULE_ROUTE_MAP,
  getImplementationLabel,
  getModuleSummary,
  getServiceIcon,
} from '../workspace/workspaceMeta';

interface StatusCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  detail: string;
  accent: string;
  progress?: number;
  state?: 'ready' | 'warning' | 'muted';
}

const StatusCard: React.FC<StatusCardProps> = ({ icon: Icon, label, value, detail, accent, progress, state = 'muted' }) => (
  <article className="knoux-service-card min-h-[158px] p-5" data-accent={accent}>
    <div className="flex items-start justify-between gap-3">
      <div className="knoux-icon-plate">
        <Icon className="h-[21px] w-[21px]" strokeWidth={1.9} />
      </div>
      <span className={`knoux-chip ${state === 'ready' ? 'knoux-chip--success' : state === 'warning' ? 'knoux-chip--warning' : 'knoux-chip--muted'}`}>
        <span className={`h-2 w-2 rounded-full ${state === 'ready' ? 'bg-[var(--knoux-success)]' : state === 'warning' ? 'bg-[var(--knoux-warning)]' : 'bg-[var(--knoux-text-muted)]'}`} />
        {state === 'ready' ? 'Ready' : state === 'warning' ? 'Review' : 'Waiting'}
      </span>
    </div>
    <div className="mt-5">
      <p className="text-[12px] font-bold uppercase tracking-[.08em] text-[var(--knoux-text-muted)]">{label}</p>
      <p className="mt-1 text-[23px] font-black tracking-[-.025em] text-[var(--knoux-text)]">{value}</p>
      <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{detail}</p>
    </div>
    {typeof progress === 'number' && (
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--knoux-surface-muted)]">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--card-accent),var(--knoux-primary-bright))]" style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }} />
      </div>
    )}
  </article>
);

export const DashboardView: React.FC = () => {
  const {
    systemSpecs,
    setCurrentRoute,
    runSmartScan,
    isScanning,
    actionLogs,
    theme,
    language,
    t,
  } = useKnoux();

  const [logoFailed, setLogoFailed] = useState(false);
  const runtime = NativeClient.getRuntimeState();
  const hasTelemetry = runtime.available && (systemSpecs.totalRamGB > 0 || systemSpecs.diskTotalGB > 0 || systemSpecs.cpuCores > 0);

  const capabilityCounts = useMemo(() => {
    const services = MODULES_CATALOG.flatMap(module => module.services);
    return services.reduce(
      (counts, service) => {
        const state = service.implementationState ?? 'planned';
        counts[state] += 1;
        return counts;
      },
      { implemented: 0, partial: 0, planned: 0, requires_configuration: 0, unsupported: 0 } as Record<'implemented' | 'partial' | 'planned' | 'requires_configuration' | 'unsupported', number>,
    );
  }, []);

  const recommendations = useMemo(() => {
    const items: Array<{ id: string; title: string; body: string; route: string; kind: 'info' | 'warning' }> = [];
    if (!runtime.available) {
      items.push({
        id: 'desktop-runtime',
        title: t('Open the desktop workspace', 'افتح مساحة عمل سطح المكتب'),
        body: t('Native Windows readings and operations are disabled in the web preview.', 'قراءات ويندوز والعمليات المحلية غير متاحة داخل معاينة الويب.'),
        route: 'first-run',
        kind: 'warning',
      });
    } else if (!hasTelemetry) {
      items.push({
        id: 'device-scan',
        title: t('Read this device', 'اقرأ بيانات هذا الجهاز'),
        body: t('Run device discovery to populate accurate hardware and Windows information.', 'شغّل فحص الجهاز لعرض معلومات دقيقة عن المكونات وويندوز.'),
        route: 'first-run',
        kind: 'info',
      });
    }
    if (actionLogs.some(log => log.status === 'failed')) {
      items.push({
        id: 'failed-operation',
        title: t('Review failed operations', 'راجع العمليات الفاشلة'),
        body: t('One or more local operations require your attention.', 'توجد عملية محلية واحدة أو أكثر تحتاج إلى مراجعتك.'),
        route: 'support',
        kind: 'warning',
      });
    }
    return items;
  }, [actionLogs, hasTelemetry, runtime.available, t]);

  const statusCards: StatusCardProps[] = [
    {
      icon: Monitor,
      label: t('Device workspace', 'مساحة الجهاز'),
      value: runtime.available ? (hasTelemetry ? systemSpecs.osEdition : t('Not scanned', 'لم يُفحص')) : t('Web preview', 'معاينة الويب'),
      detail: runtime.available ? (hasTelemetry ? systemSpecs.computerName : t('Run device discovery to identify this Windows host.', 'شغّل فحص الجهاز للتعرف على بيئة ويندوز.')) : t('Desktop operations remain safely disabled.', 'العمليات المحلية معطلة بأمان.'),
      accent: 'violet',
      state: hasTelemetry ? 'ready' : 'warning',
    },
    {
      icon: MemoryStick,
      label: t('CPU & memory', 'المعالج والذاكرة'),
      value: hasTelemetry ? `${systemSpecs.usedRamGB.toFixed(1)} / ${systemSpecs.totalRamGB.toFixed(1)} GB` : '—',
      detail: hasTelemetry ? `${systemSpecs.processor} • ${systemSpecs.cpuCores} ${t('threads', 'خيطًا')}` : t('Live readings are not active yet.', 'القراءات المباشرة غير مفعلة بعد.'),
      accent: 'blue',
      progress: hasTelemetry ? systemSpecs.ramLoadPercentage : undefined,
      state: hasTelemetry ? 'ready' : 'muted',
    },
    {
      icon: HardDrive,
      label: t('Storage', 'مساحة التخزين'),
      value: hasTelemetry ? `${systemSpecs.diskFreeGB.toFixed(0)} GB ${t('free', 'متاحة')}` : '—',
      detail: hasTelemetry ? `${systemSpecs.diskUsedGB.toFixed(0)} / ${systemSpecs.diskTotalGB.toFixed(0)} GB ${t('used', 'مستخدمة')}` : t('No storage scan has been performed.', 'لم يتم إجراء فحص لمساحة التخزين.'),
      accent: 'amber',
      progress: hasTelemetry && systemSpecs.diskTotalGB > 0 ? (systemSpecs.diskUsedGB / systemSpecs.diskTotalGB) * 100 : undefined,
      state: hasTelemetry ? 'ready' : 'muted',
    },
    {
      icon: ShieldCheck,
      label: t('Windows security', 'أمان ويندوز'),
      value: hasTelemetry ? (systemSpecs.defenderStatus && systemSpecs.firewallStatus ? t('Protection detected', 'تم رصد الحماية') : t('Needs review', 'تحتاج مراجعة')) : t('Not evaluated', 'لم تُقيّم'),
      detail: hasTelemetry ? t('Based on the latest local reading.', 'بناءً على آخر قراءة محلية.') : t('Security status appears only after a real device scan.', 'تظهر حالة الأمان بعد فحص حقيقي للجهاز.'),
      accent: 'emerald',
      state: hasTelemetry && systemSpecs.defenderStatus && systemSpecs.firewallStatus ? 'ready' : hasTelemetry ? 'warning' : 'muted',
    },
    {
      icon: PackageCheck,
      label: t('Software setup', 'إعداد البرامج'),
      value: t('Catalog available', 'الكتالوج متاح'),
      detail: runtime.available ? t('Verify Winget before installing or updating packages.', 'تحقق من Winget قبل تثبيت الحزم أو تحديثها.') : t('Browse the catalog now; installation requires Desktop.', 'تصفح الكتالوج الآن؛ التثبيت يتطلب سطح المكتب.'),
      accent: 'cyan',
      state: runtime.available ? 'warning' : 'muted',
    },
  ];

  const quickServices = [
    MODULES_CATALOG[0].services[0],
    MODULES_CATALOG[0].services[1],
    MODULES_CATALOG[0].services[4],
    MODULES_CATALOG[0].services[3],
    MODULES_CATALOG[1].services[0],
    MODULES_CATALOG[2].services[0],
    MODULES_CATALOG[6].services[0],
    MODULES_CATALOG[0].services[9],
  ];

  const featuredModules = MODULES_CATALOG.slice(0, 8);

  return (
    <div className="knoux-page-container space-y-7">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[44%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,.18),transparent_65%)]" aria-hidden="true" />
        <div className="relative grid items-center gap-8 xl:grid-cols-[1.4fr_.6fr]">
          <div>
            <div className="knoux-eyebrow">
              <Sparkles className="h-4 w-4" />
              <span>{t('Windows intelligence workspace', 'مساحة عمل ذكاء ويندوز')}</span>
            </div>
            <h1 className="mt-4 max-w-4xl text-[clamp(2rem,4vw,3.5rem)] font-black leading-[1.08] tracking-[-.045em] text-[var(--knoux-text)]">
              {t('Welcome back, Eng. Sadek', 'مرحبًا بك يا مهندس صادق')}
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] font-medium leading-7 text-[var(--knoux-text-secondary)]">
              {t('Inspect, configure, protect, and maintain this Windows device through organized professional workspaces—not a random list of tools.', 'افحص جهاز ويندوز وجهّزه واحمه وصنه من خلال مساحات عمل احترافية منظمة، وليس قائمة عشوائية من الأدوات.')}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="knoux-chip knoux-chip--accent"><Monitor className="h-3.5 w-3.5" />{runtime.available ? t('Desktop connected', 'سطح المكتب متصل') : t('Web preview', 'معاينة الويب')}</span>
              <span className="knoux-chip"><Layers3 className="h-3.5 w-3.5" />19 {t('workspaces', 'مساحة عمل')}</span>
              <span className="knoux-chip"><TerminalSquare className="h-3.5 w-3.5" />190 {t('registered services', 'خدمة مسجلة')}</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={runSmartScan} disabled={isScanning} className="knoux-card-action knoux-card-action--primary min-w-[160px]">
                <SearchCheck className={`h-[18px] w-[18px] ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? t('Reading device…', 'جاري قراءة الجهاز…') : t('Scan this device', 'فحص هذا الجهاز')}
              </button>
              <button type="button" onClick={() => setCurrentRoute('post-format')} className="knoux-card-action min-w-[170px]">
                <WandSparkles className="h-[18px] w-[18px]" />
                {t('After-format setup', 'إعداد ما بعد الفورمات')}
              </button>
              <button type="button" onClick={() => setCurrentRoute('catalog')} className="knoux-card-action">
                <Layers3 className="h-[18px] w-[18px]" />
                {t('Open workspace library', 'فتح مكتبة مساحات العمل')}
              </button>
            </div>
          </div>

          <div className="relative hidden min-h-[230px] place-items-center xl:grid">
            <div className="knoux-logo-orbit h-[152px] w-[152px] bg-[var(--knoux-surface-elevated)] shadow-[0_0_80px_rgba(139,92,246,.24)]">
              {!logoFailed ? (
                <img src={getOfficialKnouxLogo(theme)} onError={() => setLogoFailed(true)} alt="KNOUX ONE" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-5xl font-black text-[var(--knoux-primary-bright)]">K</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statusCards.map(card => <StatusCard key={card.label} {...card} />)}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="knoux-eyebrow"><WandSparkles className="h-4 w-4" />{t('Quick actions', 'الإجراءات السريعة')}</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Start with a clear task', 'ابدأ بمهمة واضحة')}</h2>
          </div>
          <button type="button" onClick={() => setCurrentRoute('catalog')} className="knoux-card-action">
            {t('Browse all services', 'استعراض جميع الخدمات')}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickServices.map(service => {
            const Icon = getServiceIcon(service);
            const moduleAccent = MODULE_ACCENTS[service.moduleId] ?? 'violet';
            const moduleRoute = MODULE_ROUTE_MAP[service.moduleId] ?? 'catalog';
            return (
              <button key={service.id} type="button" onClick={() => setCurrentRoute(moduleRoute)} className="knoux-service-card group min-h-[178px] p-5 text-start" data-accent={moduleAccent}>
                <div className="flex items-start justify-between gap-3">
                  <div className="knoux-icon-plate"><Icon className="h-[22px] w-[22px]" /></div>
                  <span className="knoux-chip knoux-chip--muted">{getImplementationLabel(service.implementationState, language)}</span>
                </div>
                <h3 className="mt-5 text-[16px] font-extrabold tracking-[-.015em] text-[var(--knoux-text)] transition group-hover:text-[var(--card-accent)]">{t(service.nameEn, service.nameAr)}</h3>
                <p className="mt-2 line-clamp-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{t(service.descriptionEn, service.descriptionAr)}</p>
                <div className="mt-4 flex items-center gap-2 text-[12px] font-bold text-[var(--card-accent)] rtl:flex-row-reverse">
                  <span>{t('Open workspace', 'فتح مساحة العمل')}</span><ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Workspace collection', 'مجموعة مساحات العمل')}</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Organized by outcome—not module codes', 'منظمة حسب الهدف، لا حسب رموز الأقسام')}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="knoux-chip knoux-chip--success">{capabilityCounts.implemented} {t('ready', 'جاهزة')}</span>
            <span className="knoux-chip knoux-chip--accent">{capabilityCounts.partial} {t('desktop previews', 'معاينة سطح المكتب')}</span>
            <span className="knoux-chip">{capabilityCounts.planned} {t('roadmap', 'ضمن الخطة')}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {featuredModules.map(module => {
            const Icon = MODULE_ICONS[module.id] ?? Layers3;
            const accent = MODULE_ACCENTS[module.id] ?? 'violet';
            const previewNames = module.services.slice(0, 3).map(service => t(service.nameEn, service.nameAr));
            return (
              <button key={module.id} type="button" onClick={() => setCurrentRoute(MODULE_ROUTE_MAP[module.id] ?? 'catalog')} className="knoux-module-card group min-h-[250px] p-5 text-start" data-accent={accent}>
                <div className="flex items-start justify-between gap-3">
                  <div className="knoux-icon-plate"><Icon className="h-[23px] w-[23px]" /></div>
                  <span className="knoux-chip">10 {t('services', 'خدمات')}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-black tracking-[-.02em] text-[var(--knoux-text)] transition group-hover:text-[var(--card-accent)]">{t(module.nameEn, module.nameAr)}</h3>
                <p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{getModuleSummary(module.id, language)}</p>
                <div className="mt-4 space-y-2 border-t border-[var(--knoux-border)] pt-4">
                  {previewNames.map(name => (
                    <div key={name} className="flex items-center gap-2 text-[12px] font-semibold text-[var(--knoux-text-secondary)] rtl:flex-row-reverse">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--card-accent)]" /><span className="truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <article className="knoux-glass-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="knoux-eyebrow"><Activity className="h-4 w-4" />{t('Device activity', 'نشاط الجهاز')}</div>
              <h2 className="mt-2 text-[20px] font-black text-[var(--knoux-text)]">{t('Live readings and operation context', 'القراءات المباشرة وسياق العمليات')}</h2>
            </div>
            <span className="knoux-chip">{runtime.available ? t('Desktop source', 'مصدر سطح المكتب') : t('No native source', 'لا يوجد مصدر محلي')}</span>
          </div>

          {hasTelemetry ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: t('CPU load', 'استهلاك المعالج'), value: `${systemSpecs.cpuLoadPercentage}%`, color: 'var(--knoux-primary)' },
                { label: t('Memory load', 'استهلاك الذاكرة'), value: `${systemSpecs.ramLoadPercentage}%`, color: 'var(--knoux-accent-blue)' },
                { label: t('Free storage', 'المساحة المتاحة'), value: `${systemSpecs.diskFreeGB.toFixed(0)} GB`, color: 'var(--knoux-success)' },
              ].map(metric => (
                <div key={metric.label} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-5">
                  <p className="text-[12px] font-bold text-[var(--knoux-text-muted)]">{metric.label}</p>
                  <p className="mt-2 text-[27px] font-black" style={{ color: metric.color }}>{metric.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex min-h-[190px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-6 text-center">
              <Cpu className="h-10 w-10 text-[var(--knoux-primary)]" />
              <h3 className="mt-4 text-[16px] font-extrabold text-[var(--knoux-text)]">{t('No live device readings yet', 'لا توجد قراءات مباشرة للجهاز بعد')}</h3>
              <p className="mt-2 max-w-xl text-[13px] leading-6 text-[var(--knoux-text-muted)]">{t('Open KNOUX ONE Desktop and run Device Scan. The dashboard will never animate fake metrics.', 'افتح تطبيق كنوكس ون لسطح المكتب وشغّل فحص الجهاز. لن تعرض اللوحة قراءات متحركة وهمية.')}</p>
            </div>
          )}
        </article>

        <article className="knoux-glass-panel p-6">
          <div className="knoux-eyebrow"><CircleAlert className="h-4 w-4" />{t('Recommendations', 'التوصيات')}</div>
          <h2 className="mt-2 text-[20px] font-black text-[var(--knoux-text)]">{t('What needs attention', 'ما يحتاج إلى انتباهك')}</h2>

          <div className="mt-5 space-y-3">
            {recommendations.length > 0 ? recommendations.map(item => (
              <button key={item.id} type="button" onClick={() => setCurrentRoute(item.route)} className="flex w-full items-start gap-3 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 text-start transition hover:border-[var(--knoux-primary)]/35 rtl:flex-row-reverse">
                <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.kind === 'warning' ? 'bg-[var(--knoux-warning)]/12 text-[var(--knoux-warning)]' : 'bg-[var(--knoux-primary)]/12 text-[var(--knoux-primary-bright)]'}`}>
                  {item.kind === 'warning' ? <CircleAlert className="h-[18px] w-[18px]" /> : <Sparkles className="h-[18px] w-[18px]" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-extrabold text-[var(--knoux-text)]">{item.title}</span>
                  <span className="mt-1 block text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{item.body}</span>
                </span>
              </button>
            )) : (
              <div className="rounded-2xl border border-dashed border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-5 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[var(--knoux-success)]" />
                <p className="mt-3 text-[13px] font-extrabold text-[var(--knoux-text)]">{t('No recommendations yet', 'لا توجد توصيات بعد')}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--knoux-text-muted)]">{t('Run a real device scan to generate accurate recommendations.', 'شغّل فحصًا حقيقيًا للجهاز لإنشاء توصيات دقيقة.')}</p>
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="knoux-glass-panel p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="knoux-eyebrow"><Clock3 className="h-4 w-4" />{t('Recent activity', 'العمليات الأخيرة')}</div>
            <h2 className="mt-2 text-[20px] font-black text-[var(--knoux-text)]">{t('Verified operation history', 'سجل العمليات الموثق')}</h2>
          </div>
          <button type="button" onClick={() => setCurrentRoute('support')} className="knoux-card-action">{t('Open full activity', 'فتح السجل الكامل')}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" /></button>
        </div>

        {actionLogs.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--knoux-border)]">
            {actionLogs.slice(0, 5).map(log => (
              <div key={log.id} className="grid gap-3 border-b border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] px-4 py-3 last:border-b-0 md:grid-cols-[1fr_160px_130px] md:items-center">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-[var(--knoux-text)]">{log.capabilityName}</p>
                  <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--knoux-text-muted)]">{log.details}</p>
                </div>
                <span className={`knoux-chip w-fit ${log.status === 'completed' ? 'knoux-chip--success' : log.status === 'failed' ? 'knoux-chip--warning' : ''}`}>{log.status}</span>
                <span className="text-[11px] font-semibold text-[var(--knoux-text-muted)]">{log.timestamp}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 flex min-h-[150px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-center">
            <Activity className="h-8 w-8 text-[var(--knoux-text-muted)]" />
            <p className="mt-3 text-[13px] font-extrabold text-[var(--knoux-text)]">{t('No operations have been recorded', 'لم يتم تسجيل أي عمليات')}</p>
            <p className="mt-1 text-[12px] text-[var(--knoux-text-muted)]">{t('Real operation results will appear here.', 'ستظهر نتائج العمليات الحقيقية هنا.')}</p>
          </div>
        )}
      </section>
    </div>
  );
};
