import React, { useCallback, useState } from 'react';
import { AlertTriangle, CalendarClock, HardDriveDownload, RefreshCw, Trash2 } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { cleanupPlannedClient } from './cleanupPlannedClient';
import type { CleanupProfileResult, DeliveryCacheReport, DeliveryCacheScope, RecycleBinReport } from './cleanupPlannedContracts';

/**
 * The cleanup categories a profile may reference. This list mirrors the native
 * allowlist in `completion14::m02::targets`; anything else is refused by the engine and
 * the refusal is reported rather than hidden, so the two lists are kept identical here.
 */
const CLEANUP_CATEGORIES = [
  { id: 'user_temp', labelEn: 'Your temporary files', labelAr: 'ملفاتك المؤقتة' },
  { id: 'windows_temp', labelEn: 'Windows temporary files', labelAr: 'ملفات ويندوز المؤقتة' },
  { id: 'browser_cache', labelEn: 'Browser caches', labelAr: 'كاش المتصفحات' },
  { id: 'thumbnail_cache', labelEn: 'Thumbnail cache', labelAr: 'كاش الصور المصغرة' },
  { id: 'crash_dumps', labelEn: 'Crash reports', labelAr: 'تقارير الأعطال' },
  { id: 'application_logs', labelEn: 'Old application logs', labelAr: 'سجلات التطبيقات القديمة' },
  { id: 'old_downloads', labelEn: 'Old installers in Downloads', labelAr: 'ملفات التثبيت القديمة' },
] as const;

function bytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

const selectClass = 'mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]';
const inputClass = 'mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]';

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
    <p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p>
    <p className="mt-2 break-all text-sm font-black text-[var(--knoux-text)]">{value || '—'}</p>
  </div>
);

const Banner: React.FC<{ tone: 'info' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => (
  <p className={`rounded-xl border p-3 text-xs leading-6 ${tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-sky-500/30 bg-sky-500/10 text-sky-200'}`}>{children}</p>
);

const Panel: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="knoux-glass-panel p-5 md:p-7">
    <div className="knoux-eyebrow"><HardDriveDownload className="h-4 w-4" />{title}</div>
    <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-muted)]">{subtitle}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

export const CleanupPlannedPanels: React.FC<{ available: boolean }> = ({ available }) => {
  const { t, language, addLog } = useKnoux();
  const pick = (en: string, ar: string) => t(en, ar);

  // ---- M02-S06 Delivery Optimization cache ---------------------------------------
  const [deliveryScope, setDeliveryScope] = useState<DeliveryCacheScope>('system');
  const [includeCacheFiles, setIncludeCacheFiles] = useState(false);
  const [cacheItemLimit, setCacheItemLimit] = useState(500);
  const [delivery, setDelivery] = useState<DeliveryCacheReport | null>(null);
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');

  const loadDelivery = useCallback(async () => {
    if (!available || deliveryBusy) return;
    setDeliveryBusy(true);
    setDeliveryMessage('');
    addLog('m02_s06', pick('Delivery Optimization cache', 'ذاكرة توصيل التحسين'), 'in_progress', pick('Measuring the real cache directories read-only.', 'قياس مجلدات الذاكرة الحقيقية للقراءة فقط.'));
    const result = await cleanupPlannedClient.deliveryCache(deliveryScope, includeCacheFiles, cacheItemLimit);
    setDeliveryBusy(false);
    setDelivery(result.data ?? null);
    setDeliveryMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m02_s06', pick('Delivery Optimization cache', 'ذاكرة توصيل التحسين'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  }, [addLog, available, cacheItemLimit, deliveryBusy, deliveryScope, includeCacheFiles, language, pick]);

  // ---- M02-S08 Recycle Bin --------------------------------------------------------
  const [includeDetails, setIncludeDetails] = useState(true);
  const [recycleLimit, setRecycleLimit] = useState(500);
  const [recycle, setRecycle] = useState<RecycleBinReport | null>(null);
  const [recycleBusy, setRecycleBusy] = useState(false);
  const [recycleMessage, setRecycleMessage] = useState('');

  const loadRecycle = useCallback(async () => {
    if (!available || recycleBusy) return;
    setRecycleBusy(true);
    setRecycleMessage('');
    addLog('m02_s08', pick('Recycle Bin review', 'مراجعة سلة المحذوفات'), 'in_progress', pick('Enumerating the shell Recycle Bin namespace read-only.', 'استعراض مساحة سلة المحذوفات للقراءة فقط.'));
    const result = await cleanupPlannedClient.recycleBinReview(includeDetails, recycleLimit);
    setRecycleBusy(false);
    setRecycle(result.data ?? null);
    setRecycleMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m02_s08', pick('Recycle Bin review', 'مراجعة سلة المحذوفات'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  }, [addLog, available, includeDetails, language, pick, recycleBusy, recycleLimit]);

  // ---- M02-S10 scheduled cleanup profiles ------------------------------------------
  const [profileName, setProfileName] = useState('weekly-tidy');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['user_temp', 'browser_cache']);
  const [profileResult, setProfileResult] = useState<CleanupProfileResult | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [applyToken, setApplyToken] = useState('');

  const runProfile = useCallback(
    async (mode: 'measure' | 'apply') => {
      if (!available || profileBusy || profileName.trim().length === 0) return;
      setProfileBusy(true);
      setProfileMessage('');
      addLog('m02_s10', pick('Scheduled cleanup profile', 'ملف تعريف التنظيف المجدول'), 'in_progress', mode);
      const result = await cleanupPlannedClient.cleanupSchedule({
        profileName: profileName.trim(),
        targets: selectedCategories,
        dryRun: mode === 'measure',
        apply: mode === 'apply',
        confirmation: mode === 'apply' ? applyToken : undefined,
      });
      setProfileBusy(false);
      setProfileResult(result.data ?? null);
      setProfileMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
      addLog('m02_s10', pick('Scheduled cleanup profile', 'ملف تعريف التنظيف المجدول'), result.data ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
    },
    [addLog, applyToken, available, language, pick, profileBusy, profileName, selectedCategories],
  );

  const toggleCategory = (id: string) => {
    setSelectedCategories(current => (current.includes(id) ? current.filter(value => value !== id) : [...current, id]));
    // A new measurement invalidates the token of the previous one.
    setApplyToken('');
  };

  return (
    <div className="space-y-6">
      <Panel
        title={pick('Delivery Optimization cache', 'ذاكرة توصيل التحسين')}
        subtitle={pick(
          'Measures the real cache directories Windows uses to hand out updates, plus the Delivery Optimization cmdlets when they exist. Walking is bounded by depth, file count and listing count, and a ceiling that is hit is reported. Nothing is removed.',
          'يقيس مجلدات الذاكرة الحقيقية التي يستخدمها ويندوز لتوزيع التحديثات، مع أوامر توصيل التحسين عند وجودها. يحدّ القياس بالعمق وعدد الملفات وعدد العناصر ويُبلَّغ عن بلوغ أي حد. لا يُحذف شيء.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Scope', 'النطاق')}</span>
            <select value={deliveryScope} onChange={event => setDeliveryScope(event.target.value as DeliveryCacheScope)} className={selectClass} disabled={deliveryBusy}>
              <option value="system">{pick('Machine-wide caches', 'ذاكرة الجهاز كاملة')}</option>
              <option value="user">{pick('Machine caches and this user', 'ذاكرة الجهاز وهذا المستخدم')}</option>
            </select>
          </label>
          <button type="button" onClick={loadDelivery} disabled={!available || deliveryBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {deliveryBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
            {pick('Measure', 'قياس')}
          </button>
        </div>
        <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
          <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Advanced: list individual cache files', 'متقدم: سرد ملفات الذاكرة')}</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-3 text-xs text-[var(--knoux-text-secondary)]">
              <input type="checkbox" checked={includeCacheFiles} onChange={event => setIncludeCacheFiles(event.target.checked)} disabled={deliveryBusy} />
              {pick('Include a per-file listing in the response', 'إدراج سرد لكل ملف في النتيجة')}
            </label>
            <label className="block">
              <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Maximum files listed', 'أقصى عدد ملفات مسرودة')}</span>
              <input type="number" min={1} max={5000} value={cacheItemLimit} onChange={event => setCacheItemLimit(Number(event.target.value) || 1)} className={inputClass} disabled={deliveryBusy || !includeCacheFiles} />
            </label>
          </div>
        </details>
        {deliveryMessage && <Banner tone="info">{deliveryMessage}</Banner>}
        {delivery && (
          <div className="space-y-4">
            <Banner tone="warn">{pick('Read-only measurement. Nothing was removed.', 'قياس للقراءة فقط. لم يُحذف شيء.')}</Banner>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Cache size', 'حجم الذاكرة')} value={bytes(delivery.totalBytes)} />
              <Readout label={pick('Files counted', 'ملفات محسوبة')} value={String(delivery.entryCount)} />
              <Readout label={pick('Readable roots', 'جذور قابلة للقراءة')} value={`${delivery.accessibleRootCount} / ${delivery.roots.length}`} />
              <Readout label={pick('Deleted', 'محذوف')} value={delivery.deletedAnything ? pick('yes', 'نعم') : pick('no', 'لا')} />
            </div>
            <div className="space-y-2">
              {delivery.roots.map(root => (
                <article key={root.id} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-[var(--knoux-text)]">{root.id}</span>
                    <span className="text-[var(--knoux-text-secondary)]">
                      {root.exists ? `${root.fileCount} ${pick('files', 'ملف')} · ${bytes(root.totalBytes)}` : pick('root does not exist', 'الجذر غير موجود')}
                      {root.truncated && ` · ${pick('listing truncated', 'السرد مبتور')}`}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-[10px] text-[var(--knoux-text-muted)]">{root.path}</p>
                  {root.rejectionReason && <p className="mt-1 text-amber-200">{root.rejectionReason}</p>}
                  {root.newestModified && (
                    <p className="mt-1 text-[10px] text-[var(--knoux-text-muted)]">
                      {pick('Oldest', 'الأقدم')}: {root.oldestModified ?? '—'} · {pick('Newest', 'الأحدث')}: {root.newestModified}
                    </p>
                  )}
                </article>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Readout
                label={pick('Delivery Optimization status query', 'استعلام حالة توصيل التحسين')}
                value={
                  delivery.serviceState.statusQuerySucceeded
                    ? pick('completed', 'اكتمل')
                    : delivery.serviceState.statusCmdletAvailable
                      ? pick('cmdlet present, query failed', 'الأمر موجود والاستعلام فشل')
                      : pick('cmdlet absent', 'الأمر غير موجود')
                }
              />
              <Readout
                label={pick('Reported cache size', 'حجم الذاكرة المُبلَّغ')}
                value={delivery.serviceState.perfSnapQuerySucceeded
                  ? delivery.serviceState.cacheSizeBytesReported == null
                    ? pick('query completed, no size reported', 'اكتمل الاستعلام ولم يُبلَّغ عن حجم')
                    : bytes(delivery.serviceState.cacheSizeBytesReported)
                  : pick('not measured', 'غير مقاس')}
              />
            </div>
            {delivery.serviceState.entries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[11px]">
                  <thead>
                    <tr className="text-[var(--knoux-text-muted)]">
                      <th className="py-2">{pick('Transfer', 'النقل')}</th>
                      <th className="py-2">{pick('Status', 'الحالة')}</th>
                      <th className="py-2">{pick('Priority', 'الأولوية')}</th>
                      <th className="py-2">{pick('From peers', 'من الأقران')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {delivery.serviceState.entries.slice(0, 20).map(entry => (
                      <tr key={entry.fileId} className="border-t border-[var(--knoux-border)]">
                        <td className="break-all py-2 font-mono text-[var(--knoux-text-secondary)]">{entry.fileId}</td>
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{entry.status}</td>
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{entry.priority}</td>
                        <td className="py-2 text-[var(--knoux-text-secondary)]">{entry.bytesFromPeers == null ? '—' : bytes(entry.bytesFromPeers)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {delivery.itemsIncluded && (
              <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
                <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">
                  {pick('Measured files', 'الملفات المقاسة')} ({delivery.items.length})
                </summary>
                <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-[11px] text-[var(--knoux-text-secondary)]">
                  {delivery.items.map(item => (
                    <li key={item.path} className="break-all">
                      <span className="font-mono">{item.path}</span> · {bytes(item.sizeBytes)} · {item.ageDays.toFixed(1)}d
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Recycle Bin review', 'مراجعة سلة المحذوفات')}
        subtitle={pick(
          'Reads the Recycle Bin through the Windows Shell namespace and reports the original location and deletion date it holds. Entries that carry no size are counted, so the byte total never claims more coverage than it has. Nothing is emptied.',
          'يقرأ سلة المحذوفات عبر مساحة أسماء Windows ويعرض الموقع الأصلي وتاريخ الحذف المسجّل. تُحصى العناصر التي لا تحمل حجمًا، فلا يدّعي الإجمالي تغطية أكثر مما يملك. لا يتم الإفراغ.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Details', 'التفاصيل')}</span>
            <select value={includeDetails ? 'full' : 'summary'} onChange={event => setIncludeDetails(event.target.value === 'full')} className={selectClass} disabled={recycleBusy}>
              <option value="full">{pick('Original path and deletion date', 'المسار الأصلي وتاريخ الحذف')}</option>
              <option value="summary">{pick('Names and totals only', 'الأسماء والإجماليات فقط')}</option>
            </select>
          </label>
          <button type="button" onClick={loadRecycle} disabled={!available || recycleBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {recycleBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {pick('Review', 'مراجعة')}
          </button>
        </div>
        <details className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3">
          <summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{pick('Advanced: entry limit', 'متقدم: حد العناصر')}</summary>
          <input type="number" min={1} max={2000} value={recycleLimit} onChange={event => setRecycleLimit(Number(event.target.value) || 1)} className={inputClass} disabled={recycleBusy} />
          <p className="mt-1 text-[11px] text-[var(--knoux-text-muted)]">
            {pick('The native side caps this at 2000 entries and reports the full count it found either way.', 'يحدّها الملف الأصلي عند 2000 عنصر ويبلّغ عن العدد الكامل الذي عثر عليه في الحالتين.')}
          </p>
        </details>
        {recycleMessage && <Banner tone="info">{recycleMessage}</Banner>}
        {recycle && (
          <div className="space-y-4">
            <Banner tone="warn">{pick('Read-only review. Nothing was emptied.', 'مراجعة للقراءة فقط. لم يتم الإفراغ.')}</Banner>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Entries found', 'عناصر موجودة')} value={String(recycle.totalItems)} />
              <Readout label={pick('Sized entries', 'عناصر بحجم')} value={`${recycle.sizedItems} / ${recycle.totalItems}`} />
              <Readout label={pick('Total size', 'الإجمالي')} value={bytes(recycle.totalBytes)} />
              <Readout label={pick('Emptied', 'مُفرَّغ')} value={recycle.emptiedAnything ? pick('yes', 'نعم') : pick('no', 'لا')} />
            </div>
            {recycle.unsizedItems > 0 && (
              <Banner tone="warn">
                {recycle.unsizedItems} {pick('entries carry no size in the shell detail column, so the total above excludes them.', 'عنصرًا لا يحمل حجمًا في عمود التفاصيل، لذا يستثنيه الإجمالي أعلاه.')}
              </Banner>
            )}
            {recycle.itemsTruncated && (
              <Banner tone="warn">{pick('Only the first entries are shown; the total above is the full count.', 'تُعرض العناصر الأولى فقط؛ الإجمالي أعلاه هو العدد الكامل.')}</Banner>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-2">{pick('Name', 'الاسم')}</th>
                    <th className="py-2">{pick('Original location', 'الموقع الأصلي')}</th>
                    <th className="py-2">{pick('Deleted', 'تاريخ الحذف')}</th>
                    <th className="py-2">{pick('Size', 'الحجم')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recycle.items.map((item, index) => (
                    <tr key={`${item.shellName}-${index}`} className="border-t border-[var(--knoux-border)]">
                      <td className="break-all py-2 font-bold text-[var(--knoux-text)]">{item.shellName || '—'}</td>
                      <td className="break-all py-2 text-[var(--knoux-text-secondary)]">{item.originalPath || '—'}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{item.deletedAt || '—'}</td>
                      <td className="py-2 text-[var(--knoux-text-secondary)]">{item.sizeBytes == null ? pick('not reported', 'غير مُبلَّغ') : bytes(item.sizeBytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Scheduled cleanup profiles', 'ملفات تعريف التنظيف المجدول')}
        subtitle={pick(
          'Saves a cleanup profile, measures it through the same allowlisted categories as the ordinary cleanup, and applies it only when you type the token the measurement returned. No Windows scheduled task is created, and the response says so.',
          'يحفظ ملف تعريف تنظيف ويقيسه عبر نفس الفئات المسموح بها المستخدمة في التنظيف العادي، ولا يطبّقه إلا عند كتابة الرمز الذي أعادته عملية القياس. لا تُنشأ أي مهمة مجدولة في ويندوز، وتذكر الاستجابة ذلك.',
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Profile name', 'اسم ملف التعريف')}</span>
            <input value={profileName} onChange={event => setProfileName(event.target.value)} className={inputClass} disabled={profileBusy} />
          </label>
          <div>
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Categories this profile may clean', 'الفئات التي قد ينظفها هذا الملف')}</span>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              {CLEANUP_CATEGORIES.map(category => (
                <label key={category.id} className="flex items-start gap-3 rounded-xl border border-[var(--knoux-border)] p-3 text-xs text-[var(--knoux-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.id)}
                    onChange={() => toggleCategory(category.id)}
                    disabled={profileBusy}
                    className="mt-1"
                  />
                  <span>
                    {language === 'ar' ? category.labelAr : category.labelEn}
                    <code className="mt-1 block text-[10px] text-[var(--knoux-text-muted)]">{category.id}</code>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => void runProfile('measure')} disabled={!available || profileBusy || selectedCategories.length === 0} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {profileBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
            {pick('Measure and save (no deletion)', 'قياس وحفظ (بدون حذف)')}
          </button>
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Confirmation token', 'رمز التأكيد')}</span>
            <input value={applyToken} onChange={event => setApplyToken(event.target.value)} className={inputClass} disabled={profileBusy || !profileResult} placeholder={profileResult?.profile.confirmationToken ?? 'APPLY'} />
          </label>
          <button
            type="button"
            onClick={() => void runProfile('apply')}
            disabled={!available || profileBusy || !profileResult || applyToken !== (profileResult?.profile.confirmationToken ?? '')}
            className="knoux-card-action disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {pick('Apply for real', 'تطبيق فعلي')}
          </button>
        </div>
        {profileMessage && <Banner tone="info">{profileMessage}</Banner>}
        {profileResult && (
          <div className="space-y-4">
            <Banner tone={profileResult.apply.applied ? 'warn' : 'info'}>
              {profileResult.apply.applied
                ? pick('Applied through the audited cleanup path.', 'طُبِّق عبر مسار التنظيف المُدقَّق.')
                : pick('Dry run only. Nothing was removed.', 'تجربة جافة فقط. لم يُحذف شيء.')}
              {' · '}
              {profileResult.profile.osSchedulerRegistration}
            </Banner>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Files measured', 'ملفات مقاسة')} value={String(profileResult.measurement.filesMeasured)} />
              <Readout label={pick('Measured size', 'الحجم المقاس')} value={bytes(profileResult.measurement.bytesMeasured)} />
              <Readout label={pick('Deleted', 'محذوف')} value={`${profileResult.apply.deletedFiles} · ${bytes(profileResult.apply.deletedBytes)}`} />
              <Readout label={pick('Profile file verified', 'تحقق ملف التعريف')} value={profileResult.profile.readBackVerified ? pick('yes', 'نعم') : pick('no', 'لا')} />
            </div>
            {profileResult.measurement.scanTruncated && (
              <Banner tone="warn">{pick('At least one category hit its item ceiling, so the measured size is a floor, not a total.', 'بلغت فئة واحدة على الأقل حدها في العناصر، فالحجم المقاس حد أدنى لا إجمالي.')}</Banner>
            )}
            {profileResult.profile.rejectedTargets.length > 0 && (
              <Banner tone="warn">
                <AlertTriangle className="me-2 inline h-4 w-4" />
                {pick('Requested categories outside the allowlist were refused', 'فئات مطلوبة خارج قائمة السماح مرفوضة')}: {profileResult.profile.rejectedTargets.join(', ')}
              </Banner>
            )}
            {profileResult.apply.quarantinedInsteadOfDeleted && (
              <Banner tone="info">{pick('Old installers were moved to the reversible quarantine rather than deleted.', 'نُقلت ملفات التثبيت القديمة إلى المحجر القابل للاستعادة بدل حذفها.')}</Banner>
            )}
            {profileResult.apply.warnings.map(warning => (
              <Banner key={warning} tone="warn">{warning}</Banner>
            ))}
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{profileResult.profile.filePath}</p>
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">SHA-256 {profileResult.profile.sha256}</p>
          </div>
        )}
      </Panel>
    </div>
  );
};
