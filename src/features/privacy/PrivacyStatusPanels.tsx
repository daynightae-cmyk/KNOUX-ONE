import React, { useCallback, useState } from 'react';
import { Eraser, Eye, EyeOff, FileSearch, RefreshCw, ScrollText, ShieldEllipsis } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { privacyClient } from './privacyClient';
import type {
  AdvertisingIdStatus,
  ClipboardPrivacy,
  HostsFileReport,
  PermissionDashboard,
  SourceReport,
} from './privacyContracts';

type Verdict = 'yes' | 'no' | 'unknown';

const verdict = (value: boolean | null | undefined): Verdict =>
  value === true ? 'yes' : value === false ? 'no' : 'unknown';

const verdictTone = (value: Verdict) =>
  value === 'yes'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : value === 'no'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

const Banner: React.FC<{ tone: 'info' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => (
  <p
    className={`rounded-xl border p-3 text-xs leading-6 ${
      tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : tone === 'muted'
          ? 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)]'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-200'
    }`}
  >
    {children}
  </p>
);

const Readout: React.FC<{ label: string; value: string; state?: Verdict }> = ({ label, value, state }) => (
  <div className={`rounded-2xl border p-4 ${state ? verdictTone(state) : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]'}`}>
    <p className="text-xs font-bold opacity-80">{label}</p>
    <p className="mt-2 break-all text-sm font-black">{value || '—'}</p>
  </div>
);

const SourceList: React.FC<{ sources: SourceReport[] }> = ({ sources }) => (
  <div className="space-y-2">
    {sources.map(item => (
      <div
        key={item.name}
        className={`rounded-xl border p-3 text-[11px] ${
          item.available
            ? 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-secondary)]'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        }`}
      >
        <p className="font-black">{item.name}</p>
        <p className="mt-1 leading-5">{item.detail}</p>
      </div>
    ))}
  </div>
);

const Panel: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="knoux-glass-panel p-5 md:p-7">
    <div className="knoux-eyebrow">
      <ShieldEllipsis className="h-4 w-4" />
      {title}
    </div>
    <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-muted)]">{subtitle}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

const useRead = <T,>(load: () => Promise<{ data?: T; message: string }>) => {
  const [data, setData] = useState<T | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const result = await load();
    setBusy(false);
    setData(result.data ?? null);
    setMessage(result.message);
  }, [busy, load]);
  return { data, message, busy, run };
};

/**
 * The permission states are named by the engine, and the label follows the name rather
 * than re-deriving it from the raw `value`. "Used but no decision recorded" and "never
 * asked" are different facts about the user's machine and must not render the same way.
 */
const stateLabel = (state: string, language: 'en' | 'ar'): string => {
  const labels: Record<string, [string, string]> = {
    allowed: ['allowed', 'مسموح'],
    denied: ['denied', 'مرفوض'],
    prompt_recorded_and_used: ['prompt shown, then used', 'عُرضت الموافقة ثم استُخدم'],
    prompt_pending: ['prompt pending', 'الموافقة معلّقة'],
    used_no_decision_recorded: ['used, no decision recorded here', 'استُخدم بلا قرار مسجّل هنا'],
    no_decision_and_never_used: ['no decision, never used', 'لا قرار ولم يُستخدم'],
  };
  const entry = labels[state] ?? [state, state];
  return language === 'ar' ? entry[1] : entry[0];
};

const CapabilityTable: React.FC<{ dashboard: PermissionDashboard; language: 'en' | 'ar' }> = ({ dashboard, language }) => {
  if (dashboard.capabilities.length === 0) {
    return (
      <Banner tone="warn">
        {language === 'ar'
          ? 'لا توجد قدرة في مخزن الموافقات المقاس لهذا الحساب. هذا قياس، وليس تأكيدًا على أن أي إذن ممنوح.'
          : 'No capability is present in the measured consent store for this account. That is a measurement, not an assurance that nothing is permitted.'}
      </Banner>
    );
  }
  return (
    <div className="space-y-4">
      {dashboard.capabilities.map(capability => (
        <div key={capability.capability} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-[var(--knoux-text)]">
              {language === 'ar' ? capability.capabilityLabelAr : capability.capabilityLabelEn}
              <code className="ms-2 text-[11px] text-[var(--knoux-text-muted)]">{capability.capability}</code>
            </p>
            <p className="text-[11px] text-[var(--knoux-text-muted)]">
              {capability.allowCount} · {capability.denyCount} · {capability.undecidedButUsedCount} · {capability.unusedCount}
            </p>
          </div>
          {!capability.consentStorePresent ? (
            <p className="mt-2 text-[11px] text-amber-200">
              {language === 'ar' ? 'لا يوجد مخزن موافقات لهذه القدرة على هذا الحساب.' : 'No consent store exists for this capability on this account.'}
            </p>
          ) : capability.apps.length === 0 ? (
            <p className="mt-2 text-[11px] text-amber-200">
              {language === 'ar' ? 'المخزن موجود لكنه لا يسرد أي تطبيق.' : 'The consent store exists but lists no application.'}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-1">{language === 'ar' ? 'التطبيق' : 'Application'}</th>
                    <th className="py-1">{language === 'ar' ? 'الحالة' : 'State'}</th>
                    <th className="py-1">{language === 'ar' ? 'آخر استخدام' : 'Last used'}</th>
                  </tr>
                </thead>
                <tbody>
                  {capability.apps.map(app => (
                    <tr key={`${app.appKind}-${app.appKey}`} className="border-t border-[var(--knoux-border)]">
                      <td className="break-all py-1 font-bold text-[var(--knoux-text)]">
                        {app.appName || app.appKey}
                        <span className="ms-2 text-[10px] text-[var(--knoux-text-muted)]">{app.appKind}</span>
                      </td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">{stateLabel(app.state, language)}</td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">
                        {app.everUsed && app.lastUsedStart ? new Date(app.lastUsedStart).toLocaleString() : language === 'ar' ? 'أبدًا' : 'never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const PrivacyStatusPanels: React.FC<{ available: boolean }> = ({ available }) => {
  const { t, language, addLog } = useKnoux();
  const pick = (en: string, ar: string) => t(en, ar);

  const dashboard = useRead<PermissionDashboard>(async () => {
    const result = await privacyClient.permissionDashboard();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const camera = useRead<PermissionDashboard>(async () => {
    const result = await privacyClient.cameraPermission();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const microphone = useRead<PermissionDashboard>(async () => {
    const result = await privacyClient.microphonePermission();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const location = useRead<PermissionDashboard>(async () => {
    const result = await privacyClient.locationPermission();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const advertising = useRead<AdvertisingIdStatus>(async () => {
    const result = await privacyClient.advertisingId();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const hosts = useRead<HostsFileReport>(async () => {
    const result = await privacyClient.hostsFile();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });

  // ---- M09-S06 clipboard -----------------------------------------------------
  const [inspectClipboard, setInspectClipboard] = useState(false);
  const [clearToken, setClearToken] = useState('');
  const [clipboard, setClipboard] = useState<ClipboardPrivacy | null>(null);
  const [clipboardMessage, setClipboardMessage] = useState('');
  const [clipboardBusy, setClipboardBusy] = useState(false);

  const readClipboard = useCallback(
    async (mode: 'inspect' | 'clear') => {
      if (!available || clipboardBusy) return;
      setClipboardBusy(true);
      setClipboardMessage('');
      addLog('m09_s06', pick('Clipboard privacy', 'خصوصية الحافظة'), 'in_progress', mode);
      const result = await privacyClient.clipboardPrivacy({
        inspectCurrentClipboard: inspectClipboard,
        confirmation: mode === 'clear' ? clearToken : undefined,
      });
      setClipboardBusy(false);
      setClipboard(result.data ?? null);
      setClipboardMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
      addLog('m09_s06', pick('Clipboard privacy', 'خصوصية الحافظة'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
    },
    [addLog, available, clearToken, clipboardBusy, inspectClipboard, language, pick],
  );

  const readAll = useCallback(async () => {
    if (!available) return;
    addLog('m09_s01', pick('Privacy posture', 'الوضع الخصوصي'), 'in_progress', pick('Reading permissions, advertising identifier and hosts file.', 'قراءة الأذونات ومعرّف الإعلان وملف hosts.'));
    await Promise.all([dashboard.run(), advertising.run(), hosts.run()]);
    addLog('m09_s01', pick('Privacy posture', 'الوضع الخصوصي'), 'completed', pick('Every provider reported its own state.', 'أبلغ كل مزوّد عن حالته بنفسه.'));
  }, [addLog, advertising, available, dashboard, hosts, pick]);

  const anyBusy = dashboard.busy || advertising.busy || hosts.busy;
  const button = (busy: boolean) => (busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldEllipsis className="h-4 w-4" />);

  return (
    <div className="space-y-6">
      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="knoux-eyebrow">{pick('Windows privacy evidence', 'أدلة خصوصية ويندوز')}</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">
              {pick('Read what this account has actually granted', 'اقرأ ما منحه هذا الحساب فعليًا')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--knoux-text-muted)]">
              {pick(
                'Everything below is a reading of a real Windows surface. A surface with no record is reported as unmeasured, never as clean.',
                'كل ما يلي قراءة لسطح حقيقي في ويندوز. والسطح الذي لا سجل له يُبلَّغ عنه كـ«غير مقاس» لا كـ«نظيف».',
              )}
            </p>
          </div>
          <button type="button" onClick={readAll} disabled={!available || anyBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {anyBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldEllipsis className="h-4 w-4" />}
            {pick('Read permissions, advertising ID and hosts', 'اقرأ الأذونات ومعرّف الإعلان وhosts')}
          </button>
        </div>
      </section>

      <Panel
        title={pick('Permission dashboard', 'لوحة أذونات التطبيقات')}
        subtitle={pick(
          'Every camera, microphone and location consent entry Windows recorded for this account, with the per-application allow, deny and never-asked counts and real last-used times.',
          'كل موافقة كاميرا وميكروفون وموقع سجّلها ويندوز لهذا الحساب، مع أعداد السماح والرفض والتطبيقات التي لم تسأل لكل تطبيق وأوقات آخر استخدام حقيقية.',
        )}
      >
        <button type="button" onClick={dashboard.run} disabled={!available || dashboard.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {button(dashboard.busy)}
          {pick('Read the dashboard', 'اقرأ اللوحة')}
        </button>
        {dashboard.message && <Banner tone="info">{dashboard.message}</Banner>}
        {dashboard.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Consent store present', 'مخزن الموافقات موجود')} value={dashboard.data.rootPresent ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(dashboard.data.rootPresent)} />
              <Readout label={pick('Application entries seen', 'إدخالات تطبيقات شوهدت')} value={String(dashboard.data.totalAppsSeen)} />
              <Readout label={pick('Allowed somewhere', 'مسموح في مكان ما')} value={String(dashboard.data.appsAllowedSomewhere)} />
              <Readout label={pick('Changed any permission', 'غيّر أي إذن')} value={dashboard.data.changedAnyPermission ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(!dashboard.data.changedAnyPermission)} />
            </div>
            <CapabilityTable dashboard={dashboard.data} language={language} />
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={dashboard.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Camera, microphone and location', 'الكاميرا والميكروفون والموقع')}
        subtitle={pick(
          'Three separate services, one measurement. Each view is a projection of the same consent store, so they cannot disagree with the dashboard above.',
          'ثلاث خدمات منفصلة، قياس واحد. كل عرض إسقاط لنفس مخزن الموافقات، فلا يمكن أن يناقض لوحة المعلومات أعلاه.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {([
            { label: pick('Camera', 'الكاميرا'), hook: camera, id: 'm09_s02' },
            { label: pick('Microphone', 'الميكروفون'), hook: microphone, id: 'm09_s03' },
            { label: pick('Location', 'الموقع'), hook: location, id: 'm09_s04' },
          ] as const).map(entry => (
            <div key={entry.id} className="rounded-2xl border border-[var(--knoux-border)] p-4">
              <p className="text-sm font-black text-[var(--knoux-text)]">{entry.label}</p>
              <button type="button" onClick={entry.hook.run} disabled={!available || entry.hook.busy} className="knoux-card-action mt-3 w-full justify-center disabled:opacity-50">
                {button(entry.hook.busy)}
                {pick('Read', 'اقرأ')}
              </button>
              {entry.hook.message && <p className="mt-2 text-[11px] leading-5 text-[var(--knoux-text-muted)]">{entry.hook.message}</p>}
              {entry.hook.data && (
                <div className="mt-3 space-y-2">
                  {entry.hook.data.capabilities.length === 0 ? (
                    <Banner tone="warn">
                      {pick(
                        'This capability is absent from the measured store. Absent is not the same as clean.',
                        'هذه القدرة غائبة عن المخزن المقاس. الغياب ليس نظافة.',
                      )}
                    </Banner>
                  ) : (
                    entry.hook.data.capabilities.map(capability => (
                      <div key={capability.capability} className="rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3 text-[11px]">
                        <p className="font-black text-[var(--knoux-text)]">{language === 'ar' ? capability.capabilityLabelAr : capability.capabilityLabelEn}</p>
                        <p className="mt-1 text-[var(--knoux-text-secondary)]">
                          {capability.apps.length} {pick('apps', 'تطبيق')} · {capability.allowCount} {pick('allowed', 'مسموح')} · {capability.denyCount} {pick('denied', 'مرفوض')} ·{' '}
                          {capability.undecidedButUsedCount} {pick('used without a recorded decision', 'استُخدم بلا قرار مسجّل')} · {capability.unusedCount} {pick('never used', 'لم يُستخدم')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        title={pick('Advertising identifier', 'معرّف الإعلان')}
        subtitle={pick(
          'The stored per-user advertising identifier and its switch, read verbatim. Nothing is reset.',
          'معرّف الإعلان المخزّن للمستخدم ومفتاحه، مقروءان حرفيًا. لا تتم أي إعادة تعيين.',
        )}
      >
        <button type="button" onClick={advertising.run} disabled={!available || advertising.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {button(advertising.busy)}
          {pick('Read the advertising identifier', 'اقرأ معرّف الإعلان')}
        </button>
        {advertising.message && <Banner tone="info">{advertising.message}</Banner>}
        {advertising.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Advertising ID enabled', 'معرّف الإعلان مفعّل')}
                value={pick(verdict(advertising.data.enabled), verdict(advertising.data.enabled))}
                state={verdict(advertising.data.enabled)}
              />
              <Readout
                label={pick('Limit ad tracking', 'تحديد تتبّع الإعلانات')}
                value={pick(verdict(advertising.data.limitAdTracking), verdict(advertising.data.limitAdTracking))}
                state={verdict(advertising.data.limitAdTracking)}
              />
              <Readout label={pick('Stored identifier', 'المعرّف المخزّن')} value={advertising.data.advertisingId || pick('none stored', 'لا معرّف مخزّن')} />
              <Readout label={pick('Changed any value', 'غيّر أي قيمة')} value={advertising.data.changedAnyValue ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(!advertising.data.changedAnyValue)} />
            </div>
            {advertising.data.resetPerformedByWindows && (
              <Banner tone="warn">
                {pick(
                  'A stored identifier is present while the feature is switched off. That is what a Windows reset leaves behind; the value is reported as stored, not as active.',
                  'يوجد معرّف مخزّن مع أن الميزة معطّلة. هذا ما تتركه إعادة التعيين في ويندوز؛ يُبلَّغ عن القيمة كـ«مخزّنة» لا كـ«نشطة».',
                )}
              </Banner>
            )}
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{advertising.data.registryPath}</p>
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={advertising.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Clipboard privacy', 'خصوصية الحافظة')}
        subtitle={pick(
          'Reading the clipboard is itself a privacy act, so the content is only described when you ask for it, is cut to a short preview, and is never stored. Clearing needs the literal token and does not clear clipboard history.',
          'قراءة الحافظة نفسها فعل خصوصية، لذا لا يُوصف المحتوى إلا بطلب منك، ويُقتطع إلى معاينة قصيرة، ولا يُخزَّن. ويتطلب المسح رمزًا حرفيًا ولا يمسح سجل الحافظة.',
        )}
      >
        <label className="flex items-center gap-3 text-xs text-[var(--knoux-text-secondary)]">
          <input type="checkbox" checked={inspectClipboard} onChange={event => setInspectClipboard(event.target.checked)} disabled={clipboardBusy} />
          {inspectClipboard ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {pick('Describe the current clipboard (first 60 characters only)', 'وصف الحافظة الحالية (أول 60 حرفًا فقط)')}
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void readClipboard('inspect')} disabled={!available || clipboardBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {clipboardBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            {pick('Read clipboard state', 'اقرأ حالة الحافظة')}
          </button>
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Clear confirmation', 'رمز تأكيد المسح')}</span>
            <input value={clearToken} onChange={event => setClearToken(event.target.value)} placeholder="CLEAR" className="mt-2 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]" disabled={clipboardBusy} />
          </label>
          <button type="button" onClick={() => void readClipboard('clear')} disabled={!available || clipboardBusy || clearToken !== 'CLEAR'} className="knoux-card-action disabled:opacity-50">
            <Eraser className="h-4 w-4" />
            {pick('Clear the clipboard', 'امسح الحافظة')}
          </button>
        </div>
        {clipboardMessage && <Banner tone="info">{clipboardMessage}</Banner>}
        {clipboard && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Clipboard history', 'سجل الحافظة')}
                value={pick(verdict(clipboard.historyEnabled), verdict(clipboard.historyEnabled))}
                state={verdict(clipboard.historyEnabled)}
              />
              <Readout label={pick('Content inspected', 'فُحص المحتوى')} value={clipboard.currentClipboardKind === 'not_inspected' ? pick('no', 'لا') : pick('yes', 'نعم')} state={verdict(clipboard.currentClipboardKind !== 'not_inspected')} />
              <Readout label={pick('Cleared', 'مُسحت')} value={clipboard.cleared ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(clipboard.cleared)} />
              <Readout label={pick('Changed the clipboard', 'غيّرت الحافظة')} value={clipboard.changedClipboard ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(!clipboard.changedClipboard)} />
            </div>
            {clipboard.currentClipboardPreview && (
              <Banner tone="muted">
                {pick('Preview', 'معاينة')}: <code className="break-all">{clipboard.currentClipboardPreview}</code>{' '}
                ({clipboard.currentClipboardCharCount} {pick('characters', 'حرفًا')})
              </Banner>
            )}
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={clipboard.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Hosts file', 'ملف hosts')}
        subtitle={pick(
          'Every active name mapping Windows resolves from the hosts file, with the line it came from. Entries that point a name at an all-zero address are counted as blocks, and an unreadable file is reported as unreadable rather than as empty.',
          'كل تعيين نشط يحلّه ويندوز من ملف hosts، مع رقم السطر. وتُعدّ المداخل التي تشير إلى عنوان أصفار كحجب، ويُبلَّغ عن الملف غير القابل للقراءة كغير قابل للقراءة لا كـ«فارغ».',
        )}
      >
        <button type="button" onClick={hosts.run} disabled={!available || hosts.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {hosts.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          {pick('Inspect the hosts file', 'افحص ملف hosts')}
        </button>
        {hosts.message && <Banner tone="info">{hosts.message}</Banner>}
        {hosts.data && (
          <div className="space-y-4">
            {!hosts.data.readable ? (
              <Banner tone="warn">
                {pick('The hosts file could not be read', 'تعذّرت قراءة ملف hosts')}
                {hosts.data.rejectionReason ? `: ${hosts.data.rejectionReason}` : ''}
              </Banner>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Readout label={pick('Active mappings', 'تعيينات نشطة')} value={String(hosts.data.activeEntryCount)} />
                  <Readout label={pick('Blocking entries', 'مداخل حجب')} value={String(hosts.data.blockingEntryCount)} state={verdict(hosts.data.blockingEntryCount === 0)} />
                  <Readout label={pick('Repeated addresses', 'عناوين مكررة')} value={String(hosts.data.duplicateAddressCount)} />
                  <Readout label={pick('File modified', 'عُدّل الملف')} value={hosts.data.fileModified ? pick('yes', 'نعم') : pick('no', 'لا')} state={verdict(!hosts.data.fileModified)} />
                </div>
                <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">
                  <ScrollText className="me-2 inline h-3 w-3" />
                  {hosts.data.path} · {hosts.data.byteCount} {pick('bytes', 'بايت')} · {pick('modified', 'عُدّل')} {hosts.data.modifiedAt ? new Date(hosts.data.modifiedAt).toLocaleString() : '—'} ·{' '}
                  {hosts.data.commentLineCount} {pick('comment lines', 'سطر تعليق')} · {hosts.data.blankLineCount} {pick('blank lines', 'سطر فارغ')}
                </p>
                {hosts.data.entries.length === 0 ? (
                  <Banner tone="warn">
                    {pick(
                      'No active name mapping was found. That is a measurement of this file, not an assurance that no other resolver is in play.',
                      'لم يُعثر على أي تعيين نشط. هذا قياس لهذا الملف، وليس تأكيدًا على عدم وجود محلّل آخر.',
                    )}
                  </Banner>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-[11px]">
                      <thead>
                        <tr className="text-[var(--knoux-text-muted)]">
                          <th className="py-1">{pick('Line', 'السطر')}</th>
                          <th className="py-1">{pick('Address', 'العنوان')}</th>
                          <th className="py-1">{pick('Host names', 'أسماء المضيفين')}</th>
                          <th className="py-1">{pick('Comment', 'التعليق')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {hosts.data.entries.map(entry => (
                          <tr key={`${entry.lineNumber}-${entry.address}`} className="border-t border-[var(--knoux-border)]">
                            <td className="py-1 text-[var(--knoux-text-muted)]">{entry.lineNumber}</td>
                            <td className="py-1 font-mono text-[var(--knoux-text)]">{entry.address}</td>
                            <td className="break-all py-1 text-[var(--knoux-text-secondary)]">{entry.hostnames}</td>
                            <td className="break-all py-1 text-[var(--knoux-text-muted)]">{entry.comment || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={hosts.data.sources} />
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
};
