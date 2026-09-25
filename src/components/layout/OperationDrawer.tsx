import { Activity, ChevronDown, ChevronUp, CircleAlert, History, LoaderCircle } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';

export function OperationDrawer() {
  const { actionLogs, activeScanTitle, isScanning, operationDrawerOpen, setOperationDrawerOpen, language, t } = useKnoux();
  const latest = actionLogs[0];

  return (
    <section className={`knoux-operation-drawer ${operationDrawerOpen ? 'is-open' : ''}`} aria-label={t('Operation drawer', 'درج العمليات')}>
      <button type="button" className="knoux-operation-statusbar" onClick={() => setOperationDrawerOpen(!operationDrawerOpen)} aria-expanded={operationDrawerOpen}>
        <span className="flex min-w-0 items-center gap-2">
          {isScanning ? <LoaderCircle className="h-4 w-4 animate-spin text-[var(--knoux-primary-bright)]" /> : latest?.status === 'failed' ? <CircleAlert className="h-4 w-4 text-[var(--knoux-danger)]" /> : <Activity className="h-4 w-4 text-[var(--knoux-success)]" />}
          <span className="truncate text-[12px] font-bold text-[var(--knoux-text)]">
            {isScanning ? activeScanTitle : latest ? latest.capabilityName : t('No operations in this session', 'لا توجد عمليات في هذه الجلسة')}
          </span>
        </span>
        <span className="flex items-center gap-3 text-[11px] font-semibold text-[var(--knoux-text-muted)]">
          {actionLogs.length} {t('records', 'سجل')}
          {operationDrawerOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </span>
      </button>

      {operationDrawerOpen && (
        <div className="custom-scrollbar grid min-h-0 flex-1 gap-2 overflow-y-auto p-3 md:grid-cols-2 xl:grid-cols-3">
          {isScanning && (
            <article className="knoux-operation-record border-[var(--knoux-primary)]/30">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--knoux-primary-bright)]" />
              <div><p className="text-[12px] font-black text-[var(--knoux-text)]">{activeScanTitle}</p><p className="mt-1 text-[11px] text-[var(--knoux-text-muted)]">{t('Indeterminate native operation · no fabricated percentage', 'عملية محلية غير محددة النسبة · دون نسبة وهمية')}</p></div>
            </article>
          )}
          {actionLogs.map(log => (
            <article key={log.id} className="knoux-operation-record">
              <History className="h-5 w-5 text-[var(--knoux-primary-bright)]" />
              <div className="min-w-0">
                <div className="flex items-center gap-2"><p className="truncate text-[12px] font-black text-[var(--knoux-text)]">{log.capabilityName}</p><span className="knoux-chip py-1 text-[10px]">{log.status}</span></div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--knoux-text-muted)]">{log.details}</p>
                <time className="mt-1 block text-[10px] text-[var(--knoux-text-muted)]" dir="ltr">{new Date(log.timestamp).toLocaleString(language === 'ar' ? 'ar-AE' : 'en-GB')}</time>
              </div>
            </article>
          ))}
          {!isScanning && actionLogs.length === 0 && <p className="col-span-full py-6 text-center text-[12px] text-[var(--knoux-text-muted)]">{t('Verified native results will appear here when this session runs an operation.', 'ستظهر النتائج المحلية الموثقة هنا عند تشغيل عملية خلال هذه الجلسة.')}</p>}
        </div>
      )}
    </section>
  );
}
