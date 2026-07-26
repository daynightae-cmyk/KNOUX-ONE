import React, { useEffect, useState } from 'react';
import { ArchiveRestore, CheckCircle2, HardDriveDownload, RefreshCw } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { cleanupClient } from './cleanupClient';
import type { DownloadQuarantineRecord } from './cleanupContracts';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export const DownloadQuarantinePanel: React.FC = () => {
  const { t } = useKnoux();
  const runtime = cleanupClient.runtimeState();
  const [records, setRecords] = useState<DownloadQuarantineRecord[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    if (!runtime.available) return;
    try {
      setRecords(await cleanupClient.quarantineList());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void refresh();
  }, [runtime.available]);

  const restore = async (record: DownloadQuarantineRecord) => {
    if (busyId) return;
    setBusyId(record.quarantineId);
    setMessage('');
    const result = await cleanupClient.restoreQuarantinedInstaller(record.quarantineId);
    setBusyId('');
    setMessage(result.status === 'completed' ? t('Installer restored to its original path.', 'تمت استعادة ملف التثبيت إلى مساره الأصلي.') : t(result.summaryEn, result.summaryAr));
    await refresh();
  };

  const active = records.filter(record => record.status === 'quarantined');

  return (
    <section className="knoux-glass-panel p-5 md:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="knoux-eyebrow"><HardDriveDownload className="h-4 w-4" />{t('Reversible installer quarantine', 'محجر ملفات التثبيت القابل للاستعادة')}</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{t('Files moved from Downloads', 'الملفات المنقولة من مجلد التنزيلات')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--knoux-text-secondary)]">{t('Old installers selected from a verified scan are moved into protected application data, hashed, and kept available for restoration. They are not permanently deleted.', 'ملفات التثبيت القديمة المختارة من فحص موثق تُنقل إلى بيانات التطبيق المحمية وتُحفظ بصمتها وتظل قابلة للاستعادة، ولا تُحذف نهائيًا.')}</p>
        </div>
        <button type="button" onClick={refresh} disabled={!runtime.available || Boolean(busyId)} className="knoux-card-action disabled:opacity-50"><RefreshCw className="h-4 w-4" />{t('Refresh', 'تحديث')}</button>
      </div>

      {message && <div className="mt-4 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3 text-sm text-[var(--knoux-text)]">{message}</div>}

      <div className="mt-5 space-y-3">
        {active.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-6 text-center text-sm text-[var(--knoux-text-muted)]"><CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-emerald-400" />{t('No installer files are currently held in quarantine.', 'لا توجد ملفات تثبيت محتجزة حاليًا داخل المحجر.')}</div>
        ) : active.map(record => (
          <article key={record.quarantineId} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="break-all text-sm font-black text-[var(--knoux-text)]">{record.originalPath}</p>
                <p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{formatBytes(record.sizeBytes)} · {new Date(record.quarantinedAt).toLocaleString()}</p>
                <p className="mt-2 break-all font-mono text-[10px] text-[var(--knoux-text-muted)]">BLAKE3: {record.hash}</p>
              </div>
              <button type="button" onClick={() => restore(record)} disabled={Boolean(busyId)} className="knoux-card-action knoux-card-action--primary shrink-0 justify-center disabled:opacity-50">
                {busyId === record.quarantineId ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" />}
                {t('Restore file', 'استعادة الملف')}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
