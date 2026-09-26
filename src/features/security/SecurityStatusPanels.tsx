import React, { useCallback, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { securityClient } from './securityClient';
import type {
  DefenderStatus,
  FirewallStatus,
  SecureBootTpmStatus,
  SmartScreenStatus,
  SourceReport,
  UacStatus,
} from './securityContracts';

type Verdict = 'yes' | 'no' | 'unknown';

const verdictIcon = (verdict: Verdict) =>
  verdict === 'yes' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : verdict === 'no' ? <XCircle className="h-4 w-4 text-rose-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />;

const verdictTone = (verdict: Verdict) =>
  verdict === 'yes'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
    : verdict === 'no'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-200';

/**
 * A boolean that Windows did not report must not render as "off". `undefined` becomes
 * `unknown`, which is the only honest third state.
 */
const verdict = (value: boolean | null | undefined): Verdict =>
  value === true ? 'yes' : value === false ? 'no' : 'unknown';

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
  <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
    <p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p>
    <div className="mt-2 flex items-start gap-2">
      {state && verdictIcon(state)}
      <p className="break-all text-sm font-black text-[var(--knoux-text)]">{value || '—'}</p>
    </div>
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
      <ShieldCheck className="h-4 w-4" />
      {title}
    </div>
    <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-muted)]">{subtitle}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

/**
 * A single "read every status" button, because these five inspections share one failure
 * mode: if the desktop runtime is missing, all of them report the same thing and running
 * them separately would just produce five identical errors.
 */
const useSecurityRead = <T,>(load: () => Promise<{ data?: T; message: string }>) => {
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

export const SecurityStatusPanels: React.FC<{ available: boolean }> = ({ available }) => {
  const { t, language, addLog } = useKnoux();
  const pick = (en: string, ar: string) => t(en, ar);

  const summarize = (en: string, ar: string, ok: boolean, failed: string) => (ok ? pick(en, ar) : failed);

  const defender = useSecurityRead<DefenderStatus>(async () => {
    const result = await securityClient.defenderStatus();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const firewall = useSecurityRead<FirewallStatus>(async () => {
    const result = await securityClient.firewallStatus();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const uac = useSecurityRead<UacStatus>(async () => {
    const result = await securityClient.uacStatus();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const smartScreen = useSecurityRead<SmartScreenStatus>(async () => {
    const result = await securityClient.smartScreenStatus();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const secureBoot = useSecurityRead<SecureBootTpmStatus>(async () => {
    const result = await securityClient.secureBootTpmStatus();
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });

  const readAll = useCallback(async () => {
    if (!available) return;
    addLog('m10_s01', pick('Security posture', 'الوضع الأمني'), 'in_progress', pick('Reading Defender, firewall, UAC, SmartScreen, Secure Boot and TPM.', 'قراءة Defender وجدار الحماية والتحكم في الحسابات وSmartScreen وSecure Boot وTPM.'));
    await Promise.all([defender.run(), firewall.run(), uac.run(), smartScreen.run(), secureBoot.run()]);
    addLog('m10_s01', pick('Security posture', 'الوضع الأمني'), 'completed', pick('Every provider reported its own state.', 'أبلغ كل مزوّد عن حالته بنفسه.'));
  }, [addLog, available, defender, firewall, pick, secureBoot, smartScreen, uac]);

  const anyBusy = defender.busy || firewall.busy || uac.busy || smartScreen.busy || secureBoot.busy;
  const action = (busy: boolean) =>
    busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />;

  return (
    <div className="space-y-6">
      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="knoux-eyebrow">{pick('Windows security evidence', 'أدلة أمان ويندوز')}</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">
              {pick('Read this machine\u2019s security posture', 'اقرأ الوضع الأمني لهذا الجهاز')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--knoux-text-muted)]">
              {pick(
                'Five read-only inspections. Each names every provider it asked, so a provider that stayed silent is visible instead of being read as a healthy result.',
                'خمسة فحوص للقراءة فقط. يذكر كل فحص كل مزوّد استشاره، فيظهر المزوّد الصامت بدل أن يُقرأ كنتيجة سليمة.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={readAll}
            disabled={!available || anyBusy}
            className="knoux-card-action knoux-card-action--primary disabled:opacity-50"
          >
            {anyBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {pick('Read all five', 'اقرأ الخمسة')}
          </button>
        </div>
      </section>

      <Panel
        title={pick('Microsoft Defender', 'Microsoft Defender')}
        subtitle={pick(
          'Status, signature version and age, last scan ages, and the complete exclusion list. Exclusions are shown in full because an exclusion is precisely what a silent summary would hide.',
          'الحالة وإصدار التوقيع وعمره وأعمار آخر الفحوص وقائمة الاستثناءات الكاملة. تُعرض الاستثناءات كاملة لأن الاستثناء هو بالضبط ما يخفيه الملخص الصامت.',
        )}
      >
        <button type="button" onClick={defender.run} disabled={!available || defender.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {action(defender.busy)}
          {pick('Read Defender status', 'اقرأ حالة Defender')}
        </button>
        {defender.message && <Banner tone="info">{defender.message}</Banner>}
        {defender.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Antivirus enabled', 'الحماية من الفيروسات')}
                value={pick(verdict(defender.data.antivirusEnabled), verdict(defender.data.antivirusEnabled))}
                state={verdict(defender.data.antivirusEnabled)}
              />
              <Readout
                label={pick('Real-time protection', 'الحماية الفورية')}
                value={pick('on', 'مفعّلة').toString()}
                state={verdict(defender.data.realTimeProtectionEnabled)}
              />
              <Readout label={pick('Signature', 'التوقيع')} value={defender.data.antivirusSignatureVersion} />
              <Readout
                label={pick('Signature age (days)', 'عمر التوقيع (أيام)')}
                value={defender.data.antivirusSignatureLastUpdated ? new Date(defender.data.antivirusSignatureLastUpdated).toLocaleString() : '—'}
              />
              <Readout
                label={pick('Last quick scan (days)', 'آخر فحص سريع (أيام)')}
                value={defender.data.history.quickScanAgeDays == null ? pick('not reported', 'غير مُبلَّغ') : String(defender.data.history.quickScanAgeDays)}
              />
              <Readout
                label={pick('Last full scan (days)', 'آخر فحص كامل (أيام)')}
                value={defender.data.history.fullScanAgeDays == null ? pick('not reported', 'غير مُبلَّغ') : String(defender.data.history.fullScanAgeDays)}
              />
              <Readout label={pick('Engine', 'المحرك')} value={defender.data.engineVersion} />
              <Readout
                label={pick('Excluded paths', 'مسارات مستثناة')}
                value={`${defender.data.exclusionPathCount} (${defender.data.exclusionProcessCount} ${pick('processes', 'عمليات')})`}
              />
            </div>
            <Banner tone="muted">
              {pick('Changed any setting', 'غيّر أي إعداد')}: {defender.data.changedAnySetting ? pick('yes', 'نعم') : pick('no', 'لا')} ·{' '}
              {pick('Started a scan', 'بدأ فحصًا')}: {defender.data.scanStarted ? pick('yes', 'نعم') : pick('no', 'لا')}
            </Banner>
            {defender.data.exclusionPaths.length > 0 && (
              <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
                <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">
                  {pick('Full exclusion list', 'قائمة الاستثناءات الكاملة')} ({defender.data.exclusionPaths.length})
                </summary>
                <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-[11px] text-[var(--knoux-text-secondary)]">
                  {defender.data.exclusionPaths.map(path => (
                    <li key={path} className="break-all font-mono">
                      {path}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={defender.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Windows Firewall', 'جدار حماية ويندوز')}
        subtitle={pick(
          'Every profile with its default actions and logging state, plus a count of the active rules. Rules are counted rather than listed, because a dump of several hundred rules is not a status.',
          'كل ملف تعريف مع إجراءاته الافتراضية وحالة التسجيل، مع عدد القواعد النشطة. تُعدّ القواعد بدل سردها، لأن几百 قاعدة ليست حالة.',
        )}
      >
        <button type="button" onClick={firewall.run} disabled={!available || firewall.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {action(firewall.busy)}
          {pick('Read firewall status', 'اقرأ حالة جدار الحماية')}
        </button>
        {firewall.message && <Banner tone="info">{firewall.message}</Banner>}
        {firewall.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Profiles disabled', 'ملفات تعريف معطّلة')}
                value={`${firewall.data.profilesDisabled} / ${firewall.data.profiles.length}`}
                state={verdict(firewall.data.profilesDisabled === 0)}
              />
              <Readout
                label={pick('Block inbound by default', 'حجب الوارد افتراضيًا')}
                value={`${firewall.data.inboundBlockedByDefaultProfiles} / ${firewall.data.profiles.length}`}
                state={verdict(firewall.data.inboundBlockedByDefaultProfiles === firewall.data.profiles.length)}
              />
              <Readout label={pick('Active rules counted', 'قواعد نشطة محسوبة')} value={String(firewall.data.ruleCountTotal)} />
              <Readout
                label={pick('Changed any rule', 'غيّر أي قاعدة')}
                value={firewall.data.changedAnyRule ? pick('yes', 'نعم') : pick('no', 'لا')}
                state={verdict(!firewall.data.changedAnyRule)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-2">{pick('Profile', 'الملف الشخصي')}</th>
                    <th className="py-2">{pick('Enabled', 'مفعّل')}</th>
                    <th className="py-2">{pick('Default in', 'الوارد افتراضيًا')}</th>
                    <th className="py-2">{pick('Default out', 'الصادر افتراضيًا')}</th>
                    <th className="py-2">{pick('Logging', 'التسجيل')}</th>
                  </tr>
                </thead>
                <tbody>
                  {firewall.data.profiles.map(profile => (
                    <tr key={profile.name} className="border-t border-[var(--knoux-border)]">
                      <td className="py-2 font-bold text-[var(--knoux-text)]">{profile.name}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{profile.enabled === null ? pick('not reported', 'غير مُبلَّغ') : profile.enabled ? pick('yes', 'نعم') : pick('no', 'لا')}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{profile.defaultInboundAction}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{profile.defaultOutboundAction}</td>
                      <td className="break-all py-2 text-[var(--knoux-text-secondary)]">{profile.logFileName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={firewall.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('User Account Control', 'التحكم في حسابات المستخدمين')}
        subtitle={pick(
          'The machine and per-user policy values, each with its plain meaning. The machine policy governs: a per-user value can only make UAC stricter, never weaker.',
          'قيم سياسة الجهاز والمستخدم، مع معنى كل منها. سياسة الجهاز هي الحاكمة: القيمة على مستوى المستخدم يمكنها أن تشدّد فقط.',
        )}
      >
        <button type="button" onClick={uac.run} disabled={!available || uac.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {action(uac.busy)}
          {pick('Read UAC policy', 'اقرأ سياسة التحكم')}
        </button>
        {uac.message && <Banner tone="info">{uac.message}</Banner>}
        {uac.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('UAC enabled (machine)', 'التحكم مفعّل (الجهاز)')}
                value={pick(verdict(uac.data.userAccountControlEnabled), verdict(uac.data.userAccountControlEnabled))}
                state={verdict(uac.data.userAccountControlEnabled)}
              />
              <Readout
                label={pick('Per-user override', 'تجاوز على مستوى المستخدم')}
                value={uac.data.perUserOverridePresent ? (uac.data.perUserEnableLua === true ? pick('present, on', 'موجود، مفعّل') : pick('present, off', 'موجود، معطّل')) : pick('none', 'لا يوجد')}
                state={verdict(!uac.data.perUserOverridePresent)}
              />
              <Readout
                label={pick('Secure desktop prompts', 'نوافذ على سطح المكتب الآمن')}
                value={uac.data.secureDesktopDefault ?? pick('not reported', 'غير مُبلَّغ')}
              />
              <Readout
                label={pick('Elevation requested', 'طُلب رفع الصلاحيات')}
                value={uac.data.elevationPerformed ? pick('yes', 'نعم') : pick('no', 'لا')}
                state={verdict(!uac.data.elevationPerformed)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-2">{pick('Policy value', 'قيمة السياسة')}</th>
                    <th className="py-2">{pick('Present', 'موجودة')}</th>
                    <th className="py-2">{pick('Reading', 'المعنى')}</th>
                  </tr>
                </thead>
                <tbody>
                  {uac.data.machineValues.map(item => (
                    <tr key={item.name} className="border-t border-[var(--knoux-border)]">
                      <td className="py-2 font-mono text-[var(--knoux-text)]">{item.name}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{item.present ? item.value : pick('not set', 'غير مضبوطة')}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{language === 'ar' ? item.meaningAr : item.meaningEn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Banner tone="muted">{uac.data.governingScope}</Banner>
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={uac.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Microsoft SmartScreen', 'Microsoft SmartScreen')}
        subtitle={pick(
          'Six policy locations are probed, because Windows reads SmartScreen from different places on different builds. Each readable value is reported with its origin; when none is readable the service says unknown rather than assuming it is on.',
          'تُفحص ستة مواضع للسياسة، لأن ويندوز يقرأ SmartScreen من مواضع مختلفة حسب الإصدار. تُبلَّغ عن كل قيمة قابلة للقراءة مع موضعها؛ وإذا لم تكن هناك أي قيمة تقول الخدمة غير معروف بدل افتراض أنها مفعّلة.',
        )}
      >
        <button type="button" onClick={smartScreen.run} disabled={!available || smartScreen.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {action(smartScreen.busy)}
          {pick('Read SmartScreen policy', 'اقرأ سياسة SmartScreen')}
        </button>
        {smartScreen.message && <Banner tone="info">{smartScreen.message}</Banner>}
        {smartScreen.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Enforcement', 'الإنفاذ')}
                value={smartScreen.data.effectiveEnforcement}
                state={
                  smartScreen.data.effectiveEnforcement === 'enabled_at_every_readable_location'
                    ? 'yes'
                    : smartScreen.data.effectiveEnforcement === 'disabled_at_least_one_location'
                      ? 'no'
                      : 'unknown'
                }
              />
              <Readout label={pick('Locations readable', 'مواقع قابلة للقراءة')} value={`${smartScreen.data.settingsRead} / 6`} />
              <Readout label={pick('Locations empty', 'مواقع فارغة')} value={String(smartScreen.data.settingsMissing)} />
              <Readout
                label={pick('Changed any value', 'غيّر أي قيمة')}
                value={smartScreen.data.changedAnyValue ? pick('yes', 'نعم') : pick('no', 'لا')}
                state={verdict(!smartScreen.data.changedAnyValue)}
              />
            </div>
            {smartScreen.data.sources.length === 0 ? (
              <Banner tone="warn">
                {pick(
                  'No SmartScreen policy value was readable at any probed location. That is reported as unknown, not as enabled.',
                  'لم تُقرأ أي قيمة سياسة SmartScreen في أي موضع مفحوص. يُبلَّغ عن ذلك كـ«غير معروف» لا كـ«مفعّل».',
                )}
              </Banner>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11px]">
                  <thead>
                    <tr className="text-[var(--knoux-text-muted)]">
                      <th className="py-2">{pick('Origin', 'الموضع')}</th>
                      <th className="py-2">{pick('Value name', 'اسم القيمة')}</th>
                      <th className="py-2">{pick('Value', 'القيمة')}</th>
                      <th className="py-2">{pick('Meaning', 'المعنى')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {smartScreen.data.sources.map(item => (
                      <tr key={`${item.origin}-${item.valueName}`} className="border-t border-[var(--knoux-border)]">
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{item.origin}</td>
                        <td className="py-2 font-mono text-[var(--knoux-text)]">{item.valueName}</td>
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{item.value}</td>
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{language === 'ar' ? item.meaningAr : item.meaningEn}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Secure Boot and TPM', 'Secure Boot وTPM')}
        subtitle={pick(
          'Secure Boot is read through the cmdlet and the firmware flag, and TPM through both providers Windows exposes. Secure Boot being off is a reading, not a failure, and a TPM no provider could reach is reported as unmeasured rather than absent.',
          'تُقرأ حالة Secure Boot عبر الأمر ومن علامة البرنامج الثابت، وتُقرأ TPM عبر المزوّدين الذين يعرضهما ويندوز. تعطيل Secure Boot قراءة لا فشل، وغياب TPM الذي لم يستطع أي مزوّد بلوغه يُبلَّغ عنه كـ«غير مقاس» لا كـ«غير موجود».',
        )}
      >
        <button type="button" onClick={secureBoot.run} disabled={!available || secureBoot.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {action(secureBoot.busy)}
          {pick('Read Secure Boot and TPM', 'اقرأ Secure Boot وTPM')}
        </button>
        {secureBoot.message && <Banner tone="info">{secureBoot.message}</Banner>}
        {secureBoot.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout
                label={pick('Secure Boot', 'Secure Boot')}
                value={secureBoot.data.secureBootState}
                state={secureBoot.data.secureBootState === 'on' ? 'yes' : secureBoot.data.secureBootState === 'off' ? 'no' : 'unknown'}
              />
              <Readout label={pick('Firmware mode', 'وضع البرنامج الثابت')} value={secureBoot.data.biosMode} />
              <Readout
                label={pick('TPM providers reached', 'مزوّدو TPM الذين استجابوا')}
                value={`${secureBoot.data.tpm.length} / 2`}
                state={verdict(secureBoot.data.tpm.length > 0)}
              />
              <Readout
                label={pick('Changed any setting', 'غيّر أي إعداد')}
                value={secureBoot.data.changedAnySetting ? pick('yes', 'نعم') : pick('no', 'لا')}
                state={verdict(!secureBoot.data.changedAnySetting)}
              />
            </div>
            {secureBoot.data.secureBootState !== 'on' && <Banner tone="warn">{secureBoot.data.secureBootDetail}</Banner>}
            {secureBoot.data.tpm.length === 0 && (
              <Banner tone="warn">
                {pick(
                  'No TPM provider answered on this machine. TPM state is unmeasured here, which is not the same as absent.',
                  'لم يستجب أي مزوّد TPM على هذا الجهاز. حالة TPM غير مقاسة هنا، وهذا ليس معناه غيابها.',
                )}
              </Banner>
            )}
            {secureBoot.data.tpm.map(detail => (
              <div key={detail.name} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 text-xs">
                <p className="font-black text-[var(--knoux-text)]">{detail.name}</p>
                <p className="mt-2 text-[var(--knoux-text-secondary)]">
                  {pick('present', 'موجود')}: {detail.present == null ? pick('not reported', 'غير مُبلَّغ') : String(detail.present)} ·{' '}
                  {pick('ready', 'جاهز')}: {detail.ready == null ? pick('not reported', 'غير مُبلَّغ') : String(detail.ready)} ·{' '}
                  {pick('enabled', 'مفعّل')}: {detail.enabled == null ? pick('not reported', 'غير مُبلَّغ') : String(detail.enabled)} ·{' '}
                  {pick('activated', 'مُفعَّل')}: {detail.activated == null ? pick('not reported', 'غير مُبلَّغ') : String(detail.activated)}
                </p>
                {detail.manufacturer && (
                  <p className="mt-2 text-[var(--knoux-text-muted)]">
                    {detail.manufacturer} {detail.manufacturerVersion} · {pick('spec', 'إصدار المواصفة')} {detail.specVersion}
                  </p>
                )}
              </div>
            ))}
            <div>
              <p className="mb-2 text-xs font-black text-[var(--knoux-text)]">{pick('Providers consulted', 'المزوّدون المستشارون')}</p>
              <SourceList sources={secureBoot.data.sources} />
            </div>
          </div>
        )}
      </Panel>

      <div className={`rounded-2xl border p-4 text-xs font-semibold ${verdictTone('yes')}`}>
        {summarize(
          'All five inspections are read-only. No scan was started, no policy value was written, no firewall rule was changed and no elevation was requested.',
          'الفحوص الخمسة للقراءة فقط. لم يبدأ أي فحص، ولم تُكتب أي قيمة سياسة، ولم تتغير أي قاعدة في جدار الحماية، ولم يُطلب أي رفع صلاحيات.',
          true,
          '',
        )}
      </div>
    </div>
  );
};
