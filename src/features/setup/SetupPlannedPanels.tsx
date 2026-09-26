import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileDown, FolderCog, ListChecks, RefreshCw, ScrollText, Search, Wrench } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { setupPlannedClient } from './setupPlannedClient';
import type {
  CatalogFilter,
  CatalogScope,
  EssentialCatalogReport,
  InventoryExport,
  InventoryFormat,
  PostFormatProfile,
  PostFormatProfileList,
  ProfileStep,
  StoredProfileSummary,
  WingetRepairGuidance,
  WingetRepairScope,
  WingetRepairTarget,
} from './setupPlannedContracts';

/**
 * The steps a post-format profile may contain. The native side rejects anything not on
 * this list, so the UI offers exactly what the engine accepts rather than a free-form
 * command box. `parameters` is intentionally absent from the simple mode: the advanced
 * panel below is the only place a parameter can be supplied.
 */
const PROFILE_STEP_CHOICES: Array<{ id: string; labelEn: string; labelAr: string; parameter: string | null }> = [
  { id: 'm01.system.discover', labelEn: 'Re-read hardware and security evidence', labelAr: 'إعادة قراءة أدلة المكونات والأمان', parameter: null },
  { id: 'm01.winget.verify', labelEn: 'Verify Winget', labelAr: 'التحقق من Winget', parameter: null },
  { id: 'm01.apps.inventory.export', labelEn: 'Export the installed application inventory', labelAr: 'تصدير جرد التطبيقات المثبتة', parameter: 'format' },
  { id: 'm01.catalog.essential', labelEn: 'Review the essential software catalog', labelAr: 'مراجعة سياسة البرامج الأساسية', parameter: 'scope' },
  { id: 'm02.cleanup.scan', labelEn: 'Scan allowlisted cleanup categories', labelAr: 'فحص فئات التنظيف المسموح بها', parameter: 'categories' },
  { id: 'm02.cache.delivery', labelEn: 'Measure the Delivery Optimization cache', labelAr: 'قياس ذاكرة توصيل التحسين', parameter: 'scope' },
  { id: 'm02.recycle.review', labelEn: 'Review the Recycle Bin', labelAr: 'مراجعة سلة المحذوفات', parameter: 'includeDetails' },
  { id: 'm04.space.check', labelEn: 'Check free space', labelAr: 'فحص المساحة الحرة', parameter: null },
  { id: 'm04.storage.scan', labelEn: 'Re-scan storage usage', labelAr: 'إعادة فحص استهلاك التخزين', parameter: null },
  { id: 'm07.update.manage', labelEn: 'Inspect Windows Update', labelAr: 'فحص تحديثات ويندوز', parameter: null },
  { id: 'm08.dns.flush', labelEn: 'Flush the DNS resolver cache', labelAr: 'تفريغ ذاكرة DNS', parameter: null },
];

function bytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

const Panel: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="knoux-glass-panel p-5 md:p-7">
    <div className="knoux-eyebrow"><ListChecks className="h-4 w-4" />{title}</div>
    <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-muted)]">{subtitle}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="block">
    <span className="text-xs font-black text-[var(--knoux-text)]">{label}</span>
    {children}
    {hint && <span className="mt-1 block text-[11px] leading-5 text-[var(--knoux-text-muted)]">{hint}</span>}
  </label>
);

const selectClass = 'mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]';
const inputClass = 'mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]';

const Banner: React.FC<{ tone: 'info' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => (
  <p className={`rounded-xl border p-3 text-xs leading-6 ${tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200'}`}>{children}</p>
);

export const SetupPlannedPanels: React.FC<{ available: boolean }> = ({ available }) => {
  const { t, language, addLog } = useKnoux();
  const pick = (en: string, ar: string) => t(en, ar);

  // ---- M01-S03 Winget repair guidance -------------------------------------------
  const [repairScope, setRepairScope] = useState<WingetRepairScope>('local');
  const [repairTarget, setRepairTarget] = useState<WingetRepairTarget>('package');
  const [guidance, setGuidance] = useState<WingetRepairGuidance | null>(null);
  const [repairBusy, setRepairBusy] = useState(false);
  const [repairMessage, setRepairMessage] = useState('');

  const loadGuidance = useCallback(async () => {
    if (!available || repairBusy) return;
    setRepairBusy(true);
    setRepairMessage('');
    addLog('m01_s03', pick('Winget diagnosis', 'تشخيص Winget'), 'in_progress', pick('Measuring the real winget executable and sources.', 'قياس ملف winget الحقيقي والمصادر.'));
    const result = await setupPlannedClient.wingetRepairGuidance(repairScope, repairTarget);
    setRepairBusy(false);
    setGuidance(result.data ?? null);
    setRepairMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m01_s03', pick('Winget diagnosis', 'تشخيص Winget'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  }, [addLog, available, language, pick, repairBusy, repairScope, repairTarget]);

  // ---- M01-S04 essential software catalog ----------------------------------------
  const [catalogScope, setCatalogScope] = useState<CatalogScope>('installed');
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>('essential');
  const [verifyPackageIds, setVerifyPackageIds] = useState(false);
  const [catalog, setCatalog] = useState<EssentialCatalogReport | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogMessage, setCatalogMessage] = useState('');

  const loadCatalog = useCallback(async () => {
    if (!available || catalogBusy) return;
    setCatalogBusy(true);
    setCatalogMessage('');
    addLog('m01_s04', pick('Essential software catalog', 'سياسة البرامج الأساسية'), 'in_progress', pick('Resolving the bundled policy against the Windows uninstall registry.', 'مطابقة السياسة المرفقة مع سجل إلغاء تثبيت ويندوز.'));
    const result = await setupPlannedClient.essentialCatalog(catalogScope, catalogFilter, verifyPackageIds);
    setCatalogBusy(false);
    setCatalog(result.data ?? null);
    setCatalogMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m01_s04', pick('Essential software catalog', 'سياسة البرامج الأساسية'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  }, [addLog, available, catalogBusy, catalogFilter, catalogScope, language, pick, verifyPackageIds]);

  // ---- M01-S07 installed application inventory -----------------------------------
  const [format, setFormat] = useState<InventoryFormat>('json');
  const [includeVersion, setIncludeVersion] = useState(true);
  const [includeInstallPath, setIncludeInstallPath] = useState(true);
  const [exportDirectory, setExportDirectory] = useState('');
  const [exportFileName, setExportFileName] = useState('knoux-installed-apps');
  const [exported, setExported] = useState<InventoryExport | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMessage, setExportMessage] = useState('');

  const runExport = useCallback(async () => {
    if (!available || exportBusy) return;
    setExportBusy(true);
    setExportMessage('');
    addLog('m01_s07', pick('Installed application inventory', 'جرد التطبيقات المثبتة'), 'in_progress', format);
    const result = await setupPlannedClient.exportInventory(format, {
      includeVersion,
      includeInstallPath,
      destinationDirectory: exportDirectory.trim() || undefined,
      fileName: exportFileName.trim() || undefined,
    });
    setExportBusy(false);
    setExported(result.data ?? null);
    setExportMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m01_s07', pick('Installed application inventory', 'جرد التطبيقات المثبتة'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  }, [addLog, available, exportBusy, exportDirectory, exportFileName, format, includeInstallPath, includeVersion, language, pick]);

  // ---- M01-S08 post-format profiles ----------------------------------------------
  const [profileName, setProfileName] = useState('');
  const [targetPaths, setTargetPaths] = useState('');
  const [selectedSteps, setSelectedSteps] = useState<string[]>(['m01.system.discover']);
  const [stepParameters, setStepParameters] = useState<Record<string, string>>({});
  const [profile, setProfile] = useState<PostFormatProfile | null>(null);
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [profileDirectory, setProfileDirectory] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  const loadProfiles = useCallback(async () => {
    if (!available) return;
    const result = await setupPlannedClient.postFormatProfiles();
    setProfiles(result.data?.profiles ?? []);
    setProfileDirectory(result.data?.directory ?? '');
  }, [available]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const toggleStep = (id: string) => {
    setSelectedSteps(current => (current.includes(id) ? current.filter(value => value !== id) : [...current, id]));
  };

  const buildSteps = (): ProfileStep[] =>
    selectedSteps
      .map((stepId, index) => {
        const choice = PROFILE_STEP_CHOICES.find(item => item.id === stepId);
        const parameters: Record<string, string> = {};
        const value = stepParameters[stepId];
        if (choice?.parameter && value) parameters[choice.parameter] = value;
        return { order: index + 1, stepId, nativeCommand: '', enabled: true, parameters } as unknown as ProfileStep;
      });

  const saveProfile = useCallback(async () => {
    if (!available || profileBusy || profileName.trim().length === 0) return;
    setProfileBusy(true);
    setProfileMessage('');
    const result = await setupPlannedClient.createPostFormatProfile({
      profileName: profileName.trim(),
      targetPaths: targetPaths.split(/\r?\n/).map(value => value.trim()).filter(Boolean),
      steps: buildSteps(),
      runAfterFormatScan: true,
      intervalDays: null,
    });
    setProfileBusy(false);
    setProfile(result.data ?? null);
    setProfileMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    await loadProfiles();
  }, [available, language, loadProfiles, pick, profileBusy, profileName, stepParameters, targetPaths, selectedSteps]);

  return (
    <div className="space-y-6">
      <Panel
        title={pick('Winget repair guidance', 'إرشادات إصلاح Winget')}
        subtitle={pick(
          'Measures the real winget executable, captures its source list verbatim and lists the newest diagnostic log. It repairs nothing and runs nothing: each step names the measurement that produced it and shows a command for you to run.',
          'يقيس ملف winget الحقيقي، ويلتقط قائمة المصادر حرفيًا، ويسرد أحدث سجل تشخيص. لا يُصلح شيئًا ولا يشغّل شيئًا: كل خطوة تذكر القياس الذي أنتجها وتعرض أمرًا لتشغيله بنفسك.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Field label={pick('Scope', 'النطاق')}>
            <select value={repairScope} onChange={event => setRepairScope(event.target.value as WingetRepairScope)} className={selectClass} disabled={repairBusy}>
              <option value="local">{pick('This user only', 'هذا المستخدم فقط')}</option>
              <option value="system">{pick('Whole machine', 'الجهاز بالكامل')}</option>
            </select>
          </Field>
          <Field label={pick('Target', 'الهدف')}>
            <select value={repairTarget} onChange={event => setRepairTarget(event.target.value as WingetRepairTarget)} className={selectClass} disabled={repairBusy}>
              <option value="package">{pick('Package operations', 'عمليات الحزم')}</option>
              <option value="source">{pick('Package sources', 'مصادر الحزم')}</option>
              <option value="cache">{pick('Diagnostic cache', 'ذاكرة التشخيص')}</option>
            </select>
          </Field>
          <button type="button" onClick={loadGuidance} disabled={!available || repairBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {repairBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            {pick('Diagnose', 'تشخيص')}
          </button>
        </div>
        {repairMessage && <Banner tone="info">{repairMessage}</Banner>}
        {guidance && (
          <div className="space-y-4">
            <Banner tone="warn">
              {language === 'ar' ? guidance.noteAr : guidance.noteEn}
            </Banner>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Winget path', 'مسار winget')} value={guidance.diagnosis.wingetPath || pick('not found', 'غير موجود')} />
              <Readout label={pick('Version', 'الإصدار')} value={guidance.diagnosis.wingetVersion || '—'} />
              <Readout label={pick('Source list', 'قائمة المصادر')} value={guidance.diagnosis.sourceListSucceeded ? pick('read', 'قُرئت') : pick('failed', 'فشلت')} />
              <Readout label={pick('Diagnostic logs', 'سجلات التشخيص')} value={String(guidance.diagnosis.diagLogs.length)} />
            </div>
            <div className="space-y-3">
              {guidance.steps.length === 0 && <Banner tone="info">{pick('No step matched the measured state for this scope and target.', 'لا توجد خطوة تطابق الحالة المقاسة لهذا النطاق والهدف.')}</Banner>}
              {guidance.steps.map(step => (
                <article key={step.id} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[var(--knoux-border)] px-2 py-0.5 text-[11px] font-black">#{step.order}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-black ${step.mutating ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200'}`}>
                      {step.mutating ? pick('changes state', 'يغيّر الحالة') : pick('read only', 'قراءة فقط')}
                    </span>
                    {step.requiresAdmin && <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-black text-rose-200">UAC</span>}
                  </div>
                  <p className="mt-2 text-sm font-black text-[var(--knoux-text)]">{language === 'ar' ? step.titleAr : step.titleEn}</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--knoux-text-secondary)]">{language === 'ar' ? step.detailAr : step.detailEn}</p>
                  <p className="mt-2 text-[11px] leading-5 text-[var(--knoux-text-muted)]">
                    {pick('Evidence', 'الدليل')}: {step.evidence}
                  </p>
                  {step.commandTemplate && (
                    <code className="mt-2 block break-all rounded-lg bg-black/30 p-2 text-[11px] leading-5 text-emerald-200">{step.commandTemplate}</code>
                  )}
                  {step.requiresUserValue && (
                    <p className="mt-1 text-[11px] text-amber-200">
                      {pick('You replace', 'أنت تستبدل')} <code>{step.requiresUserValue}</code> {pick('yourself; this application never runs the line.', 'بنفسك؛ هذا التطبيق لا يشغّل السطر أبدًا.')}
                    </p>
                  )}
                </article>
              ))}
            </div>
            {guidance.stepsOmittedForScope > 0 && (
              <p className="text-[11px] text-[var(--knoux-text-muted)]">
                {pick('Steps hidden because they need elevation in this scope', 'خطوات مخفية لأنها تحتاج صلاحيات مرتفعة في هذا النطاق')}: {guidance.stepsOmittedForScope}
              </p>
            )}
            {guidance.diagnosis.sourceListText && (
              <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
                <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Verbatim source list output', 'ناتج قائمة المصادر الحرفي')}</summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-[var(--knoux-text-secondary)]">{guidance.diagnosis.sourceListText}</pre>
              </details>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Essential software catalog', 'سياسة البرامج الأساسية')}
        subtitle={pick(
          'A recommendation policy bundled with the application, resolved against the measured Windows uninstall registry. The digest of the exact policy bytes is shown so an edited policy can never pass as the shipped one.',
          'سياسة توصية مرفقة مع التطبيق، تُطابَق مع سجل إلغاء تثبيت ويندوز المقاس. تُعرض بصمة البايتات الدقيقة للسياسة كي لا تمرَّر سياسة معدَّلة كأنها الأصلية.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <Field label={pick('Scope', 'النطاق')}>
            <select value={catalogScope} onChange={event => setCatalogScope(event.target.value as CatalogScope)} className={selectClass} disabled={catalogBusy}>
              <option value="installed">{pick('Installed only', 'المثبتة فقط')}</option>
              <option value="available">{pick('Whole policy', 'السياسة كاملة')}</option>
            </select>
          </Field>
          <Field label={pick('Category', 'الفئة')}>
            <select value={catalogFilter} onChange={event => setCatalogFilter(event.target.value as CatalogFilter)} className={selectClass} disabled={catalogBusy}>
              <option value="essential">{pick('Essential', 'أساسية')}</option>
              <option value="security">{pick('Security', 'أمان')}</option>
              <option value="development">{pick('Development', 'تطوير')}</option>
              <option value="all">{pick('All categories', 'كل الفئات')}</option>
            </select>
          </Field>
          <button type="button" onClick={loadCatalog} disabled={!available || catalogBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {catalogBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {pick('Resolve', 'مطابقة')}
          </button>
        </div>
        <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
          <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Advanced: verify package identifiers against winget', 'متقدم: التحقق من معرّفات الحزم عبر winget')}</summary>
          <label className="mt-3 flex items-center gap-3 text-xs text-[var(--knoux-text-secondary)]">
            <input type="checkbox" checked={verifyPackageIds} onChange={event => setVerifyPackageIds(event.target.checked)} disabled={catalogBusy} />
            {pick('Run `winget show` for every absent item (up to 12 network lookups). An identifier is only marked verified when the check actually succeeded.', 'تشغيل winget show لكل عنصر غير مثبت (حتى 12 طلبًا عبر الشبكة). لا يُعتبر المعرّف متحققًا إلا بنجاح الفحص.')}
          </label>
        </details>
        {catalogMessage && <Banner tone="info">{catalogMessage}</Banner>}
        {catalog && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Policy revision', 'مراجعة السياسة')} value={catalog.catalog.catalogRevision} />
              <Readout label={pick('Policy digest', 'بصمة السياسة')} value={`${catalog.catalog.sha256.slice(0, 16)}…`} />
              <Readout label={pick('Installed here', 'المثبتة هنا')} value={`${catalog.itemsInstalled} / ${catalog.items.length}`} />
              <Readout label={pick('Package checks passed', 'فحوص الحزم الناجحة')} value={catalog.packageCheckWasRequested ? `${catalog.packageIdsVerified} / ${catalog.packageIdsChecked}` : pick('not requested', 'غير مطلوبة')} />
            </div>
            {catalog.catalog.policyOverridePath && (
              <Banner tone="warn">
                {pick('A local policy file replaced the bundled catalog: ', 'ملف سياسة محلي حل محل السياسة المرفقة: ')}
                <code className="break-all">{catalog.catalog.policyOverridePath}</code>
              </Banner>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-2">{pick('Application', 'التطبيق')}</th>
                    <th className="py-2">{pick('State', 'الحالة')}</th>
                    <th className="py-2">{pick('Version', 'الإصدار')}</th>
                    <th className="py-2">{pick('Package identifier', 'معرّف الحزمة')}</th>
                    <th className="py-2">{pick('Verified here', 'متحقق هنا')}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.items.map(item => (
                    <tr key={item.id} className="border-t border-[var(--knoux-border)]">
                      <td className="py-2 font-bold text-[var(--knoux-text)]">
                        {language === 'ar' ? item.nameAr : item.nameEn}
                        {item.matchedBy && <span className="mt-1 block text-[10px] text-[var(--knoux-text-muted)]">{item.matchedBy}</span>}
                      </td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{item.state === 'installed' ? pick('installed', 'مثبت') : pick('absent', 'غير مثبت')}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{item.installedVersion ?? '—'}</td>
                      <td className="py-2 font-mono text-[var(--knoux-text-secondary)]">{item.packageId}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">
                        {item.packageIdVerifiedOnThisMachine ? pick('yes', 'نعم') : pick('no', 'لا')}
                        {item.packageCheckDetail && <span className="mt-1 block max-w-[220px] break-all text-[10px] text-[var(--knoux-text-muted)]">{item.packageCheckDetail}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {catalog.itemsSuppressedByScope > 0 && (
              <p className="text-[11px] text-[var(--knoux-text-muted)]">
                {pick('Items in the policy that are not installed and were hidden by the chosen scope', 'عناصر السياسة غير المثبتة والمخفية بسبب النطاق المختار')}: {catalog.itemsSuppressedByScope}
              </p>
            )}
            <p className="text-[11px] leading-5 text-[var(--knoux-text-muted)]">
              {pick('Installed state measured from', 'حالة التثبيت مقاسة من')} {catalog.installedState.measurementSource} ·{' '}
              {catalog.installedState.hives.map(hive => `${hive.hive}:${hive.keysRead}`).join(' / ')}
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Installed application inventory', 'جرد التطبيقات المثبتة')}
        subtitle={pick(
          'Reads the uninstall registry across all three hives and writes a real report to a real file. The file is hashed and read back before it is reported as exported, and every exclusion is counted.',
          'يقرأ سجل إلغاء التثبيت من الأفرع الثلاثة ويكتب تقريرًا حقيقيًا في ملف حقيقي. يُجزَّأ الملف ويُقرأ مجددًا قبل الإبلاغ عنه، وتُحصى كل استثناءات.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Field label={pick('Format', 'الصيغة')}>
            <select value={format} onChange={event => setFormat(event.target.value as InventoryFormat)} className={selectClass} disabled={exportBusy}>
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="html">HTML</option>
            </select>
          </Field>
          <Field label={pick('Include version column', 'إدراج عمود الإصدار')}>
            <select value={includeVersion ? 'yes' : 'no'} onChange={event => setIncludeVersion(event.target.value === 'yes')} className={selectClass} disabled={exportBusy}>
              <option value="yes">{pick('Yes', 'نعم')}</option>
              <option value="no">{pick('No', 'لا')}</option>
            </select>
          </Field>
          <Field label={pick('Include install path column', 'إدراج عمود مسار التثبيت')}>
            <select value={includeInstallPath ? 'yes' : 'no'} onChange={event => setIncludeInstallPath(event.target.value === 'yes')} className={selectClass} disabled={exportBusy}>
              <option value="yes">{pick('Yes', 'نعم')}</option>
              <option value="no">{pick('No', 'لا')}</option>
            </select>
          </Field>
        </div>
        <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
          <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Advanced: destination', 'متقدم: الوجهة')}</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Field label={pick('Destination folder (absolute, empty for the default)', 'مجلد الوجهة (مطلق، فارغ للافتراضي)')} hint={pick('Default: Documents\\KNOUX ONE Exports', 'الافتراضي: Documents\\KNOUX ONE Exports')}>
              <input value={exportDirectory} onChange={event => setExportDirectory(event.target.value)} className={inputClass} disabled={exportBusy} placeholder="C:\\Users\\…\\Documents" />
            </Field>
            <Field label={pick('File name without extension', 'اسم الملف بلا امتداد')} hint={pick('Separators and traversal characters are removed by the native side.', 'يزيل الملف الأصلي الفواصل ومحارف اجتياز المسار.')}>
              <input value={exportFileName} onChange={event => setExportFileName(event.target.value)} className={inputClass} disabled={exportBusy} />
            </Field>
          </div>
        </details>
        <button type="button" onClick={runExport} disabled={!available || exportBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {exportBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          {pick('Export now', 'تصدير الآن')}
        </button>
        {exportMessage && <Banner tone="info">{exportMessage}</Banner>}
        {exported && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Applications', 'التطبيقات')} value={String(exported.appCount)} />
              <Readout label={pick('File size', 'حجم الملف')} value={bytes(exported.byteCount)} />
              <Readout label={pick('Read-back verified', 'تم التحقق بالقراءة')} value={exported.readBackVerified ? pick('yes', 'نعم') : pick('no', 'لا')} />
              <Readout label={pick('Excluded updates', 'تحديثات مستثناة')} value={String(exported.skippedUpdates)} />
            </div>
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{exported.filePath}</p>
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">SHA-256 {exported.sha256}</p>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Post-format profiles', 'ملفات تعريف ما بعد التهيئة')}
        subtitle={pick(
          'A profile records which allowlisted services to run after a reinstall. It can only name handlers the application already exposes, so it can never become a command line. Nothing is scheduled and nothing is changed on this machine.',
          'يسجّل ملف التعريف الخدمات المسموح بها التي تُشغَّل بعد إعادة التهيئة. لا يمكنه إلا ذكر معالجات يوفّرها التطبيق أصلًا، فلا يتحول إلى سطر أوامر. لا يُجدوَل شيء ولا تتغير حالة الجهاز.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label={pick('Profile name', 'اسم ملف التعريف')}>
            <input value={profileName} onChange={event => setProfileName(event.target.value)} className={inputClass} disabled={profileBusy} placeholder="after-format" />
          </Field>
          <Field label={pick('Target folders, one per line', 'المجلدات المستهدفة، واحد في كل سطر')} hint={pick('Recorded and checked. A relative path or a parent segment is refused.', 'تُسجَّل وتُفحص. يُرفض المسار النسبي أو مقطع «..».')}>
            <textarea value={targetPaths} onChange={event => setTargetPaths(event.target.value)} rows={3} className={inputClass} disabled={profileBusy} placeholder="C:\\Users\\…\\Documents" />
          </Field>
        </div>
        <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3" open>
          <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Steps this profile may run', 'الخطوات التي قد يشغّلها هذا الملف')}</summary>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {PROFILE_STEP_CHOICES.map(choice => (
              <div key={choice.id} className="rounded-xl border border-[var(--knoux-border)] p-3">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={selectedSteps.includes(choice.id)} onChange={() => toggleStep(choice.id)} disabled={profileBusy} className="mt-1" />
                  <span className="text-xs leading-5 text-[var(--knoux-text-secondary)]">
                    {language === 'ar' ? choice.labelAr : choice.labelEn}
                    <code className="mt-1 block text-[10px] text-[var(--knoux-text-muted)]">{choice.id}</code>
                  </span>
                </label>
                {choice.parameter && selectedSteps.includes(choice.id) && (
                  <input
                    value={stepParameters[choice.id] ?? ''}
                    onChange={event => setStepParameters(current => ({ ...current, [choice.id]: event.target.value }))}
                    placeholder={`${choice.parameter}`}
                    disabled={profileBusy}
                    className="mt-2 w-full rounded-lg border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-3 py-2 text-[11px] text-[var(--knoux-text)]"
                  />
                )}
              </div>
            ))}
          </div>
        </details>
        <button type="button" onClick={saveProfile} disabled={!available || profileBusy || profileName.trim().length === 0} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {profileBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderCog className="h-4 w-4" />}
          {pick('Save profile', 'حفظ ملف التعريف')}
        </button>
        {profileMessage && <Banner tone="info">{profileMessage}</Banner>}
        {profile && (
          <div className="space-y-3">
            <Banner tone="warn">
              {language === 'ar' ? profile.osSchedulerRegistration : profile.osSchedulerRegistration} · {pick('System state changed', 'تغيرت حالة النظام')}: {profile.changedSystemState ? pick('yes', 'نعم') : pick('no', 'لا')}
            </Banner>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Steps recorded', 'خطوات مسجّلة')} value={String(profile.steps.length)} />
              <Readout label={pick('Targets accepted', 'أهداف مقبولة')} value={String(profile.acceptedTargetCount)} />
              <Readout label={pick('Read-back verified', 'تم التحقق بالقراءة')} value={profile.readBackVerified ? pick('yes', 'نعم') : pick('no', 'لا')} />
              <Readout label={pick('File size', 'حجم الملف')} value={bytes(profile.byteCount)} />
            </div>
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{profile.filePath}</p>
            {profile.rejectedSteps.length > 0 && (
              <Banner tone="warn">
                <AlertTriangle className="me-2 inline h-4 w-4" />
                {pick('Refused steps', 'خطوات مرفوضة')}: {profile.rejectedSteps.join(' · ')}
              </Banner>
            )}
            {profile.rejectedTargets.length > 0 && (
              <Banner tone="warn">{pick('Unusable target paths', 'مسارات غير صالحة')}: {profile.rejectedTargets.join(' · ')}</Banner>
            )}
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-black text-[var(--knoux-text)]">
            <ScrollText className="h-4 w-4" />
            {pick('Stored profiles read from disk', 'ملفات التعريف المخزّنة المقروءة من القرص')}
            <button type="button" onClick={() => void loadProfiles()} disabled={!available} className="knoux-card-action ms-auto disabled:opacity-50">
              <RefreshCw className="h-4 w-4" />
              {pick('Refresh', 'تحديث')}
            </button>
          </div>
          {profileDirectory && <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{profileDirectory}</p>}
          {profiles.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-4 text-xs text-[var(--knoux-text-muted)]">
              {pick('No profile document exists yet.', 'لا يوجد مستند ملف تعريف بعد.')}
            </p>
          ) : (
            profiles.map(item => (
              <article key={item.profileId} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-[var(--knoux-text)]">{item.profileName || item.profileId}</span>
                  <span className="text-[var(--knoux-text-muted)]">
                    {item.stepCount} {pick('steps', 'خطوة')} · {bytes(item.byteCount)} · {item.readBackVerified ? pick('verified', 'موثق') : pick('unreadable', 'غير قابل للقراءة')}
                  </span>
                </div>
                {item.parseError && <p className="mt-2 text-rose-300">{item.parseError}</p>}
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--knoux-text-muted)]">SHA-256 {item.sha256}</p>
              </article>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
};

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
    <p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p>
    <p className="mt-2 break-all text-sm font-black text-[var(--knoux-text)]">{value || '—'}</p>
  </div>
);
