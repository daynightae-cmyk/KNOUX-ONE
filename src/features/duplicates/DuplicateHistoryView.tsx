/**
 * KNOUX ONE — Module 03 Scan History View
 */
import React from 'react';
import { History, CheckCircle2, Clock } from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateHistoryView({ store }: { store: any }) {
  const { t } = useTranslation();
  const history = store.scanHistory;

  if (history.length === 0) {
    return (
      <div className="knoux-card text-center p-12 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl">
        <History className="mx-auto h-12 w-12 text-blue-400" />
        <h3 className="mt-3 text-base font-bold text-[var(--knoux-text)]">
          {t('No Scan History Recorded', 'لا يوجد سجل فحوصات سابق')}
        </h3>
        <p className="mt-1 text-xs text-[var(--knoux-subtext)]">
          {t('Completed duplicate scans and space recovery statistics will be logged here.', 'سيتم توثيق نتائج وتقارير الفحص السابقة هنا تلقائياً.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="knoux-card border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl divide-y divide-[var(--knoux-border)]">
        {history.map((h: any) => (
          <div key={h.scanId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[var(--knoux-text)]">{h.scanMode}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400">
                  {h.duplicateGroupsFound} {t('Groups', 'مجموعة')}
                </span>
              </div>
              <div className="text-[11px] text-[var(--knoux-subtext)] mt-1">
                {t('Targets:', 'المسارات:')} {h.targetFolders.join(', ')}
              </div>
            </div>

            <div className="text-end">
              <div className="font-mono font-bold text-emerald-400">
                {formatBytes(h.totalWastedBytes)} {t('Wasted', 'ضائعة')}
              </div>
              <div className="text-[10px] text-[var(--knoux-subtext)]">
                {new Date(h.completedAt).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
