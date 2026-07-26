import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ListChecks,
  Lock,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { startupClient } from './startupClient';
import type {
  BootMetric,
  ChangeRecord,
  ImpactSummary,
  RecommendationReport,
  ScheduledTaskItem,
  StartupItem,
  StartupProfile,
  WindowsServiceItem,
} from './startupContracts';

type Tab = 'startup' | 'tasks' | 'services' | 'profiles' | 'history';
type PendingAction =
  | { kind: 'disable'; item: StartupItem }
  | { kind: 'delay'; item: StartupItem }
  | { kind: 'restore'; change: ChangeRecord }
  | { kind: 'remove-delay'; change: ChangeRecord }
  | { kind: 'apply-profile'; profile: StartupProfile }
  | { kind: 'delete-profile'; profile: StartupProfile };

function succeeded(result: OperationResult): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

function formatDuration(milliseconds?: number): string {
  if (!milliseconds || milliseconds <= 0) return '—';
  return milliseconds >= 60_000
    ? `${(milliseconds / 60_000).toFixed(1)} min`
    : `${(milliseconds / 1000).toFixed(1)} s`;
}

function exactConfirmation(action: PendingAction): string {
  switch (action.kind) {
    case 'disable': return `DISABLE ${action.item.name}`;
    case 'delay': return `DELAY ${action.item.name}`;
    case 'restore':
    case 'remove-delay': return 'RESTORE';
    case 'apply-profile': return 'APPLY PROFILE';
    case 'delete-profile': return 'DELETE PROFILE';
  }
}

export const StartupServicesWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm05');
  const runtime = startupClient.runtimeState();
  const [tab, setTab] = useState<Tab>('startup');
  const [registry, setRegistry] = useState<StartupItem[]>([]);
  const [folders, setFolders] = useState<StartupItem[]>([]);
  const [tasks, setTasks] = useState<ScheduledTaskItem[]>([]);
  const [services, setServices] = useState<WindowsServiceItem[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationReport | null>(null);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [profiles, setProfiles] = useState<StartupProfile[]>([]);
  const [bootHistory, setBootHistory] = useState<BootMetric[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<30 | 60 | 90>(30);
  const [profileName, setProfileName] = useState('');
  const [profileItems, setProfileItems] = useState<Set<string>>(new Set());

  const startupItems = useMemo(() => [...registry, ...folders], [registry, folders]);
  const mutableItems = useMemo(() => startupItems.filter(item => item.mutable && !item.protected), [startupItems]);
  const activeDelayed = useMemo(() => changes.filter(item => item.kind === 'delayed'), [changes]);

  const reportFailure = (result: OperationResult) => {
    setError(language === 'ar' ? result.summaryAr : result.summaryEn);
  };

  const loadAll = async () => {
    if (!runtime.available) return;
    setBusy(true);
    setError('');
    const results = await Promise.all([
      startupClient.registry(),
      startupClient.folders(),
      startupClient.tasks(),
      startupClient.services(),
      startupClient.impact(),
      startupClient.recommendations(),
      startupClient.restore({ action: 'list' }),
      startupClient.profiles({ action: 'list' }),
      startupClient.bootHistory(30),
    ]);
    const [registryResult, folderResult, taskResult, serviceResult, impactResult, recommendationResult, changeResult, profileResult, bootResult] = results;
    if (succeeded(registryResult) && registryResult.data) setRegistry(registryResult.data);
    if (succeeded(folderResult) && folderResult.data) setFolders(folderResult.data);
    if (succeeded(taskResult) && taskResult.data) setTasks(taskResult.data);
    if (succeeded(serviceResult) && serviceResult.data) setServices(serviceResult.data);
    if (succeeded(impactResult) && impactResult.data) setImpact(impactResult.data);
    if (succeeded(recommendationResult) && recommendationResult.data) setRecommendations(recommendationResult.data);
    if (succeeded(changeResult) && changeResult.data) setChanges(changeResult.data.activeChanges);
    if (succeeded(profileResult) && profileResult.data) setProfiles(profileResult.data.profiles);
    if (succeeded(bootResult) && bootResult.data) setBootHistory(bootResult.data);
    const failed = results.find(result => !succeeded(result));
    if (failed) reportFailure(failed);
    if (profileItems.size === 0 && impactResult.data) {
      setProfileItems(new Set(impactResult.data.items.filter(item => item.mutable).map(item => item.id)));
    }
    setBusy(false);
  };

  useEffect(() => {
    void loadAll();
  }, [runtime.available]);

  const runPendingAction = async () => {
    if (!pending || busy || confirmation !== exactConfirmation(pending)) return;
    setBusy(true);
    setError('');
    let result: OperationResult;
    switch (pending.kind) {
      case 'disable':
        result = await startupClient.change({ action: 'disable', itemId: pending.item.id, confirmation });
        break;
      case 'delay':
        result = await startupClient.delay({ action: 'create', itemId: pending.item.id, delaySeconds, confirmation });
        break;
      case 'restore':
        result = await startupClient.restore({ action: 'restore', changeId: pending.change.id, confirmation });
        break;
      case 'remove-delay':
        result = await startupClient.delay({ action: 'remove', changeId: pending.change.id, confirmation });
        break;
      case 'apply-profile':
        result = await startupClient.profiles({ action: 'apply', profileId: pending.profile.id, confirmation });
        break;
      case 'delete-profile':
        result = await startupClient.profiles({ action: 'delete', profileId: pending.profile.id, confirmation });
        break;
    }
    addLog(
      pending.kind === 'delay' || pending.kind === 'remove-delay' ? 'm05_s07' : pending.kind.includes('profile') ? 'm05_s08' : 'm05_s09',
      t('Startup configuration', 'إعداد بدء التشغيل'),
      succeeded(result) ? 'completed' : 'failed',
      language === 'ar' ? result.summaryAr : result.summaryEn,
    );
    if (!succeeded(result)) reportFailure(result);
    setPending(null);
    setConfirmation('');
    setBusy(false);
    if (succeeded(result)) await loadAll();
  };

  const createProfile = async () => {
    if (!runtime.available || busy || profileName.trim().length < 2) return;
    setBusy(true);
    setError('');
    const result = await startupClient.profiles({
      action: 'create',
      name: profileName.trim(),
      enabledItemIds: [...profileItems],
    });
    setBusy(false);
    if (succeeded(result) && result.data) {
      setProfiles(result.data.profiles);
      setProfileName('');
    } else reportFailure(result);
  };

  if (!module) return null;

  const protectedServices = services.filter(item => item.protected).length;
  const averageBoot = impact?.averageBootMs ?? bootHistory.find(item => item.bootDurationMs)?.bootDurationMs;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4 rtl:flex-row-reverse">
            <div className="knoux-icon-plate h-16 w-16 rounded-2xl"><Zap className="h-8 w-8" /></div>
            <div>
              <div className="knoux-eyebrow">{t('Verified startup control', 'تحكم موثق في بدء التشغيل')}</div>
              <h1 className="mt-2 text-3xl font-black text-[var(--knoux-text)] md:text-5xl">{t(module.nameEn, module.nameAr)}</h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--knoux-text-secondary)]">{t(module.descriptionEn, module.descriptionAr)}</p>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${runtime.available ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <p className="font-black text-[var(--knoux-text)]">{runtime.available ? t('Windows startup engine connected', 'محرك بدء تشغيل ويندوز متصل') : t('Desktop application required', 'يلزم تطبيق سطح المكتب')}</p>
            <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{runtime.available ? t('Microsoft and system entries remain protected.', 'تظل عناصر Microsoft والنظام محمية.') : t(runtime.reasonEn ?? '', runtime.reasonAr ?? '')}</p>
          </div>
        </div>
      </section>

      {!runtime.available && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm font-semibold leading-7 text-amber-100">
          {t('The browser preview does not fabricate startup entries, services, scheduled tasks, or boot times. Open KNOUX ONE Desktop on Windows.', 'نسخة المتصفح لا تنشئ عناصر بدء تشغيل أو خدمات أو مهام أو أزمنة إقلاع تجريبية. افتح KNOUX ONE Desktop على ويندوز.')}
        </section>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [t('Startup items', 'عناصر بدء التشغيل'), startupItems.length, <Play className="h-5 w-5" />],
          [t('Review recommended', 'تحتاج مراجعة'), recommendations?.recommendations.length ?? 0, <AlertTriangle className="h-5 w-5" />],
          [t('Protected services', 'خدمات محمية'), protectedServices, <ShieldCheck className="h-5 w-5" />],
          [t('Restorable changes', 'تغييرات قابلة للاستعادة'), changes.length, <RotateCcw className="h-5 w-5" />],
          [t('Average boot', 'متوسط الإقلاع'), formatDuration(averageBoot), <Clock3 className="h-5 w-5" />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="knoux-glass-panel p-5">
            <div className="flex items-center justify-between text-[var(--knoux-primary-bright)]">{icon}<span className="knoux-chip">M05</span></div>
            <div className="mt-4 text-2xl font-black text-[var(--knoux-text)]">{String(value)}</div>
            <div className="mt-1 text-xs font-bold text-[var(--knoux-text-muted)]">{label}</div>
          </div>
        ))}
      </section>

      <section className="knoux-glass-panel p-4">
        <div className="flex flex-wrap gap-2">
          {([
            ['startup', t('Startup programs', 'برامج بدء التشغيل')],
            ['tasks', t('Scheduled tasks', 'المهام المجدولة')],
            ['services', t('Windows services', 'خدمات ويندوز')],
            ['profiles', t('Profiles & restore', 'البروفايلات والاستعادة')],
            ['history', t('Boot history', 'سجل الإقلاع')],
          ] as Array<[Tab, string]>).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`knoux-card-action ${tab === id ? 'knoux-card-action--primary' : ''}`}>{label}</button>
          ))}
          <button type="button" onClick={() => void loadAll()} disabled={!runtime.available || busy} className="knoux-card-action ms-auto disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{t('Refresh', 'تحديث')}</button>
        </div>
      </section>

      {error && <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm font-bold text-red-200">{error}</section>}

      {pending && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3 rtl:flex-row-reverse"><Lock className="mt-1 h-5 w-5 text-amber-300" /><div className="flex-1">
            <h2 className="font-black text-[var(--knoux-text)]">{t('Confirm the startup change', 'تأكيد تغيير بدء التشغيل')}</h2>
            <p className="mt-2 text-sm text-[var(--knoux-text-secondary)]">{t('Type the exact confirmation below. Protected and machine-wide entries cannot be changed from this workflow.', 'اكتب نص التأكيد كما هو. لا يمكن تغيير عناصر النظام المحمية أو عناصر الجهاز بالكامل من هذا المسار.')}</p>
            <code className="mt-3 block rounded-xl bg-black/20 px-3 py-2 text-xs font-bold text-amber-200">{exactConfirmation(pending)}</code>
            {pending.kind === 'delay' && (
              <select value={delaySeconds} onChange={event => setDelaySeconds(Number(event.target.value) as 30 | 60 | 90)} className="mt-3 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-3 py-2 text-[var(--knoux-text)]">
                <option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={90}>90 seconds</option>
              </select>
            )}
            <input value={confirmation} onChange={event => setConfirmation(event.target.value)} className="mt-3 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)] outline-none focus:border-amber-400" autoComplete="off" />
            <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => void runPendingAction()} disabled={busy || confirmation !== exactConfirmation(pending)} className="knoux-card-action knoux-card-action--primary disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{t('Apply verified change', 'تطبيق التغيير الموثق')}</button><button type="button" onClick={() => { setPending(null); setConfirmation(''); }} disabled={busy} className="knoux-card-action">{t('Cancel', 'إلغاء')}</button></div>
          </div></div>
        </section>
      )}

      {tab === 'startup' && (
        <div className="space-y-5">
          {impact && <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-sm leading-7 text-[var(--knoux-text-secondary)]"><Activity className="me-2 inline h-4 w-4 text-sky-300" />{t(impact.scoringNoticeEn, impact.scoringNoticeAr)}</section>}
          {startupItems.length === 0 ? <section className="knoux-glass-panel p-8 text-center text-[var(--knoux-text-muted)]">{t('No startup items were returned by Windows.', 'لم يُرجع ويندوز عناصر بدء تشغيل.')}</section> : (
            <section className="grid gap-3">
              {startupItems.map(item => (
                <article key={item.id} className="knoux-glass-panel p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-[var(--knoux-text)]">{item.name}</h3><span className="knoux-chip">{item.scope}</span><span className="knoux-chip">{item.sourceKind}</span>{item.protected && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">{t('Protected', 'محمي')}</span>}</div><p className="mt-2 break-all text-xs leading-6 text-[var(--knoux-text-muted)]">{item.command}</p><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-[var(--knoux-text-secondary)]"><span>{t('Publisher', 'الناشر')}: {item.publisher || t('Unknown', 'غير معروف')}</span><span>•</span><span>{t('Signature', 'التوقيع')}: {item.signatureStatus}</span><span>•</span><span>{t('Review score', 'درجة المراجعة')}: {item.impactScore}/100</span></div></div>
                    <div className="flex flex-wrap gap-2">{item.mutable ? <><button type="button" onClick={() => { setPending({ kind: 'disable', item }); setConfirmation(''); }} disabled={busy} className="knoux-card-action"><Settings2 className="h-4 w-4" />{t('Disable safely', 'تعطيل آمن')}</button><button type="button" onClick={() => { setPending({ kind: 'delay', item }); setConfirmation(''); }} disabled={busy} className="knoux-card-action"><Clock3 className="h-4 w-4" />{t('Delay start', 'تأخير التشغيل')}</button></> : <span className="text-xs font-bold text-[var(--knoux-text-muted)]">{t('Inspection only', 'للفحص فقط')}</span>}</div>
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      )}

      {tab === 'tasks' && <section className="grid gap-3">{tasks.map(task => <article key={task.id} className="knoux-glass-panel p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-black text-[var(--knoux-text)]">{task.taskPath}{task.taskName}</h3><p className="mt-2 break-all text-xs text-[var(--knoux-text-muted)]">{task.action}</p></div><span className="knoux-chip">{task.state}</span></div><div className="mt-3 text-xs text-[var(--knoux-text-secondary)]">{task.trigger} • {task.author || t('Unknown author', 'ناشر غير معروف')} {task.protected ? `• ${t('Microsoft protected', 'محمي من Microsoft')}` : ''}</div></article>)}</section>}

      {tab === 'services' && <section className="grid gap-3 lg:grid-cols-2">{services.map(service => <article key={service.id} className="knoux-glass-panel p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-black text-[var(--knoux-text)]">{service.displayName}</h3><span className="knoux-chip">{service.state}</span></div><p className="mt-1 text-xs font-bold text-[var(--knoux-text-muted)]">{service.name} • {service.startMode}</p><p className="mt-3 break-all text-xs leading-6 text-[var(--knoux-text-secondary)]">{service.pathName}</p><div className="mt-3 flex items-center gap-2 text-xs font-bold">{service.protected ? <ShieldCheck className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-amber-300" />}<span className="text-[var(--knoux-text-muted)]">{t(service.recommendation, service.protected ? 'خدمة ويندوز أو Microsoft محمية وللفحص فقط.' : 'خدمة خارجية؛ راجع توثيق الناشر قبل أي تغيير.')}</span></div></article>)}</section>}

      {tab === 'profiles' && (
        <div className="space-y-5">
          <section className="knoux-glass-panel p-5"><h2 className="font-black text-[var(--knoux-text)]">{t('Create a startup profile', 'إنشاء بروفايل بدء تشغيل')}</h2><p className="mt-2 text-sm text-[var(--knoux-text-muted)]">{t('Select the user entries that should remain enabled. Machine and protected entries are never changed.', 'حدد عناصر المستخدم التي يجب أن تظل مفعلة. لا يتم تغيير عناصر الجهاز أو العناصر المحمية.')}</p><input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder={t('Profile name', 'اسم البروفايل')} className="mt-4 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]" /><div className="mt-4 grid gap-2 md:grid-cols-2">{mutableItems.map(item => <label key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--knoux-border)] p-3"><input type="checkbox" checked={profileItems.has(item.id)} onChange={event => { const next = new Set(profileItems); if (event.target.checked) next.add(item.id); else next.delete(item.id); setProfileItems(next); }} /><span className="text-sm font-bold text-[var(--knoux-text)]">{item.name}</span></label>)}</div><button type="button" onClick={() => void createProfile()} disabled={busy || profileName.trim().length < 2} className="knoux-card-action knoux-card-action--primary mt-4 disabled:opacity-50"><Save className="h-4 w-4" />{t('Save profile', 'حفظ البروفايل')}</button></section>
          <section className="grid gap-3 md:grid-cols-2">{profiles.map(profile => <article key={profile.id} className="knoux-glass-panel p-5"><h3 className="font-black text-[var(--knoux-text)]">{profile.name}</h3><p className="mt-2 text-xs text-[var(--knoux-text-muted)]">{profile.enabledItemIds.length} {t('enabled user items', 'عنصر مستخدم مفعّل')}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { setPending({ kind: 'apply-profile', profile }); setConfirmation(''); }} className="knoux-card-action"><Play className="h-4 w-4" />{t('Apply', 'تطبيق')}</button><button type="button" onClick={() => { setPending({ kind: 'delete-profile', profile }); setConfirmation(''); }} className="knoux-card-action"><Trash2 className="h-4 w-4" />{t('Delete', 'حذف')}</button></div></article>)}</section>
          <section className="knoux-glass-panel p-5"><h2 className="font-black text-[var(--knoux-text)]">{t('Restorable changes', 'التغييرات القابلة للاستعادة')}</h2><div className="mt-4 grid gap-3">{changes.map(change => <article key={change.id} className="rounded-xl border border-[var(--knoux-border)] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h3 className="font-bold text-[var(--knoux-text)]">{change.itemName}</h3><p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{change.kind} • {new Date(change.createdAt).toLocaleString()}</p></div><button type="button" onClick={() => { setPending({ kind: change.kind === 'delayed' ? 'remove-delay' : 'restore', change }); setConfirmation(''); }} className="knoux-card-action"><RotateCcw className="h-4 w-4" />{t('Restore', 'استعادة')}</button></div></article>)}</div>{changes.length === 0 && <p className="mt-4 text-sm text-[var(--knoux-text-muted)]">{t('No active changes need restoration.', 'لا توجد تغييرات نشطة تحتاج إلى استعادة.')}</p>}</section>
          {activeDelayed.length > 0 && <section className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 text-sm text-[var(--knoux-text-secondary)]"><Clock3 className="me-2 inline h-4 w-4" />{activeDelayed.length} {t('programs currently use delayed startup.', 'برنامجًا تستخدم التشغيل المؤجل حاليًا.')}</section>}
        </div>
      )}

      {tab === 'history' && <section className="knoux-glass-panel overflow-hidden"><div className="border-b border-[var(--knoux-border)] p-5"><h2 className="font-black text-[var(--knoux-text)]">{t('Measured Windows boot history', 'سجل إقلاع ويندوز المقاس')}</h2></div><div className="divide-y divide-[var(--knoux-border)]">{bootHistory.map((metric, index) => <div key={`${metric.measuredAt}-${index}`} className="grid gap-3 p-5 md:grid-cols-4"><div><div className="text-xs text-[var(--knoux-text-muted)]">{t('Date', 'التاريخ')}</div><div className="mt-1 font-bold text-[var(--knoux-text)]">{new Date(metric.measuredAt).toLocaleString()}</div></div><div><div className="text-xs text-[var(--knoux-text-muted)]">{t('Full boot', 'الإقلاع الكامل')}</div><div className="mt-1 font-black text-[var(--knoux-text)]">{formatDuration(metric.bootDurationMs)}</div></div><div><div className="text-xs text-[var(--knoux-text-muted)]">{t('Main path', 'المسار الرئيسي')}</div><div className="mt-1 font-black text-[var(--knoux-text)]">{formatDuration(metric.mainPathBootMs)}</div></div><div><div className="text-xs text-[var(--knoux-text-muted)]">{t('Post boot', 'بعد الإقلاع')}</div><div className="mt-1 font-black text-[var(--knoux-text)]">{formatDuration(metric.bootPostBootMs)}</div></div></div>)}</div>{bootHistory.length === 0 && <div className="p-8 text-center text-[var(--knoux-text-muted)]">{t('Windows returned no Event 100 boot records.', 'لم يُرجع ويندوز سجلات إقلاع من الحدث 100.')}</div>}</section>}

      {recommendations && recommendations.recommendations.length > 0 && <section className="knoux-glass-panel p-5"><div className="flex items-center gap-3 rtl:flex-row-reverse"><ListChecks className="h-5 w-5 text-amber-300" /><h2 className="font-black text-[var(--knoux-text)]">{t('Safe review recommendations', 'توصيات المراجعة الآمنة')}</h2></div><div className="mt-4 grid gap-3 md:grid-cols-2">{recommendations.recommendations.map(item => <article key={item.itemId} className="rounded-xl border border-[var(--knoux-border)] p-4"><h3 className="font-bold text-[var(--knoux-text)]">{item.itemName}</h3><p className="mt-2 text-xs leading-6 text-[var(--knoux-text-muted)]">{t(item.recommendationEn, item.recommendationAr)}</p></article>)}</div></section>}
    </div>
  );
};
