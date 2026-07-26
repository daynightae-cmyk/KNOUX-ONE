import React, { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  AlertTriangle,
  Broom,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileWarning,
  Globe2,
  HardDrive,
  Image,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { cleanupClient } from './cleanupClient';
import type {
  CleanupExecuteResult,
  CleanupHistoryEntry,
  CleanupProgress,
  CleanupScanResult,
} from './cleanupContracts';

const CATEGORY_META = [
  { id: 'user_temp', serviceNumber: 1, icon: HardDrive },
  { id: 'windows_temp', serviceNumber: 2, icon: Database },
  { id: 'browser_cache', serviceNumber: 3, icon: Globe2 },
  { id: 'thumbnail_cache', serviceNumber: 4, icon: Image },
  { id: 'crash_dumps', serviceNumber: 5, icon: FileWarning },
  { id: 'delivery_optimization', serviceNumber: 6, icon: Download },
  { id: 'application_logs', serviceNumber: 7, icon: ScrollText },
  { id: 'recycle_bin', serviceNumber: 8, icon: Trash2 },
  { id: 'old_downloads', serviceNumber: 9, icon: Download },
  { id: 'scheduled_cleanup', serviceNumber: 10, icon: Clock3 },
] as const;

const DEFAULT_SELECTED = new Set(['user_temp', 'browser_cache', 'thumbnail_cache']);

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function operationSucceeded(result: OperationResult): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

export const SmartCleanupWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm02');
  const runtime = cleanupClient.runtimeState();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_SELECTED));
  const [scanResult, setScanResult] = useState<CleanupScanResult | null>(null);
  const [executeResult, setExecuteResult] = useState<CleanupExecuteResult | null>(null);
  const [history, setHistory] = useState<CleanupHistoryEntry[]>([]);
  const [progress, setProgress] = useState<CleanupProgress | null>(null);
  const [busy, setBusy] = useState<'scan' | 'clean' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!runtime.available) return;
    let dispose: (() => void) | undefined;
    void listen<CleanupProgress>('m02://progress', event => {
      setProgress(event.payload);
    }).then(unlisten => {
      dispose = unlisten;
    });
    return () => dispose?.();
  }, [runtime.available]);

  const loadHistory = async () => {
    if (!runtime.available) return;
    const result = await cleanupClient.history();
    if (operationSucceeded(result) && result.data) setHistory(result.data.entries);
  };

  useEffect(() => {
    void loadHistory();
  }, [runtime.available]);

  const serviceByNumber = (serviceNumber: number) => module?.services.find(service => service.serviceNumber === serviceNumber);
  const measuredById = useMemo(
    () => new Map((scanResult?.categories ?? []).map(category => [category.id, category])),
    [scanResult],
  );
  const selectedMeasured = useMemo(
    () => (scanResult?.categories ?? []).filter(category => selected.has(category.id)),
    [scanResult, selected],
  );
  const cleanableCategories = selectedMeasured.filter(category => !category.scanOnly && category.items.some(item => item.safeToClean));
  const selectedBytes = selectedMeasured.reduce((sum, category) => sum + category.sizeBytes, 0);
  const selectedFiles = selectedMeasured.reduce((sum, category) => sum + category.fileCount, 0);

  const toggleCategory = (id: string, executable: boolean) => {
    if (!executable || busy) return;
    setSelected(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setScanResult(null);
    setExecuteResult(null);
    setConfirmation('');
  };

  const startScan = async () => {
    if (!runtime.available || selected.size === 0 || busy) return;
    setBusy('scan');
    setError('');
    setScanResult(null);
    setExecuteResult(null);
    setProgress(null);
    addLog('m02_s01', t('Device cleanup scan', 'فحص تنظيف الجهاز'), 'in_progress', t('Scanning selected real Windows locations.', 'جاري فحص مواقع ويندوز الحقيقية المحددة.'));
    const result = await cleanupClient.scan([...selected]);
    setBusy(null);
    if (result.data) setScanResult(result.data);
    if (!operationSucceeded(result) && result.status !== 'cancelled') setError(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog(
      'm02_s01',
      t('Device cleanup scan', 'فحص تنظيف الجهاز'),
      result.status === 'cancelled' ? 'cancelled' : operationSucceeded(result) ? 'completed' : 'failed',
      language === 'ar' ? result.summaryAr : result.summaryEn,
    );
    await loadHistory();
  };

  const cleanSelected = async () => {
    if (!scanResult || confirmation !== 'CLEAN' || cleanableCategories.length === 0 || busy) return;
    setBusy('clean');
    setError('');
    setExecuteResult(null);
    setProgress(null);
    const categoryIds = cleanableCategories.map(category => category.id);
    addLog('m02_s01', t('Verified cleanup', 'التنظيف المتحقق منه'), 'in_progress', t('Deleting only unchanged files from the current scan snapshot.', 'حذف الملفات غير المتغيرة فقط من معاينة الفحص الحالية.'));
    const result = await cleanupClient.execute(scanResult.scanId, categoryIds, confirmation);
    setBusy(null);
    if (result.data) setExecuteResult(result.data);
    if (!operationSucceeded(result) && result.status !== 'cancelled') setError(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog(
      'm02_s01',
      t('Verified cleanup', 'التنظيف المتحقق منه'),
      result.status === 'cancelled' ? 'cancelled' : operationSucceeded(result) ? 'completed' : 'failed',
      language === 'ar' ? result.summaryAr : result.summaryEn,
      result.data ? formatBytes(result.data.deletedBytes) : undefined,
    );
    setConfirmation('');
    await loadHistory();
  };

  const cancelActive = async () => {
    if (!progress?.operationId || !busy) return;
    await cleanupClient.cancel(progress.operationId);
  };

  if (!module) return null;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4 rtl:flex-row-reverse">
            <div className="knoux-icon-plate h-16 w-16 rounded-2xl"><Broom className="h-8 w-8" /></div>
            <div>
              <div className="knoux-eyebrow">{t('Measured Windows cleanup', 'تنظيف ويندوز بقياسات حقيقية')}</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--knoux-text)] md:text-5xl">{t(module.nameEn, module.nameAr)}</h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--knoux-text-secondary)]">{t(module.descriptionEn, module.descriptionAr)}</p>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${runtime.available ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              {runtime.available ? <ShieldCheck className="h-6 w-6 text-emerald-400" /> : <LockKeyhole className="h-6 w-6 text-amber-400" />}
              <div>
                <p className="font-black text-[var(--knoux-text)]">{runtime.available ? t('Desktop engine connected', 'محرك سطح المكتب متصل') : t('Desktop engine required', 'يلزم تطبيق سطح المكتب')}</p>
                <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{runtime.available ? t('Results come from this device.', 'النتائج مقاسة من هذا الجهاز.') : t(runtime.reasonEn ?? '', runtime.reasonAr ?? '')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [t('Selected tools', 'الأدوات المحددة'), selected.size.toString()],
          [t('Measured files', 'الملفات المقاسة'), scanResult ? selectedFiles.toLocaleString() : '—'],
          [t('Measured size', 'الحجم المقاس'), scanResult ? formatBytes(selectedBytes) : '—'],
          [t('Saved operations', 'العمليات المحفوظة'), history.length.toLocaleString()],
        ].map(([label, value]) => (
          <div key={label} className="knoux-glass-panel p-4">
            <p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{value}</p>
          </div>
        ))}
      </section>

      {!runtime.available && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm font-semibold leading-7 text-amber-200">
          {t('This page does not invent browser-preview results. Open KNOUX ONE Desktop on Windows to scan or clean the device.', 'هذه الصفحة لا تنشئ نتائج تجريبية داخل المتصفح. افتح KNOUX ONE Desktop على ويندوز لإجراء الفحص أو التنظيف.')}
        </section>
      )}

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="knoux-eyebrow">{t('Choose what to inspect', 'اختر ما تريد فحصه')}</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{t('Cleanup areas', 'مناطق التنظيف')}</h2>
            <p className="mt-2 text-sm text-[var(--knoux-text-secondary)]">{t('No deletion occurs during scanning. Planned tools stay disabled.', 'لا يتم حذف أي ملف أثناء الفحص، وتظل الأدوات المخططة معطلة.')}</p>
          </div>
          <button
            type="button"
            onClick={startScan}
            disabled={!runtime.available || busy !== null || selected.size === 0}
            className="knoux-card-action knoux-card-action--primary min-w-52 justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === 'scan' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy === 'scan' ? t('Scanning device…', 'جاري فحص الجهاز…') : t('Scan selected areas', 'فحص المناطق المحددة')}
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORY_META.map(meta => {
            const service = serviceByNumber(meta.serviceNumber);
            if (!service) return null;
            const Icon = meta.icon;
            const executable = Boolean(service.handlerId) && service.status === 'available';
            const measured = measuredById.get(meta.id);
            const checked = selected.has(meta.id);
            return (
              <button
                type="button"
                key={meta.id}
                onClick={() => toggleCategory(meta.id, executable)}
                disabled={!executable || busy !== null}
                className={`rounded-2xl border p-4 text-start transition ${checked && executable ? 'border-[var(--knoux-primary)] bg-[var(--knoux-primary)]/10' : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]'} ${!executable ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5'}`}
              >
                <div className="flex items-start justify-between gap-3 rtl:flex-row-reverse">
                  <div className="knoux-icon-plate"><Icon className="h-5 w-5" /></div>
                  {executable ? (
                    checked ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <div className="h-5 w-5 rounded-full border border-[var(--knoux-border)]" />
                  ) : <Clock3 className="h-5 w-5 text-amber-400" />}
                </div>
                <h3 className="mt-4 font-black text-[var(--knoux-text)]">{t(service.nameEn, service.nameAr)}</h3>
                <p className="mt-2 min-h-12 text-xs font-medium leading-6 text-[var(--knoux-text-muted)]">{t(service.descriptionEn, service.descriptionAr)}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[var(--knoux-border)] pt-3 text-xs font-bold text-[var(--knoux-text-secondary)]">
                  <span>{measured ? `${measured.fileCount.toLocaleString()} ${t('files', 'ملف')}` : executable ? t('Ready to measure', 'جاهز للقياس') : t('Planned', 'ضمن الخطة')}</span>
                  <span>{measured ? formatBytes(measured.sizeBytes) : service.requiresAdmin ? t('Admin', 'مسؤول') : ''}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {busy && progress && (
        <section className="knoux-glass-panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3 rtl:flex-row-reverse">
                <RefreshCw className="h-5 w-5 animate-spin text-[var(--knoux-primary-bright)]" />
                <p className="font-black text-[var(--knoux-text)]">{busy === 'scan' ? t('Reading files from Windows', 'قراءة الملفات من ويندوز') : t('Removing verified files', 'حذف الملفات المتحقق منها')}</p>
              </div>
              <p className="mt-2 truncate text-xs text-[var(--knoux-text-muted)]">{progress.currentPath ?? t('Preparing the next item…', 'تجهيز العنصر التالي…')}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[var(--knoux-text-secondary)]">
                <span className="knoux-chip">{progress.filesProcessed.toLocaleString()} {t('files processed', 'ملف تمت معالجته')}</span>
                <span className="knoux-chip">{formatBytes(progress.bytesProcessed)}</span>
                {progress.category && <span className="knoux-chip">{progress.category}</span>}
              </div>
            </div>
            <button type="button" onClick={cancelActive} className="knoux-card-action border-red-500/30 text-red-300"><X className="h-4 w-4" />{t('Cancel safely', 'إلغاء بأمان')}</button>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
          <div className="flex items-start gap-3 rtl:flex-row-reverse"><AlertTriangle className="mt-0.5 h-5 w-5 text-red-400" /><p className="text-sm font-semibold leading-7 text-red-200">{error}</p></div>
        </section>
      )}

      {scanResult && (
        <section className="knoux-glass-panel p-5 md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="knoux-eyebrow">{t('Measured preview', 'معاينة مقاسة')}</div>
              <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{scanResult.totalFiles.toLocaleString()} {t('files found', 'ملف تم العثور عليه')}</h2>
              <p className="mt-2 text-sm text-[var(--knoux-text-secondary)]">{formatBytes(scanResult.totalBytes)} · {new Date(scanResult.scannedAt).toLocaleString()}</p>
            </div>
            <div className="w-full max-w-md rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
              <label className="text-xs font-black text-[var(--knoux-text)]" htmlFor="cleanup-confirmation">{t('Type CLEAN to confirm deletion', 'اكتب CLEAN لتأكيد الحذف')}</label>
              <input
                id="cleanup-confirmation"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                disabled={busy !== null || cleanableCategories.length === 0}
                className="mt-3 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)] outline-none focus:border-[var(--knoux-primary)]"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={cleanSelected}
                disabled={confirmation !== 'CLEAN' || busy !== null || cleanableCategories.length === 0}
                className="knoux-card-action knoux-card-action--primary mt-3 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy === 'clean' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t('Clean verified files', 'تنظيف الملفات المتحقق منها')}
              </button>
              {cleanableCategories.length === 0 && <p className="mt-3 text-xs text-amber-300">{t('The selected results are review-only or contain no cleanable snapshot items.', 'النتائج المحددة للمعاينة فقط أو لا تحتوي على ملفات قابلة للتنظيف في اللقطة الحالية.')}</p>}
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--knoux-border)]">
            {scanResult.categories.map(category => (
              <div key={category.id} className="grid gap-2 border-b border-[var(--knoux-border)] p-4 last:border-b-0 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <p className="font-black text-[var(--knoux-text)]">{language === 'ar' ? category.nameAr : category.nameEn}</p>
                  <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{category.scanOnly ? t('Review only — deletion disabled', 'معاينة فقط — الحذف معطل') : category.requiresAdmin ? t('May require administrator permissions', 'قد تتطلب صلاحية المسؤول') : t('Verified snapshot available', 'تتوفر لقطة متحقق منها')}</p>
                </div>
                <span className="text-sm font-black text-[var(--knoux-text)]">{category.fileCount.toLocaleString()} {t('files', 'ملف')}</span>
                <span className="text-sm font-black text-[var(--knoux-primary-bright)]">{formatBytes(category.sizeBytes)}</span>
              </div>
            ))}
          </div>
          {scanResult.warnings.length > 0 && <p className="mt-4 text-xs font-semibold text-amber-300">{scanResult.warnings.join(' · ')}</p>}
        </section>
      )}

      {executeResult && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
          <div className="flex items-start gap-3 rtl:flex-row-reverse">
            <ShieldCheck className="mt-1 h-6 w-6 text-emerald-400" />
            <div>
              <h2 className="font-black text-emerald-100">{t('Cleanup result', 'نتيجة التنظيف')}</h2>
              <p className="mt-2 text-sm leading-7 text-emerald-100/80">{t('Deleted', 'تم حذف')} {executeResult.deletedFiles.toLocaleString()} {t('verified files and reclaimed', 'ملف متحقق منه واستعادة')} {formatBytes(executeResult.deletedBytes)}.</p>
              {(executeResult.failedFiles.length > 0 || executeResult.warnings.length > 0) && <p className="mt-2 text-xs text-amber-200">{t('Some files were skipped or could not be removed. Review the operation history for evidence.', 'تم تجاوز بعض الملفات أو تعذر حذفها. راجع سجل العمليات للاطلاع على الأدلة.')}</p>}
            </div>
          </div>
        </section>
      )}

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex items-center justify-between gap-4">
          <div><div className="knoux-eyebrow">{t('Local evidence', 'الأدلة المحلية')}</div><h2 className="mt-2 text-xl font-black text-[var(--knoux-text)]">{t('Cleanup history', 'سجل التنظيف')}</h2></div>
          <button type="button" onClick={loadHistory} disabled={!runtime.available} className="knoux-card-action"><RefreshCw className="h-4 w-4" />{t('Refresh', 'تحديث')}</button>
        </div>
        <div className="mt-5 space-y-3">
          {history.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-6 text-center text-sm text-[var(--knoux-text-muted)]">{t('No cleanup operation has been recorded on this desktop yet.', 'لم يتم تسجيل أي عملية تنظيف على هذا الجهاز حتى الآن.')}</p>
          ) : history.slice(0, 10).map(entry => (
            <div key={entry.operationId} className="grid gap-2 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div><p className="font-black text-[var(--knoux-text)]">{entry.operationType === 'scan' ? t('Device scan', 'فحص الجهاز') : t('Verified cleanup', 'تنظيف متحقق منه')}</p><p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{new Date(entry.completedAt).toLocaleString()} · {entry.status}</p></div>
              <span className="text-sm font-bold text-[var(--knoux-text)]">{entry.fileCount.toLocaleString()} {t('files', 'ملف')}</span>
              <span className="text-sm font-black text-[var(--knoux-primary-bright)]">{formatBytes(entry.byteCount)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
