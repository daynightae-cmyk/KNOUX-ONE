import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Eye,
  FileText,
  HelpCircle,
  History,
  Layers3,
  Lock,
  Monitor,
  Play,
  RotateCw,
  Settings2,
  ShieldAlert,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import type { KnouxCapability, OperationResult } from '../../types';
import { OperationService } from '../../services/operationService';
import {
  MODULE_ACCENTS,
  MODULE_ICONS,
  getActionLabel,
  getImplementationIcon,
  getImplementationLabel,
  getModuleSummary,
  getServiceIcon,
} from '../workspace/workspaceMeta';

interface UniversalServiceWorkspaceProps {
  moduleNumber: number;
  moduleNameEn: string;
  moduleNameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  capabilities: KnouxCapability[];
}

type WorkspaceTab = 'overview' | 'services' | 'activity' | 'help';

const resultStyles: Record<string, { className: string; titleEn: string; titleAr: string; icon: React.ElementType }> = {
  completed: { className: 'knoux-chip--success', titleEn: 'Operation completed', titleAr: 'اكتملت العملية', icon: CheckCircle2 },
  completed_with_warnings: { className: 'knoux-chip--warning', titleEn: 'Completed with warnings', titleAr: 'اكتملت مع تحذيرات', icon: AlertTriangle },
  failed: { className: 'knoux-chip--warning', titleEn: 'Operation failed', titleAr: 'فشلت العملية', icon: CircleAlert },
  cancelled: { className: 'knoux-chip--muted', titleEn: 'Operation cancelled', titleAr: 'أُلغيت العملية', icon: X },
  unavailable: { className: 'knoux-chip--muted', titleEn: 'Unavailable', titleAr: 'غير متاحة', icon: Lock },
  requires_admin: { className: 'knoux-chip--warning', titleEn: 'Administrator required', titleAr: 'تتطلب صلاحية مسؤول', icon: ShieldAlert },
  requires_configuration: { className: 'knoux-chip--warning', titleEn: 'Setup required', titleAr: 'تحتاج إلى إعداد', icon: Settings2 },
  planned: { className: 'knoux-chip--muted', titleEn: 'Roadmap service', titleAr: 'خدمة ضمن الخطة', icon: Clock3 },
  unsupported: { className: 'knoux-chip--muted', titleEn: 'Unsupported', titleAr: 'غير مدعومة', icon: Lock },
};

export const UniversalServiceWorkspace: React.FC<UniversalServiceWorkspaceProps> = ({
  moduleNumber,
  moduleNameEn,
  moduleNameAr,
  descriptionEn,
  descriptionAr,
  capabilities,
}) => {
  const { t, triggerElevation, language, actionLogs } = useKnoux();
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [selectedCap, setSelectedCap] = useState<KnouxCapability | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionLog, setExecutionLog] = useState('');
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);

  const moduleId = capabilities[0]?.moduleId ?? `m${moduleNumber.toString().padStart(2, '0')}`;
  const ModuleIcon = MODULE_ICONS[moduleId] ?? Layers3;
  const accent = MODULE_ACCENTS[moduleId] ?? 'violet';
  const featured = capabilities[0];

  const counts = useMemo(() => capabilities.reduce(
    (result, capability) => {
      const state = capability.implementationState ?? 'planned';
      result[state] += 1;
      if (capability.requiresAdmin) result.admin += 1;
      return result;
    },
    { implemented: 0, partial: 0, planned: 0, requires_configuration: 0, unsupported: 0, admin: 0 } as Record<string, number>,
  ), [capabilities]);

  const moduleLogs = useMemo(
    () => actionLogs.filter(log => log.capabilityId.startsWith(moduleId)).slice(0, 12),
    [actionLogs, moduleId],
  );

  const openService = (capability: KnouxCapability) => {
    setSelectedCap(capability);
    setLastResult(null);
    setExecutionLog('');
    setExecutionProgress(0);
  };

  const executeCapability = async (capability: KnouxCapability) => {
    if (capability.implementationState !== 'implemented' || !capability.handlerId) {
      openService(capability);
      return;
    }

    if (capability.requiresAdmin) {
      triggerElevation(
        capability.id,
        t(`Administrator permission is required for ${capability.nameEn}.`, `تتطلب خدمة ${capability.nameAr} صلاحية المسؤول.`),
        () => runExecution(capability),
      );
      return;
    }

    await runExecution(capability);
  };

  const runExecution = async (capability: KnouxCapability) => {
    setSelectedCap(capability);
    setIsExecuting(true);
    setExecutionProgress(0);
    setLastResult(null);
    setExecutionLog(`${t('Starting', 'بدء')} ${t(capability.nameEn, capability.nameAr)}…\n`);

    try {
      const result = await OperationService.executeCapability(capability, (progress, message) => {
        setExecutionProgress(progress);
        setExecutionLog(previous => `${previous}[${new Date().toLocaleTimeString()}] ${message}\n`);
      });
      setLastResult(result);
      setExecutionLog(previous => `${previous}\n${result.stdout || result.summaryEn}`);
    } catch (error: any) {
      const message = error?.message || 'Execution failed';
      setLastResult({
        operationId: `ui_${Date.now()}`,
        capabilityId: capability.id,
        handlerId: capability.handlerId,
        status: 'failed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        requiresRestart: false,
        summaryEn: message,
        summaryAr: message,
        warnings: [],
        errorCode: 'ui_execution_failed',
      });
      setExecutionLog(previous => `${previous}\n[ERROR] ${message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderServiceCard = (capability: KnouxCapability, featuredCard = false) => {
    const Icon = getServiceIcon(capability);
    const StateIcon = getImplementationIcon(capability.implementationState);
    const executable = capability.implementationState === 'implemented' && capability.status === 'available' && Boolean(capability.handlerId);
    return (
      <article key={capability.id} className={`knoux-service-card group flex flex-col p-5 ${featuredCard ? 'min-h-[290px]' : 'min-h-[245px]'}`} data-accent={accent}>
        <div className="flex items-start justify-between gap-3">
          <div className="knoux-icon-plate"><Icon className="h-[23px] w-[23px]" /></div>
          <span className={`knoux-chip ${capability.implementationState === 'implemented' ? 'knoux-chip--success' : capability.implementationState === 'partial' ? 'knoux-chip--accent' : capability.implementationState === 'requires_configuration' ? 'knoux-chip--warning' : 'knoux-chip--muted'}`}>
            <StateIcon className="h-3.5 w-3.5" />{getImplementationLabel(capability.implementationState, language)}
          </span>
        </div>

        <div className="mt-5 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--card-accent)]">{t('Service', 'خدمة')} {capability.serviceNumber}</p>
          <h3 className={`${featuredCard ? 'text-[21px] leading-8' : 'text-[17px] leading-6'} mt-2 font-black tracking-[-.02em] text-[var(--knoux-text)] transition group-hover:text-[var(--card-accent)]`}>
            {t(capability.nameEn, capability.nameAr)}
          </h3>
          <p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{t(capability.descriptionEn, capability.descriptionAr)}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--knoux-border)] pt-4">
          <span className="knoux-chip"><Monitor className="h-3.5 w-3.5" />{capability.runtime === 'desktop_elevated' ? t('Desktop + Admin', 'سطح المكتب + مسؤول') : t('Desktop', 'سطح المكتب')}</span>
          {capability.requiresAdmin && <span className="knoux-chip knoux-chip--warning"><ShieldAlert className="h-3.5 w-3.5" />{t('Administrator', 'صلاحية مسؤول')}</span>}
        </div>

        <div className="mt-4 flex items-center gap-2 rtl:flex-row-reverse">
          <button type="button" onClick={() => openService(capability)} className="knoux-card-action flex-1"><Eye className="h-4 w-4" />{t('View service', 'عرض الخدمة')}</button>
          <button
            type="button"
            onClick={() => executeCapability(capability)}
            disabled={!executable || isExecuting}
            className={`knoux-card-action flex-1 ${executable ? 'knoux-card-action--primary' : ''}`}
          >
            {isExecuting && selectedCap?.id === capability.id ? <RotateCw className="h-4 w-4 animate-spin" /> : executable ? <Play className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
            {executable ? getActionLabel(capability, language) : t('View roadmap', 'عرض خطة الخدمة')}
          </button>
        </div>
      </article>
    );
  };

  const tabs: Array<{ id: WorkspaceTab; en: string; ar: string; icon: React.ElementType }> = [
    { id: 'overview', en: 'Overview', ar: 'نظرة عامة', icon: Sparkles },
    { id: 'services', en: 'Services', ar: 'الخدمات', icon: Layers3 },
    { id: 'activity', en: 'Activity', ar: 'سجل العمليات', icon: History },
    { id: 'help', en: 'Help', ar: 'المساعدة', icon: HelpCircle },
  ];

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8" data-accent={accent}>
        <div className="absolute inset-y-0 end-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,.15),transparent_68%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex max-w-4xl items-start gap-4 rtl:flex-row-reverse">
            <div className="knoux-icon-plate h-[58px] w-[58px] rounded-[18px]"><ModuleIcon className="h-7 w-7" /></div>
            <div>
              <div className="knoux-eyebrow">{t('Professional workspace', 'مساحة عمل احترافية')}</div>
              <h1 className="mt-2 text-[clamp(2rem,4vw,3.2rem)] font-black leading-[1.1] tracking-[-.045em] text-[var(--knoux-text)]">{t(moduleNameEn, moduleNameAr)}</h1>
              <p className="mt-3 max-w-3xl text-[14px] font-medium leading-7 text-[var(--knoux-text-secondary)]">{getModuleSummary(moduleId, language) || t(descriptionEn, descriptionAr)}</p>
            </div>
          </div>

          <div className="grid min-w-[300px] grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3.5"><p className="text-[11px] font-bold text-[var(--knoux-text-muted)]">{t('Services', 'الخدمات')}</p><p className="mt-1 text-[22px] font-black text-[var(--knoux-text)]">{capabilities.length}</p></div>
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3.5"><p className="text-[11px] font-bold text-[var(--knoux-text-muted)]">{t('Desktop preview', 'معاينة سطح المكتب')}</p><p className="mt-1 text-[22px] font-black text-[var(--knoux-primary-bright)]">{counts.partial}</p></div>
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3.5"><p className="text-[11px] font-bold text-[var(--knoux-text-muted)]">{t('Roadmap', 'ضمن الخطة')}</p><p className="mt-1 text-[22px] font-black text-[var(--knoux-text)]">{counts.planned}</p></div>
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3.5"><p className="text-[11px] font-bold text-[var(--knoux-text-muted)]">{t('Admin actions', 'عمليات المسؤول')}</p><p className="mt-1 text-[22px] font-black text-[var(--knoux-warning)]">{counts.admin}</p></div>
          </div>
        </div>
      </section>

      <div className="knoux-workspace-tabs">
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.id} type="button" onClick={() => setTab(item.id)} className="knoux-workspace-tab flex items-center gap-2 rtl:flex-row-reverse" data-active={tab === item.id}><Icon className="h-4 w-4" />{t(item.en, item.ar)}</button>;
        })}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div><div className="knoux-eyebrow"><Sparkles className="h-4 w-4" />{t('Featured service', 'الخدمة الرئيسية')}</div><h2 className="mt-2 text-[23px] font-black text-[var(--knoux-text)]">{t('Start with the primary workflow', 'ابدأ بمسار العمل الأساسي')}</h2></div>
              <button type="button" onClick={() => setTab('services')} className="text-[12px] font-extrabold text-[var(--knoux-primary-bright)] hover:underline">{t('View all services', 'عرض جميع الخدمات')}</button>
            </div>
            {featured && renderServiceCard(featured, true)}
          </section>

          <section className="knoux-glass-panel p-5">
            <div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Workspace map', 'خريطة مساحة العمل')}</div>
            <h2 className="mt-2 text-[21px] font-black text-[var(--knoux-text)]">{t('Related services', 'الخدمات المرتبطة')}</h2>
            <div className="mt-4 space-y-2.5">
              {capabilities.slice(1, 7).map(capability => {
                const Icon = getServiceIcon(capability);
                return (
                  <button key={capability.id} type="button" onClick={() => openService(capability)} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3 text-start transition hover:border-[var(--knoux-primary)]/35 rtl:flex-row-reverse">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--knoux-primary)]/10 text-[var(--knoux-primary-bright)]"><Icon className="h-[18px] w-[18px]" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-extrabold text-[var(--knoux-text)]">{t(capability.nameEn, capability.nameAr)}</span><span className="mt-0.5 block truncate text-[11px] font-medium text-[var(--knoux-text-muted)]">{getImplementationLabel(capability.implementationState, language)}</span></span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--knoux-text-muted)] rtl:-scale-x-100" />
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {tab === 'services' && (
        <section className="space-y-4">
          <div><div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Service collection', 'مجموعة الخدمات')}</div><h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Choose a clear task', 'اختر مهمة واضحة')}</h2></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map(capability => renderServiceCard(capability))}</div>
        </section>
      )}

      {tab === 'activity' && (
        <section className="knoux-glass-panel p-6">
          <div className="knoux-eyebrow"><History className="h-4 w-4" />{t('Workspace activity', 'سجل مساحة العمل')}</div>
          <h2 className="mt-2 text-[22px] font-black text-[var(--knoux-text)]">{t('Verified operation results', 'نتائج العمليات الموثقة')}</h2>
          {moduleLogs.length > 0 ? (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--knoux-border)]">
              {moduleLogs.map(log => (
                <div key={log.id} className="grid gap-3 border-b border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 last:border-b-0 md:grid-cols-[1fr_140px_130px] md:items-center">
                  <div><p className="text-[13px] font-extrabold text-[var(--knoux-text)]">{log.capabilityName}</p><p className="mt-1 text-[11px] text-[var(--knoux-text-muted)]">{log.details}</p></div>
                  <span className={`knoux-chip w-fit ${log.status === 'completed' ? 'knoux-chip--success' : log.status === 'failed' ? 'knoux-chip--warning' : ''}`}>{log.status}</span>
                  <span className="text-[11px] font-semibold text-[var(--knoux-text-muted)]">{log.timestamp}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 flex min-h-[230px] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-center"><Activity className="h-9 w-9 text-[var(--knoux-text-muted)]" /><h3 className="mt-4 text-[15px] font-black text-[var(--knoux-text)]">{t('No operations recorded in this workspace', 'لا توجد عمليات مسجلة في مساحة العمل')}</h3><p className="mt-2 text-[12px] text-[var(--knoux-text-muted)]">{t('Real native results will appear here after execution.', 'ستظهر النتائج المحلية الحقيقية هنا بعد التنفيذ.')}</p></div>
          )}
        </section>
      )}

      {tab === 'help' && (
        <section className="grid gap-5 lg:grid-cols-2">
          <article className="knoux-glass-panel p-6"><div className="knoux-eyebrow"><FileText className="h-4 w-4" />{t('How this workspace works', 'كيف تعمل مساحة العمل')}</div><h2 className="mt-2 text-[21px] font-black text-[var(--knoux-text)]">{t('Preview before execution', 'المعاينة قبل التنفيذ')}</h2><p className="mt-3 text-[13px] font-medium leading-7 text-[var(--knoux-text-secondary)]">{t('Open any service to review what it reads, what it may change, the required permissions, its current implementation state, and verification method. A visible service is not automatically presented as executable.', 'افتح أي خدمة لمراجعة ما تقرؤه وما قد تغيره والصلاحيات المطلوبة وحالة تنفيذها الحالية وطريقة التحقق. ظهور الخدمة لا يعني أنها قابلة للتنفيذ تلقائيًا.')}</p></article>
          <article className="knoux-glass-panel p-6"><div className="knoux-eyebrow"><ShieldAlert className="h-4 w-4" />{t('Safety boundary', 'حدود الأمان')}</div><h2 className="mt-2 text-[21px] font-black text-[var(--knoux-text)]">{t('Administrator actions require review', 'عمليات المسؤول تتطلب مراجعة')}</h2><p className="mt-3 text-[13px] font-medium leading-7 text-[var(--knoux-text-secondary)]">{t('Services that can modify Windows show a clear administrator indicator and must pass through the review and elevation flow. Planned and partial services remain documented without claiming completion.', 'الخدمات التي قد تغير ويندوز تعرض مؤشرًا واضحًا لصلاحية المسؤول ويجب أن تمر بمسار المراجعة والرفع. تبقى الخدمات المخططة والجزئية موثقة دون ادعاء اكتمالها.')}</p></article>
        </section>
      )}

      {selectedCap && (
        <div className="knoux-drawer-backdrop" onMouseDown={event => { if (event.currentTarget === event.target && !isExecuting) setSelectedCap(null); }}>
          <aside className="knoux-drawer" role="dialog" aria-modal="true" aria-label={t(selectedCap.nameEn, selectedCap.nameAr)}>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--knoux-border)] p-5">
              <div className="flex items-start gap-3 rtl:flex-row-reverse">
                <div className="knoux-icon-plate">{React.createElement(getServiceIcon(selectedCap), { className: 'h-[22px] w-[22px]' })}</div>
                <div><p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--knoux-primary-bright)]">{t(moduleNameEn, moduleNameAr)}</p><h2 className="mt-1 text-[20px] font-black leading-7 text-[var(--knoux-text)]">{t(selectedCap.nameEn, selectedCap.nameAr)}</h2></div>
              </div>
              <button type="button" onClick={() => !isExecuting && setSelectedCap(null)} className="knoux-card-action h-10 w-10 shrink-0 px-0" disabled={isExecuting}><X className="h-[18px] w-[18px]" /></button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2"><span className={`knoux-chip ${selectedCap.implementationState === 'implemented' ? 'knoux-chip--success' : selectedCap.implementationState === 'partial' ? 'knoux-chip--accent' : selectedCap.implementationState === 'requires_configuration' ? 'knoux-chip--warning' : 'knoux-chip--muted'}`}>{getImplementationLabel(selectedCap.implementationState, language)}</span><span className="knoux-chip"><Monitor className="h-3.5 w-3.5" />{selectedCap.runtime === 'desktop_elevated' ? t('Desktop + Admin', 'سطح المكتب + مسؤول') : t('Desktop', 'سطح المكتب')}</span>{selectedCap.requiresAdmin && <span className="knoux-chip knoux-chip--warning"><ShieldAlert className="h-3.5 w-3.5" />{t('Administrator', 'صلاحية مسؤول')}</span>}</div>

              <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><h3 className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('Service overview', 'نظرة عامة على الخدمة')}</h3><p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t(selectedCap.descriptionEn, selectedCap.descriptionAr)}</p></section>

              <div className="grid gap-4 sm:grid-cols-2"><section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><h3 className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('What it reads', 'ما الذي تقرؤه')}</h3><p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedCap.readsEn || OperationService.getCapabilityPreview(selectedCap).readsEn, selectedCap.readsAr || OperationService.getCapabilityPreview(selectedCap).readsAr)}</p></section><section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><h3 className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('What it changes', 'ما الذي ستغيره')}</h3><p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedCap.changesEn || OperationService.getCapabilityPreview(selectedCap).changesEn, selectedCap.changesAr || OperationService.getCapabilityPreview(selectedCap).changesAr)}</p></section></div>

              {isExecuting && <section className="rounded-2xl border border-[var(--knoux-primary)]/30 bg-[var(--knoux-primary)]/8 p-4"><div className="flex items-center justify-between"><span className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('Operation in progress', 'العملية قيد التنفيذ')}</span><span className="text-[12px] font-black text-[var(--knoux-primary-bright)]">{executionProgress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--knoux-surface-muted)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--knoux-primary),var(--knoux-accent-blue))]" style={{ width: `${executionProgress}%` }} /></div></section>}

              {(executionLog || lastResult) && <section className="overflow-hidden rounded-2xl border border-[var(--knoux-border)] bg-[#05070e]"><div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-[12px] font-extrabold text-white/80 rtl:flex-row-reverse"><Terminal className="h-4 w-4 text-[var(--knoux-primary-bright)]" />{t('Operation console', 'وحدة مخرجات العملية')}</div><pre className="custom-scrollbar max-h-[230px] overflow-auto whitespace-pre-wrap p-4 font-mono text-[11px] leading-6 text-emerald-300">{executionLog || t('No output was returned.', 'لم تُرجع العملية أي مخرجات.')}</pre></section>}

              {lastResult && (() => { const meta = resultStyles[lastResult.status] ?? resultStyles.unavailable; const ResultIcon = meta.icon; return <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><div className="flex items-center justify-between gap-3"><span className={`knoux-chip ${meta.className}`}><ResultIcon className="h-3.5 w-3.5" />{t(meta.titleEn, meta.titleAr)}</span>{lastResult.requiresRestart && <span className="knoux-chip knoux-chip--warning">{t('Restart required', 'إعادة تشغيل مطلوبة')}</span>}</div><p className="mt-3 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t(lastResult.summaryEn, lastResult.summaryAr)}</p>{lastResult.errorCode && <p className="mt-3 font-mono text-[11px] text-[var(--knoux-danger)]">{lastResult.errorCode}</p>}</section>; })()}

              {selectedCap.implementationState !== 'implemented' && <section className="flex items-start gap-3 rounded-2xl border border-[var(--knoux-warning)]/30 bg-[var(--knoux-warning)]/8 p-4 rtl:flex-row-reverse"><CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--knoux-warning)]" /><div><h3 className="text-[13px] font-extrabold text-[var(--knoux-text)]">{t('Current service state', 'حالة الخدمة الحالية')}</h3><p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedCap.availabilityReasonEn || 'This service remains documented until its native handler is complete.', selectedCap.availabilityReasonAr || 'تظل هذه الخدمة موثقة حتى اكتمال محركها المحلي.')}</p></div></section>}
            </div>

            <div className="flex gap-3 border-t border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 rtl:flex-row-reverse"><button type="button" onClick={() => !isExecuting && setSelectedCap(null)} disabled={isExecuting} className="knoux-card-action flex-1">{t('Close', 'إغلاق')}</button><button type="button" onClick={() => executeCapability(selectedCap)} disabled={isExecuting || selectedCap.implementationState !== 'implemented' || !selectedCap.handlerId} className="knoux-card-action knoux-card-action--primary flex-1">{isExecuting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{getActionLabel(selectedCap, language)}</button></div>
          </aside>
        </div>
      )}
    </div>
  );
};
