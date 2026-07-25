import React, { useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateQuarantineView({ store }: { store: any }) {
  const { t } = useTranslation();
  const [restoreModes, setRestoreModes] = useState<Record<string, 'fail' | 'rename' | 'replace' | 'choose'>>({});
  const records = store.quarantineRecords;

  if (records.length === 0) {
    return (
      <div className="knoux-card rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-12 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-purple-400" />
        <h3 className="mt-3 text-base font-black text-[var(--knoux-text)]">
          {t('Quarantine vault is empty', 'المحجر الآمن فارغ')}
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-[var(--knoux-subtext)]">
          {t(
            'Only files confirmed by the native engine appear here. Web preview never creates sample quarantine records.',
            'لا تظهر هنا إلا الملفات التي أكد المحرك المحلي نقلها فعليًا، ولا تنشئ معاينة الويب سجلات تجريبية.',
          )}
        </p>
      </div>
    );
  }

  const restore = async (quarantineId: string, originalPath: string) => {
    const mode = restoreModes[quarantineId] ?? 'rename';
    let destination: string | null = null;
    if (mode === 'choose') {
      destination = window.prompt(
        t('Enter a complete restore destination path.', 'أدخل مسار الاستعادة الكامل.'),
        originalPath,
      );
      if (!destination) return;
    }
    await store.restoreQuarantinedItem(quarantineId, mode, destination);
  };

  return (
    <div className="space-y-4">
      <section className="knoux-glass-panel flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-[var(--knoux-text)]">
            <ShieldAlert className="h-5 w-5 text-purple-400" />
            {t('Checksum-verified quarantine vault', 'محجر موثق بالبصمة الرقمية')}
          </h2>
          <p className="mt-1 text-xs leading-6 text-[var(--knoux-subtext)]">
            {t(
              'Restore, verify, or permanently purge files only after the Rust engine confirms the action.',
              'استعد الملفات أو تحقق منها أو احذفها نهائيًا فقط بعد تأكيد محرك Rust للعملية.',
            )}
          </p>
        </div>
        <span className="knoux-chip knoux-chip--accent">{records.length} {t('records', 'سجل')}</span>
      </section>

      <div className="space-y-3">
        {records.map((record: any) => {
          const mode = restoreModes[record.quarantineId] ?? 'rename';
          return (
            <article key={record.quarantineId} className="knoux-card rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-mono text-sm font-black text-[var(--knoux-text)]" dir="ltr">{record.fileName}</h3>
                    <span className={`knoux-chip ${record.verificationState === 'verified' ? 'knoux-chip--success' : 'knoux-chip--warning'}`}>
                      {record.verificationState}
                    </span>
                    <span className="knoux-chip">{record.status}</span>
                  </div>
                  <p className="mt-2 truncate font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr" title={record.originalPath}>{record.originalPath}</p>
                  <p className="mt-1 truncate font-mono text-[11px] text-purple-300/80" dir="ltr" title={record.quarantinePath}>{record.quarantinePath}</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--knoux-subtext)]">
                    <span>{formatBytes(record.sizeBytes)}</span>
                    <span>{new Date(record.quarantinedAt).toLocaleString()}</span>
                    <span className="font-mono" dir="ltr">BLAKE3 {String(record.hash).slice(0, 16)}…</span>
                  </div>
                </div>

                {record.status === 'quarantined' && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                      value={mode}
                      onChange={event => setRestoreModes(previous => ({ ...previous, [record.quarantineId]: event.target.value as typeof mode }))}
                      className="knoux-select min-w-[190px] text-xs"
                    >
                      <option value="rename">{t('Rename on conflict', 'إعادة التسمية عند التعارض')}</option>
                      <option value="fail">{t('Stop on conflict', 'التوقف عند التعارض')}</option>
                      <option value="replace">{t('Replace with rollback backup', 'الاستبدال مع نسخة رجوع')}</option>
                      <option value="choose">{t('Choose another path', 'اختيار مسار آخر')}</option>
                    </select>
                    <button type="button" onClick={() => store.verifyQuarantinedItem(record.quarantineId)} className="knoux-btn-secondary inline-flex items-center gap-2 text-xs">
                      <FileCheck2 className="h-4 w-4" />{t('Verify', 'تحقق')}
                    </button>
                    <button type="button" onClick={() => restore(record.quarantineId, record.originalPath)} className="knoux-btn-secondary inline-flex items-center gap-2 text-xs text-emerald-300">
                      <RotateCcw className="h-4 w-4" />{t('Restore', 'استعادة')}
                    </button>
                    <button type="button" onClick={() => store.purgeQuarantinedItem(record.quarantineId)} className="knoux-btn-secondary inline-flex items-center gap-2 border-rose-500/30 text-xs text-rose-300">
                      <Trash2 className="h-4 w-4" />{t('Purge', 'حذف نهائي')}
                    </button>
                  </div>
                )}

                {record.status === 'restored' && (
                  <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-400"><CheckCircle2 className="h-5 w-5" />{t('Restored and verified', 'تمت الاستعادة والتحقق')}</span>
                )}
                {record.status === 'purged' && (
                  <span className="inline-flex items-center gap-2 text-sm font-black text-rose-400"><Trash2 className="h-5 w-5" />{t('Permanently purged', 'تم الحذف النهائي')}</span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
