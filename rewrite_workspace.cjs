const fs = require('fs');
const content = `import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
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
  completed: { className: 'knoux-chip--success text-emerald-400 border-emerald-500/30 bg-emerald-500/10', titleEn: 'Operation completed', titleAr: 'اكتملت العملية', icon: CheckCircle2 },
  completed_with_warnings: { className: 'knoux-chip--warning text-amber-400 border-amber-500/30 bg-amber-500/10', titleEn: 'Completed with warnings', titleAr: 'اكتملت مع تحذيرات', icon: AlertTriangle },
  failed: { className: 'knoux-chip--warning text-red-400 border-red-500/30 bg-red-500/10', titleEn: 'Operation failed', titleAr: 'فشلت العملية', icon: CircleAlert },
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
  
  const terminalRef = useRef<HTMLPreElement>(null);

  const moduleId = capabilities[0]?.moduleId ?? \`m\${moduleNumber.toString().padStart(2, '0')}\`;
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
  
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [executionLog]);

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
        t(\`Administrator permission is required for \${capability.nameEn}.\`, \`تتطلب خدمة \${capability.nameAr} صلاحية المسؤول.\`),
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
    setExecutionLog(\`\${t('Starting', 'بدء')} \${t(capability.nameEn, capability.nameAr)}…\\n\`);

    try {
      const result = await OperationService.executeCapability(capability, (progress, message) => {
        setExecutionProgress(progress);
        setExecutionLog(previous => \`\${previous}[\\n\${new Date().toLocaleTimeString()}] \${message}\\n\`);
      });
      setLastResult(result);
    } catch (err: any) {
      const message = err?.message || 'Operation failed exceptionally.';
      setLastResult({
        operationId: 'failed_local',
        capabilityId: capability.id,
        handlerId: capability.handlerId || 'none',
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
      setExecutionLog(previous => \`\${previous}\\n[ERROR] \${message}\`);
    } finally {
      setIsExecuting(false);
    }
  };

  const renderServiceCard = (capability: KnouxCapability, featuredCard = false) => {
    const Icon = getServiceIcon(capability);
    const StateIcon = getImplementationIcon(capability.implementationState);
    const executable = capability.implementationState === 'implemented' && capability.status === 'available' && Boolean(capability.handlerId);

    return (
      <article key={capability.id} className={\`knoux-service-card group flex flex-col p-5 \${featuredCard ? 'min-h-[290px]' : 'min-h-[245px]'}\`} data-accent={accent}>
        <div className="flex items-start justify-between gap-3">
          <div className="knoux-icon-plate"><Icon className="h-[23px] w-[23px]" /></div>
          <span className={\`knoux-chip \${capability.implementationState === 'implemented' ? 'knoux-chip--success' : capability.implementationState === 'partial' ? 'knoux-chip--accent' : capability.implementationState === 'requires_configuration' ? 'knoux-chip--warning' : 'knoux-chip--muted'}\`}>
            <StateIcon className="h-3.5 w-3.5" />{getImplementationLabel(capability.implementationState, language)}
          </span>
        </div>
        <div className="mt-5 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--card-accent)]">{t('Service', 'خدمة')} {capability.serviceNumber}</p>
          <h3 className={\`\${featuredCard ? 'text-[21px] leading-8' : 'text-[17px] leading-6'} mt-2 font-black tracking-[-.02em] text-[var(--knoux-text)] transition group-hover:text-[var(--card-accent)]\`}>
            {t(capability.nameEn, capability.nameAr)}
          </h3>
          <p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{t(capability.descriptionEn, capability.descriptionAr)}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--knoux-border)] pt-4">
          <span className="knoux-chip"><Monitor className="h-3.5 w-3.5" />{capability.runtime === 'desktop_elevated' ? t('Desktop + Admin', 'سطح المكتب + مسؤول') : t('Desktop', 'سطح المكتب')}</span>
          {capability.requiresAdmin && <span className="knoux-chip knoux-chip--warning"><ShieldAlert className="h-3.5 w-3.5" />{t('Administrator', 'صلاحية مسؤول')}</span>}
        </div>
        <div className="mt-4 flex items-center gap-2 rtl:flex-row-reverse">
          <button type="button" onClick={() => openService(capability)} className="knoux-card-action flex-1"><Eye className="h-4 w-4" />{t('View preview', 'المعاينة الفعلية')}</button>
          <button
            type="button"
            onClick={() => executeCapability(capability)}
            disabled={!executable || isExecuting}
            className={\`knoux-card-action flex-1 \${executable ? 'knoux-card-action--primary' : ''}\`}
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
    { id: 'services', en: 'Services Studio', ar: 'استوديو الخدمات', icon: Layers3 },
    { id: 'activity', en: 'Activity', ar: 'سجل العمليات', icon: History },
    { id: 'help', en: 'Help', ar: 'المساعدة', icon: HelpCircle },
  ];

  return (
    <div className="knoux-page-container space-y-6">
      {/* Main Mode Header (hidden when a specific service is open) */}
      {!selectedCap && (
        <>
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
                      <div key={capability.id} role="button" tabIndex={0} onClick={() => openService(capability)} className="flex items-center gap-3 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3 transition hover:border-[var(--knoux-primary)]/50 hover:bg-[var(--knoux-primary)]/5 rtl:flex-row-reverse">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--knoux-surface)] shadow-inner"><Icon className="h-[18px] w-[18px] text-[var(--knoux-text)]" /></div>
                        <div className="flex-1 text-start"><h3 className="text-[14px] font-extrabold text-[var(--knoux-text)]">{t(capability.nameEn, capability.nameAr)}</h3><p className="line-clamp-1 text-[12px] font-medium text-[var(--knoux-text-muted)]">{t(capability.descriptionEn, capability.descriptionAr)}</p></div>
                        <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--knoux-text-muted)] rtl:-scale-x-100" />
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {tab === 'services' && (
            <section className="space-y-4">
              <div><div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Service collection', 'مجموعة الخدمات')}</div><h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Actual Working Mode', 'مود العمل الفعلي والمباشر')}</h2></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{capabilities.map(capability => renderServiceCard(capability))}</div>
            </section>
          )}

          {tab === 'activity' && (
            <section className="knoux-glass-panel p-6">
              <div className="knoux-eyebrow"><History className="h-4 w-4" />{t('Workspace activity', 'سجل مساحة العمل')}</div>
              <h2 className="mt-2 text-[22px] font-black text-[var(--knoux-text)]">{t('Verified operation results', 'نتائج العمليات الموثقة')}</h2>
              {moduleLogs.length > 0 ? (
                <div className="mt-5 space-y-3">
                  {moduleLogs.map((log, i) => (
                    <div key={i} className="flex items-center justify-between gap-4 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 rtl:flex-row-reverse">
                      <div className="flex items-center gap-3 rtl:flex-row-reverse">
                        {log.status === 'completed' ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : log.status === 'failed' ? <CircleAlert className="h-5 w-5 text-red-400" /> : <History className="h-5 w-5 text-[var(--knoux-text-muted)]" />}
                        <div><p className="text-[13px] font-extrabold text-[var(--knoux-text)]">{t(log.summaryEn, log.summaryAr)}</p><p className="text-[11px] font-medium text-[var(--knoux-text-muted)]">{new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')}</p></div>
                      </div>
                      <span className="knoux-chip">{log.handlerId}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 flex flex-col items-center justify-center py-8 text-center"><History className="mb-3 h-10 w-10 text-[var(--knoux-border)]" /><p className="text-[14px] font-bold text-[var(--knoux-text-muted)]">{t('No actions recorded in this session.', 'لم يتم تسجيل أي عمليات في هذه الجلسة حتى الآن.')}</p></div>
              )}
            </section>
          )}

          {tab === 'help' && (
            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <article className="knoux-glass-panel p-5"><div className="knoux-icon-plate"><ShieldAlert className="h-5 w-5" /></div><h2 className="mt-4 text-[16px] font-black text-[var(--knoux-text)]">{t('Safety boundaries', 'حدود الأمان')}</h2><p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t('Actions modifying the OS require explicit UAC elevation. Dry-runs are supported for simulated previews.', 'العمليات التي تغير النظام تتطلب رفع صلاحية (UAC) صريح. يتم دعم وضع المحاكاة للمعاينة.')}</p></article>
              <article className="knoux-glass-panel p-5"><div className="knoux-icon-plate"><Activity className="h-5 w-5" /></div><h2 className="mt-4 text-[16px] font-black text-[var(--knoux-text)]">{t('Event tracing', 'تتبع الأحداث')}</h2><p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t('All actions are logged to local memory. Complex procedures will stream output automatically.', 'يتم تسجيل جميع العمليات في الذاكرة. الإجراءات المعقدة تبث المخرجات في الوقت الفعلي.')}</p></article>
              <article className="knoux-glass-panel p-5"><div className="knoux-icon-plate"><FileText className="h-5 w-5" /></div><h2 className="mt-4 text-[16px] font-black text-[var(--knoux-text)]">{t('Read-only execution', 'التنفيذ للقراءة فقط')}</h2><p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t('Discovery scans do not alter settings. Check the "What it changes" tab before execution.', 'عمليات الفحص لا تغير الإعدادات. راجع نافذة "ما الذي ستغيره" قبل التنفيذ.')}</p></article>
            </section>
          )}
        </>
      )}

      {/* NEW HIGH-FIDELITY PREVIEW WORKSPACE */}
      {selectedCap && (
        <div className="animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => { if (!isExecuting) setSelectedCap(null); }}
              disabled={isExecuting}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] hover:bg-[var(--knoux-border)] transition-colors disabled:opacity-50"
            >
              {language === 'ar' ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </button>
            <div>
              <div className="text-[12px] font-extrabold text-[var(--knoux-primary-bright)] uppercase tracking-wider">{t(moduleNameEn, moduleNameAr)}</div>
              <h2 className="text-[24px] font-black text-white">{t('Execution Preview Studio', 'استوديو المعاينة والتنفيذ الفعلي')}</h2>
            </div>
          </div>
          
          <div className="flex flex-col xl:flex-row gap-6">
            {/* Left/Right Sidebar - Services List */}
            <div className="xl:w-[320px] shrink-0 flex flex-col gap-3 rtl:text-right">
              <div className="p-4 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)]">
                 <h3 className="text-[14px] font-black mb-3">{t('Available Services', 'الخدمات المتاحة')}</h3>
                 <div className="flex flex-col gap-2 h-[600px] overflow-y-auto custom-scrollbar pr-2">
                   {capabilities.map(cap => {
                     const CapIcon = getServiceIcon(cap);
                     const isSelected = selectedCap.id === cap.id;
                     const StateIcon = getImplementationIcon(cap.implementationState);
                     return (
                       <button 
                         key={cap.id}
                         onClick={() => { if (!isExecuting) openService(cap); }}
                         className={\`flex items-start gap-3 p-3 rounded-xl border text-start transition-all \${isSelected ? 'bg-[var(--knoux-primary)]/10 border-[var(--knoux-primary)]/40 shadow-[0_0_15px_rgba(var(--knoux-primary-rgb),0.1)]' : 'bg-[var(--knoux-surface-muted)] border-[var(--knoux-border)] hover:border-white/20 opacity-70 hover:opacity-100'}\`}
                       >
                         <div className={\`mt-0.5 shrink-0 \${isSelected ? 'text-[var(--knoux-primary-bright)]' : 'text-gray-400'}\`}><CapIcon className="h-4 w-4" /></div>
                         <div className="flex-1">
                           <div className="flex items-center gap-2">
                             <div className={\`text-[13px] font-bold \${isSelected ? 'text-white' : 'text-gray-300'}\`}>{t(cap.nameEn, cap.nameAr)}</div>
                           </div>
                           <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><StateIcon className="h-3 w-3" /> {getImplementationLabel(cap.implementationState, language)}</div>
                         </div>
                       </button>
                     );
                   })}
                 </div>
              </div>
            </div>
            
            {/* Main Execution Studio */}
            <div className="flex-1 min-h-[600px] rounded-[24px] border border-white/10 bg-[#070314] overflow-hidden shadow-2xl relative flex flex-col">
                <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] mix-blend-screen pointer-events-none" />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--knoux-primary)]/10 blur-[100px] rounded-full pointer-events-none" />
                
                {/* Header */}
                <div className="relative h-[72px] border-b border-white/10 bg-black/40 flex items-center justify-between px-6 z-10 backdrop-blur-md">
                   <div className="flex items-center gap-4">
                       <div className="h-10 w-10 rounded-xl bg-[var(--knoux-primary)]/20 flex items-center justify-center border border-[var(--knoux-primary)]/30 shadow-[0_0_10px_rgba(var(--knoux-primary-rgb),0.2)]">
                          {React.createElement(getServiceIcon(selectedCap), { className: 'h-5 w-5 text-[var(--knoux-primary-bright)]' })}
                       </div>
                       <div>
                         <h2 className="text-[18px] font-black text-white">{t(selectedCap.nameEn, selectedCap.nameAr)}</h2>
                         <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                           <Monitor className="h-3 w-3" /> {selectedCap.runtime === 'desktop_elevated' ? t('Elevated Access', 'صلاحيات مرتفعة') : t('Standard Access', 'صلاحيات قياسية')}
                           <span className="opacity-50">•</span>
                           <span>{selectedCap.handlerId || 'No handler'}</span>
                         </div>
                       </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button 
                        onClick={() => executeCapability(selectedCap)}
                        disabled={isExecuting || selectedCap.implementationState !== 'implemented' || !selectedCap.handlerId}
                        className="px-6 py-2.5 rounded-xl bg-[var(--knoux-primary)] hover:bg-[var(--knoux-primary-bright)] text-white font-bold text-[13px] transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(var(--knoux-primary-rgb),0.4)]"
                      >
                         {isExecuting ? <RotateCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                         {getActionLabel(selectedCap, language)}
                      </button>
                   </div>
                </div>
                
                {/* Master Detail Split */}
                <div className="relative flex-1 flex flex-col lg:flex-row z-10">
                   {/* Info Column */}
                   <div className="lg:w-[320px] border-e border-white/10 bg-black/30 p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                       <section>
                         <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">{t('Description', 'الوصف')}</h3>
                         <p className="text-[13px] leading-6 text-gray-300 font-medium">{t(selectedCap.descriptionEn, selectedCap.descriptionAr)}</p>
                       </section>
                       
                       <section>
                         <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">{t('Impact Analysis', 'تحليل التأثير')}</h3>
                         <div className="space-y-3">
                           <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
                             <div className="flex items-center gap-2 text-emerald-400 text-[12px] font-bold mb-1"><Eye className="h-3.5 w-3.5" /> {t('Reads', 'القراءة')}</div>
                             <p className="text-[12px] text-emerald-200/70 leading-5">{t(selectedCap.readsEn || OperationService.getCapabilityPreview(selectedCap).readsEn, selectedCap.readsAr || OperationService.getCapabilityPreview(selectedCap).readsAr)}</p>
                           </div>
                           <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/30">
                             <div className="flex items-center gap-2 text-amber-400 text-[12px] font-bold mb-1"><Settings2 className="h-3.5 w-3.5" /> {t('Changes', 'التغييرات')}</div>
                             <p className="text-[12px] text-amber-200/70 leading-5">{t(selectedCap.changesEn || OperationService.getCapabilityPreview(selectedCap).changesEn, selectedCap.changesAr || OperationService.getCapabilityPreview(selectedCap).changesAr)}</p>
                           </div>
                         </div>
                       </section>
                       
                       {selectedCap.requiresAdmin && (
                         <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex gap-3">
                           <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
                           <p className="text-[12px] text-red-200 font-medium">{t('This operation requires administrative UAC elevation. A secure prompt will appear when you run it.', 'هذه العملية تتطلب رفع صلاحيات UAC. ستظهر نافذة أمان عند التنفيذ.')}</p>
                         </div>
                       )}
                       
                       {selectedCap.implementationState !== 'implemented' && (
                         <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-900/50 flex gap-3">
                           <CircleAlert className="h-5 w-5 text-blue-400 shrink-0" />
                           <p className="text-[12px] text-blue-200 font-medium">{t('This service is not yet fully implemented in the native bridge.', 'هذه الخدمة غير مكتملة التنفيذ في المحرك المحلي بعد.')}</p>
                         </div>
                       )}
                   </div>
                   
                   {/* Terminal/Visual Console */}
                   <div className="flex-1 p-6 flex flex-col relative bg-gradient-to-b from-transparent to-black/40">
                      
                      {isExecuting && (
                        <div className="mb-4">
                           <div className="flex items-center justify-between mb-2">
                             <span className="text-[12px] font-bold text-[var(--knoux-primary-bright)]">{t('Executing in real-time...', 'جاري التنفيذ المباشر...')}</span>
                             <span className="text-[12px] font-mono font-bold text-white">{executionProgress}%</span>
                           </div>
                           <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-[var(--knoux-primary-bright)] rounded-full transition-all duration-300 relative shadow-[0_0_10px_var(--knoux-primary-bright)]" style={{ width: \`\${executionProgress}%\` }} />
                           </div>
                        </div>
                      )}
                      
                      <div className="flex-1 rounded-[16px] border border-white/10 bg-[#030108]/90 overflow-hidden flex flex-col shadow-inner backdrop-blur-xl">
                          <div className="h-9 bg-white/5 border-b border-white/10 flex items-center px-4 justify-between">
                             <div className="flex items-center gap-2">
                               <Terminal className="h-4 w-4 text-[var(--knoux-primary-bright)]" />
                               <span className="text-[11px] font-mono text-gray-400 uppercase tracking-widest">{t('Live Output Stream', 'بث المخرجات المباشر')}</span>
                             </div>
                             <div className="flex gap-1.5">
                               <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                               <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                               <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                             </div>
                          </div>
                          
                          <pre ref={terminalRef} className="flex-1 p-5 font-mono text-[13px] leading-relaxed text-emerald-400 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                             {executionLog || (
                               <div className="text-gray-500 flex flex-col items-center justify-center h-full gap-4">
                                  <Terminal className="h-12 w-12 opacity-20" />
                                  <div>{t('Awaiting command execution...', 'بانتظار تنفيذ الأمر...')}</div>
                               </div>
                             )}
                          </pre>
                      </div>
                      
                      {lastResult && (
                         <div className="mt-4 animate-in slide-in-from-bottom-4">
                            {(() => { 
                              const meta = resultStyles[lastResult.status] ?? resultStyles.unavailable; 
                              const ResultIcon = meta.icon; 
                              return (
                                <div className={\`rounded-2xl border \${meta.className.split(' ').slice(1).join(' ')} p-4 flex items-center justify-between\`}>
                                  <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-white/10">
                                       <ResultIcon className="h-6 w-6" />
                                    </div>
                                    <div>
                                      <h3 className="font-bold text-[15px]">{t(meta.titleEn, meta.titleAr)}</h3>
                                      <p className="text-[12px] opacity-80 mt-0.5">{t(lastResult.summaryEn, lastResult.summaryAr)}</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-[11px] font-mono opacity-60">ID: {lastResult.operationId}</div>
                                    {lastResult.durationMs !== undefined && <div className="text-[11px] font-mono opacity-60 mt-0.5">{lastResult.durationMs}ms</div>}
                                  </div>
                                </div>
                              ); 
                            })()}
                         </div>
                      )}
                   </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`
fs.writeFileSync('src/components/common/UniversalServiceWorkspace.tsx', content);
