import React, { useEffect, useMemo, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  File,
  Folder,
  HardDrive,
  PieChart,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { storageClient } from './storageClient';
import type {
  StorageAnalysisResult,
  StorageDriveInventory,
  StorageProgress,
  StorageReportExportResult,
  StorageSpaceCheckResult,
} from './storageContracts';

type ResultTab = 'files' | 'folders' | 'types' | 'old';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

function succeeded(result: OperationResult): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

function pathLabel(path: string): string {
  const normalized = path.replace(/[\\/]+$/, '');
  return normalized.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export const StorageAnalyzerWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm04');
  const runtime = storageClient.runtimeState();
  const [rootPath, setRootPath] = useState('C:\\');
  const [oldDays, setOldDays] = useState(180);
  const [thresholdPercent, setThresholdPercent] = useState(10);
  const [analysis, setAnalysis] = useState<StorageAnalysisResult | null>(null);
  const [drives, setDrives] = useState<StorageDriveInventory | null>(null);
  const [spaceCheck, setSpaceCheck] = useState<StorageSpaceCheckResult | null>(null);
  const [progress, setProgress] = useState<StorageProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<ResultTab>('files');
  const [exported, setExported] = useState<StorageReportExportResult | null>(null);

  useEffect(() => {
    if (!runtime.available) return;
    let dispose: (() => void) | undefined;
    void listen<StorageProgress>('m04://progress', event => {
      setProgress(event.payload);
    }).then(unlisten => {
      dispose = unlisten;
    });
    return () => dispose?.();
  }, [runtime.available]);

  const loadDriveEvidence = async () => {
    if (!runtime.available) return;
    const [driveResult, spaceResult] = await Promise.all([
      storageClient.drives(),
      storageClient.spaceCheck(thresholdPercent),
    ]);
    if (succeeded(driveResult) && driveResult.data) setDrives(driveResult.data);
    if (succeeded(spaceResult) && spaceResult.data) setSpaceCheck(spaceResult.data);
  };

  useEffect(() => {
    void loadDriveEvidence();
  }, [runtime.available]);

  const runAnalysis = async (
    titleEn: string,
    titleAr: string,
    operation: () => Promise<OperationResult<StorageAnalysisResult>>,
  ) => {
    if (!runtime.available || busy) return;
    setBusy(true);
    setError('');
    setExported(null);
    setProgress(null);
    addLog('m04_s01', t(titleEn, titleAr), 'in_progress', t('Reading real file metadata from Windows.', 'قراءة بيانات الملفات الحقيقية من ويندوز.'));
    const result = await operation();
    setBusy(false);
    if (result.data) setAnalysis(result.data);
    if (!succeeded(result) && result.status !== 'cancelled') {
      setError(language === 'ar' ? result.summaryAr : result.summaryEn);
    }
    addLog(
      'm04_s01',
      t(titleEn, titleAr),
      result.status === 'cancelled' ? 'cancelled' : succeeded(result) ? 'completed' : 'failed',
      language === 'ar' ? result.summaryAr : result.summaryEn,
      result.data ? formatBytes(result.data.totalBytes) : undefined,
    );
  };

  const scanSelectedPath = () => runAnalysis(
    'Storage scan',
    'فحص مساحة التخزين',
    () => storageClient.scan({ rootPath: rootPath.trim(), oldDays }),
  );

  const scanDownloads = () => runAnalysis(
    'Downloads analysis',
    'تحليل مجلد التنزيلات',
    () => storageClient.downloads(),
  );

  const scanAppData = () => runAnalysis(
    'Program data analysis',
    'تحليل مساحة البرامج',
    () => storageClient.appData(),
  );

  const cancelScan = async () => {
    if (!progress?.operationId || !busy) return;
    await storageClient.cancel(progress.operationId);
  };

  const exportReport = async () => {
    if (!analysis || busy) return;
    setError('');
    const result = await storageClient.exportReport(analysis.scanId);
    if (succeeded(result) && result.data) setExported(result.data);
    else setError(language === 'ar' ? result.summaryAr : result.summaryEn);
  };

  const typeTotals = useMemo(() => {
    const totals = new Map<string, { sizeBytes: number; fileCount: number }>();
    for (const item of analysis?.typeDistribution ?? []) {
      const existing = totals.get(item.category) ?? { sizeBytes: 0, fileCount: 0 };
      existing.sizeBytes += item.sizeBytes;
      existing.fileCount += item.fileCount;
      totals.set(item.category, existing);
    }
    return [...totals.entries()]
      .map(([category, values]) => ({ category, ...values }))
      .sort((left, right) => right.sizeBytes - left.sizeBytes);
  }, [analysis]);

  if (!module) return null;

  const largestMeasured = analysis?.largestFiles[0]?.sizeBytes ?? 0;
  const largestFolder = analysis?.largestFolders[0]?.sizeBytes ?? 0;
  const largestType = typeTotals[0]?.sizeBytes ?? 0;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4 rtl:flex-row-reverse">
            <div className="knoux-icon-plate h-16 w-16 rounded-2xl"><HardDrive className="h-8 w-8" /></div>
            <div>
              <div className="knoux-eyebrow">{t('Real storage measurement', 'قياس حقيقي لمساحة التخزين')}</div>
              <h1 className="mt-2 text-3xl font-black text-[var(--knoux-text)] md:text-5xl">{t(module.nameEn, module.nameAr)}</h1>
              <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-[var(--knoux-text-secondary)]">{t(module.descriptionEn, module.descriptionAr)}</p>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${runtime.available ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <p className="font-black text-[var(--knoux-text)]">{runtime.available ? t('Windows engine connected', 'محرك ويندوز متصل') : t('Desktop application required', 'يلزم تطبيق سطح المكتب')}</p>
            <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{runtime.available ? t('All sizes are read from this device.', 'جميع الأحجام مقاسة من هذا الجهاز.') : t(runtime.reasonEn ?? '', runtime.reasonAr ?? '')}</p>
          </div>
        </div>
      </section>

      {!runtime.available && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm font-semibold leading-7 text-amber-100">
          {t('The browser preview does not generate sample drives, files, folders, or storage totals. Open KNOUX ONE Desktop on Windows to analyze the device.', 'نسخة المتصفح لا تنشئ أقراصًا أو ملفات أو مجلدات أو أحجامًا تجريبية. افتح KNOUX ONE Desktop على ويندوز لتحليل الجهاز.')}
        </section>
      )}

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="grid gap-4 lg:grid-cols-[1fr_150px_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{t('Folder or drive path', 'مسار المجلد أو القرص')}</span>
            <input
              value={rootPath}
              onChange={event => setRootPath(event.target.value)}
              disabled={busy}
              placeholder="C:\\Users\\Name"
              className="mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)] outline-none focus:border-[var(--knoux-primary)]"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{t('Old after days', 'قديم بعد عدد الأيام')}</span>
            <input
              type="number"
              min={1}
              max={3650}
              value={oldDays}
              onChange={event => setOldDays(Math.max(1, Number(event.target.value) || 180))}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)] outline-none focus:border-[var(--knoux-primary)]"
            />
          </label>
          <button
            type="button"
            onClick={scanSelectedPath}
            disabled={!runtime.available || busy || !rootPath.trim()}
            className="knoux-card-action knoux-card-action--primary justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {busy ? t('Measuring…', 'جاري القياس…') : t('Analyze path', 'تحليل المسار')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={scanDownloads} disabled={!runtime.available || busy} className="knoux-card-action disabled:opacity-50"><Download className="h-4 w-4" />{t('Analyze Downloads', 'تحليل التنزيلات')}</button>
          <button type="button" onClick={scanAppData} disabled={!runtime.available || busy} className="knoux-card-action disabled:opacity-50"><Database className="h-4 w-4" />{t('Analyze program data', 'تحليل مساحة البرامج')}</button>
          <button type="button" onClick={loadDriveEvidence} disabled={!runtime.available || busy} className="knoux-card-action disabled:opacity-50"><RefreshCw className="h-4 w-4" />{t('Refresh drives', 'تحديث الأقراص')}</button>
        </div>
      </section>

      {drives && drives.drives.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {drives.drives.map(drive => {
            const usedPercent = drive.totalBytes > 0 ? drive.usedBytes * 100 / drive.totalBytes : 0;
            return (
              <button
                type="button"
                key={drive.rootPath}
                onClick={() => setRootPath(drive.rootPath)}
                disabled={busy}
                className="knoux-glass-panel p-5 text-start transition hover:-translate-y-0.5 disabled:opacity-60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 rtl:flex-row-reverse"><HardDrive className="h-5 w-5 text-[var(--knoux-primary-bright)]" /><span className="font-black text-[var(--knoux-text)]">{drive.rootPath}</span></div>
                  <span className="knoux-chip">{drive.driveType}</span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--knoux-surface)]"><div className="h-full rounded-full bg-[var(--knoux-primary)]" style={{ width: `${Math.min(100, usedPercent)}%` }} /></div>
                <div className="mt-3 flex justify-between text-xs font-bold text-[var(--knoux-text-muted)]"><span>{formatBytes(drive.usedBytes)} {t('used', 'مستخدم')}</span><span>{formatBytes(drive.freeBytes)} {t('free', 'متاح')}</span></div>
              </button>
            );
          })}
        </section>
      )}

      <section className="knoux-glass-panel p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <label className="block max-w-xs">
            <span className="text-xs font-black text-[var(--knoux-text)]">{t('Low-space threshold', 'حد انخفاض المساحة')}</span>
            <div className="mt-2 flex items-center gap-2"><input type="number" min={1} max={50} value={thresholdPercent} onChange={event => setThresholdPercent(Math.min(50, Math.max(1, Number(event.target.value) || 10)))} className="w-28 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]" /><span className="font-black">%</span></div>
          </label>
          <button type="button" onClick={loadDriveEvidence} disabled={!runtime.available || busy} className="knoux-card-action"><CheckCircle2 className="h-4 w-4" />{t('Check now', 'افحص الآن')}</button>
        </div>
        {spaceCheck && (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {spaceCheck.alerts.map(alert => (
              <div key={alert.rootPath} className={`rounded-xl border p-3 ${alert.belowThreshold ? 'border-red-500/30 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'}`}>
                <div className="flex items-center justify-between"><strong>{alert.rootPath}</strong><span>{alert.freePercent.toFixed(1)}%</span></div>
                <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{formatBytes(alert.freeBytes)} {t('free', 'متاح')} · {spaceCheck.backgroundMonitoringEnabled ? t('Monitoring active', 'المراقبة نشطة') : t('One-time check only', 'فحص لحظي فقط')}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {busy && progress && (
        <section className="knoux-glass-panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3"><RefreshCw className="h-5 w-5 animate-spin text-[var(--knoux-primary-bright)]" /><p className="font-black">{t('Reading file metadata', 'قراءة بيانات الملفات')}</p></div>
              <p className="mt-2 truncate text-xs text-[var(--knoux-text-muted)]">{progress.currentPath ?? t('Finalizing measured results…', 'تجهيز النتائج المقاسة…')}</p>
              <div className="mt-3 flex flex-wrap gap-2"><span className="knoux-chip">{progress.filesProcessed.toLocaleString()} {t('files', 'ملف')}</span><span className="knoux-chip">{progress.directoriesProcessed.toLocaleString()} {t('folders', 'مجلد')}</span><span className="knoux-chip">{formatBytes(progress.bytesProcessed)}</span></div>
            </div>
            <button type="button" onClick={cancelScan} className="knoux-card-action border-red-500/30 text-red-300"><X className="h-4 w-4" />{t('Cancel scan', 'إلغاء الفحص')}</button>
          </div>
        </section>
      )}

      {error && (
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5"><div className="flex gap-3"><AlertTriangle className="h-5 w-5 text-red-400" /><p className="text-sm font-semibold text-red-100">{error}</p></div></section>
      )}

      {analysis && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [t('Measured size', 'الحجم المقاس'), formatBytes(analysis.totalBytes)],
              [t('Files', 'الملفات'), analysis.totalFiles.toLocaleString()],
              [t('Folders', 'المجلدات'), analysis.totalDirectories.toLocaleString()],
              [t('Unavailable items', 'عناصر تعذر الوصول إليها'), analysis.inaccessibleItems.toLocaleString()],
            ].map(([label, value]) => <div key={label} className="knoux-glass-panel p-4"><p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p><p className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{value}</p></div>)}
          </section>

          <section className="knoux-glass-panel p-5 md:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div><div className="knoux-eyebrow">{t('Measured results', 'نتائج مقاسة')}</div><h2 className="mt-2 text-2xl font-black">{pathLabel(analysis.rootPath)}</h2><p className="mt-1 break-all text-xs text-[var(--knoux-text-muted)]">{analysis.rootPath}</p></div>
              <button type="button" onClick={exportReport} className="knoux-card-action knoux-card-action--primary"><Download className="h-4 w-4" />{t('Export JSON report', 'تصدير تقرير JSON')}</button>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {([
                ['files', t('Largest files', 'أكبر الملفات'), File],
                ['folders', t('Largest folders', 'أكبر المجلدات'), Folder],
                ['types', t('File types', 'أنواع الملفات'), PieChart],
                ['old', t('Old files', 'الملفات القديمة'), Clock3],
              ] as const).map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`knoux-card-action ${tab === value ? 'knoux-card-action--primary' : ''}`}><Icon className="h-4 w-4" />{label}</button>)}
            </div>

            <div className="mt-5 space-y-3">
              {tab === 'files' && analysis.largestFiles.map(item => <ResultRow key={item.path} title={pathLabel(item.path)} subtitle={item.path} value={formatBytes(item.sizeBytes)} ratio={largestMeasured ? item.sizeBytes / largestMeasured : 0} />)}
              {tab === 'folders' && analysis.largestFolders.map(item => <ResultRow key={item.path} title={pathLabel(item.path)} subtitle={`${item.path} · ${item.fileCount.toLocaleString()} ${t('files', 'ملف')}`} value={formatBytes(item.sizeBytes)} ratio={largestFolder ? item.sizeBytes / largestFolder : 0} />)}
              {tab === 'types' && typeTotals.map(item => <ResultRow key={item.category} title={item.category} subtitle={`${item.fileCount.toLocaleString()} ${t('files', 'ملف')}`} value={formatBytes(item.sizeBytes)} ratio={largestType ? item.sizeBytes / largestType : 0} />)}
              {tab === 'old' && analysis.oldFiles.largestFiles.map(item => <ResultRow key={item.path} title={pathLabel(item.path)} subtitle={`${item.path} · ${new Date(item.modifiedAt).toLocaleDateString()}`} value={formatBytes(item.sizeBytes)} ratio={analysis.oldFiles.largestFiles[0]?.sizeBytes ? item.sizeBytes / analysis.oldFiles.largestFiles[0].sizeBytes : 0} />)}
            </div>

            {(analysis.truncated || analysis.cancelled || analysis.warnings.length > 0) && <p className="mt-5 text-xs font-semibold text-amber-300">{analysis.cancelled ? t('The result is partial because the scan was cancelled.', 'النتيجة جزئية لأن الفحص تم إلغاؤه.') : ''} {analysis.truncated ? t('The configured maximum file count was reached.', 'تم الوصول إلى الحد الأقصى المحدد للملفات.') : ''} {analysis.warnings.join(' · ')}</p>}
          </section>
        </>
      )}

      {exported && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5"><p className="font-black text-emerald-100">{t('Report saved locally', 'تم حفظ التقرير محليًا')}</p><p className="mt-2 break-all text-xs text-emerald-100/70">{exported.path} · {formatBytes(exported.byteCount)}</p></section>
      )}
    </div>
  );
};

const ResultRow: React.FC<{ title: string; subtitle: string; value: string; ratio: number }> = ({ title, subtitle, value, ratio }) => (
  <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-black text-[var(--knoux-text)]">{title}</p><p className="mt-1 truncate text-xs text-[var(--knoux-text-muted)]">{subtitle}</p></div><span className="shrink-0 font-black text-[var(--knoux-primary-bright)]">{value}</span></div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--knoux-surface)]"><div className="h-full rounded-full bg-[var(--knoux-primary)]" style={{ width: `${Math.max(1, Math.min(100, ratio * 100))}%` }} /></div>
  </div>
);
