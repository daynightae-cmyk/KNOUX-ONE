import React from 'react';
import { Ban, CirclePause, CirclePlay, LoaderCircle } from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateScanProgress({ store }: { store: any }) {
  const { t } = useTranslation();
  const progress = store.scanProgress;
  if (!store.isScanning && progress.phase === 'idle') return null;
  const hasTotal = typeof progress.totalFiles === 'number' && progress.totalFiles > 0;
  const percent = hasTotal ? Math.min(100, Math.round((progress.scannedFiles / progress.totalFiles) * 100)) : null;
  return (
    <section className="knoux-glass-panel p-5" aria-live="polite">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-300"><LoaderCircle className={`h-5 w-5 ${store.isScanning && !store.isPaused ? 'animate-spin' : ''}`} /></div>
          <div className="min-w-0"><p className="text-sm font-black text-[var(--knoux-text)]">{t('Real native duplicate scan', 'فحص التكرار المحلي الحقيقي')}</p><p className="mt-1 truncate font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr">{progress.currentPath || progress.phase}</p></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {store.isScanning && !store.isPaused && progress.canPause && <button type="button" onClick={store.pauseScan} className="knoux-btn-secondary inline-flex items-center gap-2 text-xs"><CirclePause className="h-4 w-4" />{t('Pause', 'إيقاف مؤقت')}</button>}
          {store.isScanning && store.isPaused && <button type="button" onClick={store.resumeScan} className="knoux-btn-secondary inline-flex items-center gap-2 text-xs"><CirclePlay className="h-4 w-4" />{t('Resume', 'استئناف')}</button>}
          {store.isScanning && progress.canCancel && <button type="button" onClick={store.cancelScan} className="knoux-btn-secondary inline-flex items-center gap-2 border-rose-500/30 text-xs text-rose-300"><Ban className="h-4 w-4" />{t('Cancel safely', 'إلغاء بأمان')}</button>}
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--knoux-bg-soft)]">{percent === null ? <div className="h-full w-1/3 animate-pulse rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-blue-500" /> : <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-[width]" style={{ width: `${percent}%` }} />}</div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
        <div><span className="text-[var(--knoux-subtext)]">{t('Phase', 'المرحلة')}</span><p className="mt-1 font-bold text-[var(--knoux-text)]">{progress.phase}</p></div>
        <div><span className="text-[var(--knoux-subtext)]">{t('Files', 'الملفات')}</span><p className="mt-1 font-bold text-[var(--knoux-text)]">{progress.scannedFiles}{hasTotal ? ` / ${progress.totalFiles}` : ''}</p></div>
        <div><span className="text-[var(--knoux-subtext)]">{t('Read', 'تمت قراءة')}</span><p className="mt-1 font-bold text-[var(--knoux-text)]">{formatBytes(progress.scannedBytes)}</p></div>
        <div><span className="text-[var(--knoux-subtext)]">{t('Verified groups', 'المجموعات الموثقة')}</span><p className="mt-1 font-bold text-emerald-400">{progress.verifiedGroups}</p></div>
      </div>
    </section>
  );
}
