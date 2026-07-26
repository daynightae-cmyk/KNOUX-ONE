import React, { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { AlertTriangle, BellRing, CheckCircle2 } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { storageClient } from './storageClient';
import type { StorageSpaceAlert } from './storageContracts';

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export const StorageMonitorPanel: React.FC = () => {
  const { t } = useKnoux();
  const runtime = storageClient.runtimeState();
  const [alerts, setAlerts] = useState<StorageSpaceAlert[]>([]);

  useEffect(() => {
    if (!runtime.available) return;
    let dispose: (() => void) | undefined;
    void listen<StorageSpaceAlert>('m04://low-space-alert', event => {
      setAlerts(previous => [event.payload, ...previous.filter(item => item.rootPath !== event.payload.rootPath)].slice(0, 12));
    }).then(unlisten => {
      dispose = unlisten;
    });
    return () => dispose?.();
  }, [runtime.available]);

  return (
    <section className="knoux-glass-panel p-5 md:p-7">
      <div className="flex items-start gap-4 rtl:flex-row-reverse">
        <div className="knoux-icon-plate"><BellRing className="h-5 w-5" /></div>
        <div>
          <div className="knoux-eyebrow">{t('Background storage monitor', 'مراقب مساحة التخزين في الخلفية')}</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{t('Persistent low-space alerts', 'تنبيهات انخفاض المساحة المستمرة')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--knoux-text-secondary)]">{t('After a threshold check, the selected threshold and interval are stored in application data. KNOUX ONE checks connected volumes while the desktop app is running and sends both an in-app event and a Windows toast.', 'بعد فحص الحد يتم حفظ النسبة والفاصل داخل بيانات التطبيق. يفحص KNOUX ONE الأقراص أثناء تشغيل تطبيق سطح المكتب ويرسل تنبيهًا داخل التطبيق وتنبيه Windows Toast.')}</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-5 text-sm text-[var(--knoux-text-muted)]"><CheckCircle2 className="mb-3 h-6 w-6 text-emerald-400" />{t('No low-space event has been received during this session.', 'لم يتم استقبال أي تنبيه لانخفاض المساحة خلال هذه الجلسة.')}</div>
        ) : alerts.map(alert => (
          <article key={`${alert.rootPath}-${alert.thresholdPercent}`} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3 rtl:flex-row-reverse"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" /><div><p className="font-black text-amber-100">{alert.rootPath}</p><p className="mt-1 text-sm text-amber-100/80">{t(`${alert.freePercent.toFixed(1)}% free (${formatBytes(alert.freeBytes)}). Threshold: ${alert.thresholdPercent}%.`, `المتاح ${alert.freePercent.toFixed(1)}% (${formatBytes(alert.freeBytes)}). الحد المحدد: ${alert.thresholdPercent}%.`)}</p></div></div>
          </article>
        ))}
      </div>
    </section>
  );
};
