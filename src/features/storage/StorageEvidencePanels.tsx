import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileCode2, FileSpreadsheet, FileText, Globe, History, ShieldCheck } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { storageClient } from './storageClient';
import type {
  StorageAgeBasis,
  StorageAgePolicy,
  StorageRedactionProfile,
  StorageReportArtifact,
  StorageReportExportResult,
  StorageReportFormat,
  StorageSnapshotSummary,
} from './storageContracts';

const FORMAT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  json: FileCode2,
  csv: FileSpreadsheet,
  html: Globe,
};

/**
 * The wording a row may be described with. "Old" must never be rendered as "unused"
 * unless the machine was measured to keep last-access timestamps.
 */
export function ageBasisLabel(basis: StorageAgeBasis | string, language: 'en' | 'ar'): string {
  if (language === 'ar') {
    switch (basis) {
      case 'LAST_ACCESS':
        return 'لم يتم الوصول إليه منذ';
      case 'LAST_WRITE_FALLBACK':
        return 'لم يتم تعديله منذ';
      default:
        return 'لا يوجد دليل موثوق على العمر';
    }
  }
  switch (basis) {
    case 'LAST_ACCESS':
      return 'not accessed since';
    case 'LAST_WRITE_FALLBACK':
      return 'not modified since';
    default:
      return 'no trustworthy age signal';
  }
}

export function ageBasisTone(basis: StorageAgeBasis | string): string {
  switch (basis) {
    case 'LAST_ACCESS':
      return 'text-emerald-200';
    case 'LAST_WRITE_FALLBACK':
      return 'text-amber-200';
    default:
      return 'text-[var(--knoux-text-muted)]';
  }
}

function policyHeadline(policy: StorageAgePolicy, language: 'en' | 'ar'): string {
  if (language === 'ar') {
    switch (policy.state) {
      case 'last_access_updates_enabled':
        return 'ويندوز تحدّث وقت الوصول — يمكن قول "آخر 사용" بأمان';
      case 'last_access_updates_disabled':
        return 'تحديثات وقت الوصول معطّلة — "قديم" تعني "لم يتم التعديل"';
      case 'system_managed':
        return 'الوصول يديره النظام — لا يُطبَّق وقت الوصول على الملفات';
      default:
        return 'تعذّر قياس سياسة وقت الوصول — لا يدّعي هذا التقرير أن أي ملف غير مستخدم';
    }
  }
  switch (policy.state) {
    case 'last_access_updates_enabled':
      return 'Windows keeps last-access timestamps — "last used" is a real signal here';
    case 'last_access_updates_disabled':
      return 'Last-access updates are disabled — "old" means "not modified"';
    case 'system_managed':
      return 'Access time is system-managed — it is not applied to files';
    default:
      return 'The last-access policy could not be measured — nothing is called unused';
  }
}

export const StorageAgePolicyPanel: React.FC<{ policy: StorageAgePolicy }> = ({ policy }) => {
  const { language } = useKnoux();
  const reliable = policy.lastAccessReliableForFiles;
  return (
    <section
      className={`rounded-2xl border p-5 ${
        reliable ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'
      }`}
      data-testid="m04-age-policy"
      data-policy-state={policy.state}
      data-last-access-reliable={String(reliable)}
    >
      <div className="flex items-start gap-3 rtl:flex-row-reverse">
        {reliable ? (
          <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
        ) : (
          <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
        )}
        <div className="min-w-0">
          <p className={`font-black ${reliable ? 'text-emerald-100' : 'text-amber-100'}`}>
            {policyHeadline(policy, language)}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-secondary)]">
            {language === 'ar' ? policy.noteAr : policy.noteEn}
          </p>
          <p className="mt-3 text-xs text-[var(--knoux-text-muted)]">
            {language === 'ar' ? 'مصدر القياس' : 'Measured from'}: <code>{policy.source}</code>
            {' · '}
            {language === 'ar' ? 'القيمة كما أبلغت عنها ويندوز' : 'Value as Windows reported it'}:{' '}
            <code>{policy.rawValue || '—'}</code>
          </p>
        </div>
      </div>
    </section>
  );
};

const ArtifactRow: React.FC<{ artifact: StorageReportArtifact; language: 'en' | 'ar' }> = ({ artifact, language }) => {
  const Icon = FORMAT_ICON[artifact.format] ?? FileText;
  return (
    <li className="rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] p-3">
      <div className="flex items-center gap-2 rtl:flex-row-reverse">
        <Icon className="h-4 w-4 shrink-0 text-[var(--knoux-text-muted)]" />
        <span className="text-sm font-bold uppercase text-[var(--knoux-text)]">{artifact.format}</span>
        {artifact.signatureValid ? (
          <span className="knoux-chip text-[10px] text-emerald-200">
            {language === 'ar' ? 'توقيع صالح' : 'signature verified'}
          </span>
        ) : (
          <span className="knoux-chip text-[10px] text-amber-200">
            {language === 'ar' ? 'توقيع غير مطابق' : 'signature mismatch'}
          </span>
        )}
        <span className="ms-auto text-xs text-[var(--knoux-text-muted)]">
          {artifact.byteCount.toLocaleString()} B
        </span>
      </div>
      <p className="mt-2 break-all text-[11px] text-[var(--knoux-text-muted)]" dir="ltr">
        {artifact.path}
      </p>
      <dl className="mt-2 space-y-1 text-[11px]" dir="ltr">
        <div className="flex gap-2">
          <dt className="text-[var(--knoux-text-muted)]">SHA-256</dt>
          <dd className="truncate font-mono text-[var(--knoux-text-secondary)]">{artifact.sha256}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-[var(--knoux-text-muted)]">BLAKE3</dt>
          <dd className="truncate font-mono text-[var(--knoux-text-secondary)]">{artifact.blake3}</dd>
        </div>
      </dl>
    </li>
  );
};

const FORMAT_CHOICES: StorageReportFormat[] = ['all', 'json', 'csv', 'html'];
const REDACTION_CHOICES: StorageRedactionProfile[] = ['none', 'user_profile'];

export interface StorageReportPanelProps {
  scanId?: string;
  runtimeAvailable: boolean;
  onExported?: (result: StorageReportExportResult) => void;
}

export const StorageReportPanel: React.FC<StorageReportPanelProps> = ({ scanId, runtimeAvailable, onExported }) => {
  const { t, language } = useKnoux();
  const [format, setFormat] = useState<StorageReportFormat>('all');
  const [redaction, setRedaction] = useState<StorageRedactionProfile>('none');
  const [result, setResult] = useState<StorageReportExportResult | null>(null);
  const [history, setHistory] = useState<StorageSnapshotSummary[]>([]);
  const [selectedScan, setSelectedScan] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const effectiveScan = selectedScan || scanId || '';

  const refreshHistory = useCallback(async () => {
    if (!runtimeAvailable) return;
    const response = await storageClient.reportHistory();
    if (response.status === 'completed' || response.status === 'completed_with_warnings') {
      setHistory(response.data ?? []);
    }
  }, [runtimeAvailable]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  const run = async () => {
    if (!effectiveScan || busy) return;
    setBusy(true);
    setError('');
    const response = await storageClient.exportReport(effectiveScan, undefined, format, redaction);
    setBusy(false);
    if ((response.status === 'completed' || response.status === 'completed_with_warnings') && response.data) {
      setResult(response.data);
      onExported?.(response.data);
      void refreshHistory();
    } else {
      setError(language === 'ar' ? response.summaryAr : response.summaryEn);
    }
  };

  return (
    <section className="knoux-glass-panel p-5" data-testid="m04-report-panel">
      <div className="flex flex-wrap items-center gap-3 rtl:flex-row-reverse">
        <ShieldCheck className="h-5 w-5 text-[var(--knoux-text-muted)]" />
        <h3 className="text-lg font-black text-[var(--knoux-text)]">
          {t('Durable storage report', 'تقرير مساحة تخزين دائم')}
        </h3>
      </div>
      <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-secondary)]">
        {t(
          'Reports are regenerated from persisted scan evidence in the local database, so an export still works after the application restarts. Every written document is hashed so it can be verified.',
          'تُنشأ التقارير من أدلة الفحص المحفوظة في قاعدة البيانات المحلية، لذا يظل التصدير ممكنًا بعد إعادة تشغيل التطبيق. وتُحسب بصمة لكل مستند للتحقق منه.',
        )}
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="knoux-field">
          <span className="knoux-field-label">
            {t('Persisted scan', 'الفحص المحفوظ')}
          </span>
          <select
            className="knoux-input"
            value={effectiveScan}
            onChange={event => setSelectedScan(event.target.value)}
            data-testid="m04-report-scan"
          >
            <option value="">{t('Select a scan', 'اختر فحصًا')}</option>
            {history.map(item => (
              <option key={item.snapshotId} value={item.snapshotId}>
                {item.capturedAt} · {item.rootPath} · {item.totalFiles.toLocaleString()}{' '}
                {t('files', 'ملف')}
              </option>
            ))}
          </select>
        </label>

        <label className="knoux-field">
          <span className="knoux-field-label">{t('Format', 'الصيغة')}</span>
          <select
            className="knoux-input"
            value={format}
            onChange={event => setFormat(event.target.value as StorageReportFormat)}
            data-testid="m04-report-format"
          >
            {FORMAT_CHOICES.map(value => (
              <option key={value} value={value}>
                {value === 'all' ? t('All supported', 'كل الصيغ المدعومة') : value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="knoux-field">
          <span className="knoux-field-label">{t('Redaction', 'إخفاء الهوية')}</span>
          <select
            className="knoux-input"
            value={redaction}
            onChange={event => setRedaction(event.target.value as StorageRedactionProfile)}
            data-testid="m04-report-redaction"
          >
            {REDACTION_CHOICES.map(value => (
              <option key={value} value={value}>
                {value === 'none'
                  ? t('None (exact measured paths)', 'بدون (المسارات المقاسة كما هي)')
                  : t('Hide user profile roots', 'إخفاء مجلدات المستخدم')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="knoux-card-action knoux-card-action--primary"
          onClick={run}
          disabled={!effectiveScan || busy || !runtimeAvailable}
          data-testid="m04-report-export"
        >
          <Download className="h-4 w-4" />
          {busy ? t('Exporting…', 'جارٍ التصدير…') : t('Export report', 'تصدير التقرير')}
        </button>
        <button type="button" className="knoux-card-action" onClick={() => void refreshHistory()}>
          <History className="h-4 w-4" />
          {t('Refresh saved scans', 'تحديث الفحوص المحفوظة')}
        </button>
      </div>

      {!runtimeAvailable && (
        <p className="mt-3 text-xs text-amber-200">
          {t(
            'Report export needs the desktop runtime. No document is fabricated in the browser preview.',
            'يتطلب تصدير التقرير بيئة سطح المكتب. لا يتم إنشاء أي مستند في المعاينة.',
          )}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}

      {result && (
        <div className="mt-5 space-y-3">
          <p className="text-sm text-[var(--knoux-text-secondary)]">
            {t('Written', 'تم كتابة')} {result.artifacts.length}{' '}
            {t('document(s)', 'مستند')} · {t('redaction', 'إخفاء الهوية')}: {result.redactionProfile}
          </p>
          <ul className="space-y-2">
            {result.artifacts.map(artifact => (
              <ArtifactRow key={artifact.artifactId} artifact={artifact} language={language} />
            ))}
          </ul>
          {result.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-amber-200">
              {result.warnings.map(warning => (
                <li key={warning}>⚠ {warning}</li>
              ))}
            </ul>
          )}
          {result.formatsUnsupported.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm font-black text-amber-100">
                {t('Formats this build does not produce', 'صيغ لا ينتجها هذا الإصدار')}
              </p>
              <ul className="mt-2 space-y-2 text-xs text-amber-100/80">
                {result.formatsUnsupported.map(item => (
                  <li key={item.format}>
                    <span className="font-mono font-bold">{item.format}</span> —{' '}
                    {language === 'ar' ? item.reasonAr : item.reasonEn}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export const StorageReportHistoryBadge: React.FC<{ count: number }> = ({ count }) => {
  const { t } = useKnoux();
  return (
    <span className="knoux-chip" data-testid="m04-report-history-count">
      {count} {t('persisted scans available', 'فحص محفوظ متاح')}
    </span>
  );
};
