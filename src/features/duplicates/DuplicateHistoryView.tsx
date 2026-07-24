import React from 'react';
import { FolderOpen, History } from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateHistoryView({ store }: { store: any }) {
  const { t } = useTranslation();
  const history = store.scanHistory;

  if (history.length === 0) {
    return (
      <div className="knoux-card rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-12 text-center">
        <History className="mx-auto h-12 w-12 text-blue-400" />
        <h3 className="mt-3 text-base font-black text-[var(--knoux-text)]">{t('No persisted scan history', 'لا يوجد سجل فحوصات محفوظ')}</h3>
        <p className="mt-2 text-xs leading-6 text-[var(--knoux-subtext)]">{t('Completed desktop scans are stored in the local SQLite database.', 'تُحفظ فحوصات سطح المكتب المكتملة داخل قاعدة SQLite المحلية.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item: any) => (
        <article key={item.scanId} className="knoux-card flex flex-col gap-4 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-black text-[var(--knoux-text)]">{item.scanMode}</h3>
              <span className="knoux-chip">{item.duplicateGroupsFound} {t('groups', 'مجموعة')}</span>
              <span className="knoux-chip">{item.duplicateFilesFound ?? 0} {t('files', 'ملف')}</span>
            </div>
            <p className="mt-2 truncate font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr">{(item.targetFolders ?? []).join(', ')}</p>
            <p className="mt-2 text-xs text-[var(--knoux-subtext)]">{new Date(item.completedAt).toLocaleString()} · {formatBytes(item.totalBytesScanned)}</p>
          </div>
          <div className="flex items-center gap-3">
            <strong className="font-mono text-sm text-emerald-400">{formatBytes(item.totalWastedBytes)}</strong>
            <button type="button" onClick={() => store.openHistoryScan(item.scanId)} className="knoux-btn-secondary inline-flex items-center gap-2 text-xs">
              <FolderOpen className="h-4 w-4" />{t('Open results', 'فتح النتائج')}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
