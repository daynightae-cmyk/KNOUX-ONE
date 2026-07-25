import React from 'react';
import { CheckCircle2, FolderTree, ShieldAlert, Sliders } from 'lucide-react';
import { useTranslation } from '../../i18n';

export function DuplicateKeeperRules({ store }: { store: any }) {
  const { t } = useTranslation();
  const rules = store.keeperRules;
  const update = (key: string, value: unknown) =>
    store.setKeeperRules((previous: any) => ({ ...previous, [key]: value }));

  return (
    <div className="max-w-4xl space-y-5">
      <section className="knoux-glass-panel p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[var(--knoux-text)]">
              <Sliders className="h-5 w-5 text-blue-300" />
              {t('User-controlled keeper plan', 'خطة احتفاظ يتحكم بها المستخدم')}
            </h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--knoux-subtext)]">
              {t(
                'Rules generate explainable recommendations only. No file is deleted, and groups without one keeper are blocked.',
                'تنشئ القواعد توصيات قابلة للتفسير فقط، ولا يُحذف أي ملف، كما تُمنع أي مجموعة لا تحتوي على نسخة واحدة للاحتفاظ بها.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={store.reapplyKeeperRules}
            disabled={store.duplicateGroups.length === 0 || !store.runtime.available}
            className="knoux-btn-primary inline-flex items-center gap-2 text-xs disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            {t('Preview rules on results', 'معاينة القواعد على النتائج')}
          </button>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Field label={t('Date priority', 'أولوية التاريخ')}>
            <select value={rules.preferDate} onChange={event => update('preferDate', event.target.value)} className="knoux-select w-full text-xs">
              <option value="oldest">{t('Keep oldest creation date', 'الاحتفاظ بأقدم تاريخ إنشاء')}</option>
              <option value="newest">{t('Keep newest modification', 'الاحتفاظ بأحدث تعديل')}</option>
            </select>
          </Field>

          <Field label={t('Path priority', 'أولوية المسار')}>
            <select value={rules.preferPath} onChange={event => update('preferPath', event.target.value)} className="knoux-select w-full text-xs">
              <option value="shortest">{t('Keep shortest path', 'الاحتفاظ بأقصر مسار')}</option>
              <option value="longest">{t('Keep deepest path', 'الاحتفاظ بأعمق مسار')}</option>
              <option value="preferred_dir">{t('Prefer a protected folder', 'تفضيل مجلد محدد')}</option>
            </select>
          </Field>

          <Field label={t('Preferred directory', 'المجلد المفضل')}>
            <div className="relative">
              <FolderTree className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--knoux-subtext)]" />
              <input
                value={rules.preferredDirectory ?? ''}
                onChange={event => update('preferredDirectory', event.target.value)}
                placeholder="C:\Users\Name\Documents"
                className="knoux-input w-full ps-9 font-mono text-xs"
                dir="ltr"
              />
            </div>
          </Field>

          <Field label={t('Image quality priority', 'أولوية جودة الصور')}>
            <select value={rules.preferResolution} onChange={event => update('preferResolution', event.target.value)} className="knoux-select w-full text-xs">
              <option value="highest">{t('Keep highest resolution', 'الاحتفاظ بأعلى دقة')}</option>
              <option value="lowest">{t('Keep lowest resolution', 'الاحتفاظ بأقل دقة')}</option>
            </select>
          </Field>
        </div>

        <label className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-4">
          <input
            type="checkbox"
            checked={rules.autoSelectNonKeepers}
            onChange={event => update('autoSelectNonKeepers', event.target.checked)}
            className="mt-1"
          />
          <span>
            <strong className="text-sm text-[var(--knoux-text)]">{t('Preselect verified non-keepers', 'تحديد النسخ الزائدة الموثقة مسبقًا')}</strong>
            <span className="mt-1 block text-xs leading-6 text-[var(--knoux-subtext)]">
              {t(
                'This never selects similar-image groups, candidates, protected paths, hard-link aliases, or the chosen keeper.',
                'لا يحدد هذا الخيار مجموعات الصور المتشابهة أو المرشحين أو المسارات المحمية أو الروابط الصلبة أو النسخة المختارة للاحتفاظ.',
              )}
            </span>
          </span>
        </label>
      </section>

      <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
          <p className="text-xs leading-6 text-amber-100/85">
            {t(
              'Quarantine is blocked until every actionable group has exactly one keeper and every selected file is revalidated.',
              'يُمنع النقل إلى المحجر حتى تحتوي كل مجموعة قابلة للتنفيذ على نسخة واحدة للاحتفاظ، وتتم إعادة التحقق من كل ملف محدد.',
            )}
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-[var(--knoux-text)]">{label}</span>
      {children}
    </label>
  );
}
