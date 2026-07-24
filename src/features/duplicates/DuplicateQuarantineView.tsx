/**
 * KNOUX ONE — Module 03 Quarantine Vault View
 */
import React from 'react';
import { ShieldAlert, RotateCcw, Trash2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateQuarantineView({ store }: { store: any }) {
  const { t } = useTranslation();
  const records = store.quarantineRecords;

  if (records.length === 0) {
    return (
      <div className="knoux-card text-center p-12 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl">
        <ShieldCheck className="mx-auto h-12 w-12 text-purple-400" />
        <h3 className="mt-3 text-base font-bold text-[var(--knoux-text)]">
          {t('Quarantine Vault Empty', 'المحجر الآمن فارغ حالياً')}
        </h3>
        <p className="mt-1 text-xs text-[var(--knoux-subtext)]">
          {t('Files moved to quarantine from scan results will appear here for safe 1-click restoration or final purge.', 'الملفات المحولة للمحجر ستظهر هنا للرصد أو الاستعادة بضغطة زر واحدة.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between knoux-card p-4 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)]">
        <div>
          <h3 className="text-base font-bold text-[var(--knoux-text)] flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-purple-400" />
            {t('KNOUX Safe Quarantine Vault', 'المحجر الآمن KNOUX Vault')}
          </h3>
          <p className="text-xs text-[var(--knoux-subtext)]">
            {t('All items stored in isolated quarantine folder before final permanent deletion.', 'جميع العناصر محفوظة في مجلد معزول للحماية قبل الحذف النهائي.')}
          </p>
        </div>

        <span className="px-3 py-1 text-xs font-mono font-bold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          {records.length} {t('Items Vaulted', 'عنصر في المحجر')}
        </span>
      </div>

      <div className="knoux-card border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl overflow-hidden divide-y divide-[var(--knoux-border)]">
        {records.map((q: any) => (
          <div key={q.quarantineId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="font-bold text-[var(--knoux-text)] font-mono">{q.fileName}</div>
              <div className="text-[11px] text-[var(--knoux-subtext)] font-mono mt-0.5">{q.originalPath}</div>
              <div className="text-[10px] text-purple-400 mt-1">
                {t('Quarantined at:', 'تاريخ النقل للمحجر:')} {new Date(q.quarantinedAt).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-[var(--knoux-text)]">{formatBytes(q.sizeBytes)}</span>

              {q.status === 'quarantined' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => store.restoreQuarantinedItem(q.quarantineId)}
                    className="knoux-btn-secondary py-1 px-3 text-xs flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('Restore', 'استعادة')}
                  </button>
                  <button
                    onClick={() => store.purgeQuarantinedItem(q.quarantineId)}
                    className="knoux-btn-secondary py-1 px-3 text-xs flex items-center gap-1 text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('Purge', 'حذف نهائي')}
                  </button>
                </div>
              )}

              {q.status === 'restored' && (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('Restored to Original Path', 'تمت الاستعادة بنجاح')}
                </span>
              )}

              {q.status === 'purged' && (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <Trash2 className="h-4 w-4" />
                  {t('Permanently Deleted', 'تم الحذف النهائي')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
