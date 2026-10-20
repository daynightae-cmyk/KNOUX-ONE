/**
 * KNOUX ONE — Operations & history workspace.
 *
 * Displays the local operation log produced by the shell. Nothing here is
 * sent to a remote endpoint; clearing removes the local in-memory log only.
 */

import React from 'react';
import { Trash2, Clock } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  completed: { en: 'Completed', ar: 'تم الإكمال' },
  failed: { en: 'Failed', ar: 'فشل' },
  in_progress: { en: 'In progress', ar: 'جارٍ التنفيذ' },
  cancelled: { en: 'Cancelled', ar: 'تم الإلغاء' },
};

export const OperationsHistoryView: React.FC = () => {
  const { actionLogs, clearActionLogs, t, language } = useKnoux();

  const handleClear = () => {
    clearActionLogs();
  };

  return (
    <div className="knoux-page-container space-y-6">
      <div className="knoux-glass-panel p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="knoux-eyebrow"><Clock className="h-4 w-4" />{t('Operations & history', 'العمليات والسجل')}</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">
              {t('Local operation history', 'سجل العمليات المحلي')}
            </h2>
            <p className="mt-2 text-[13px] text-[var(--knoux-text-muted)]">
              {t('Evidence of actions performed in this session. Clearing removes the local in-memory log only.', 'أدلة العمليات التي تمت在这 الجلسة. مسح السجل يزيل السجل في الذاكرة فقط.')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={actionLogs.length === 0}
            className="knoux-card-action shrink-0 opacity-50 disabled:not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            <span className="ml-2 hidden sm:inline">{t('Clear history', 'مسح السجل')}</span>
          </button>
        </div>
      </div>

      <div className="knoux-glass-panel overflow-hidden">
        {actionLogs.length === 0 ? (
          <div className="p-8 text-center text-[var(--knoux-text-muted)]">
            {t('No operations recorded yet.', 'لم يتم تسجيل أي عمليات بعد.')}
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--knoux-border)] text-[11px] font-bold uppercase tracking-[.1em] text-[var(--knoux-text-muted)]">
                <th className="pb-3 text-left w-[170px]">{t('When', 'متى')}</th>
                <th className="pb-3 text-left">{t('Capability', 'الوظيفة')}</th>
                <th className="pb-3 text-left w-[120px]">{t('Status', 'الحالة')}</th>
                <th className="pb-3 text-left">{t('Details', 'التفاصيل')}</th>
              </tr>
            </thead>
            <tbody>
              {actionLogs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--knoux-border)]/50 hover:bg-[var(--knoux-surface-muted)]/30">
                  <td className="py-3 text-[12px] font-mono text-[var(--knoux-text-secondary)]">{log.timestamp}</td>
                  <td className="py-3 text-[13px] text-[var(--knoux-text)]">{log.capabilityName}</td>
                  <td className="py-3 text-[12px] font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.status === 'completed'
                          ? 'bg-[var(--knoux-success)]/10 text-[var(--knoux-success)] border border-[var(--knoux-success)]/20'
                          : log.status === 'failed'
                          ? 'bg-[var(--knoux-danger)]/10 text-[var(--knoux-danger)] border border-[var(--knoux-danger)]/20'
                          : 'bg-[var(--knoux-warning)]/10 text-[var(--knoux-warning)] border border-[var(--knoux-warning)]/20'
                      }`}
                    >
                      {STATUS_LABELS[log.status][language === 'ar' ? 'ar' : 'en']}
                    </span>
                  </td>
                  <td className="py-3 text-[12px] text-[var(--knoux-text-secondary)] break-words">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
