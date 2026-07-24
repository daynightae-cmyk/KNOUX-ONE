/**
 * KNOUX ONE — Module 03 Keeper Auto-Rules Configuration Panel
 */
import React from 'react';
import { Sliders, CheckCircle2, ShieldAlert, Sparkles, FolderTree } from 'lucide-react';
import { useTranslation } from '../../i18n';

export function DuplicateKeeperRules({ store }: { store: any }) {
  const { t } = useTranslation();
  const rules = store.keeperRules;

  const updateRule = (key: string, value: any) => {
    store.setKeeperRules((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="knoux-card p-6 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl space-y-6">
        <div>
          <h3 className="text-base font-bold text-[var(--knoux-text)] flex items-center gap-2">
            <Sliders className="h-5 w-5 text-blue-400" />
            {t('Intelligent Keeper Selection Rules', 'قواعد الاختيار الذكي للنسخة الأصلية')}
          </h3>
          <p className="mt-1 text-xs text-[var(--knoux-subtext)]">
            {t(
              'Automate which file in a duplicate group is kept as the canonical master, marking redundant copies for safe quarantine.',
              'تحديد آلي للملف الأصلي المعتمد في كل مجموعة مكررة مع حماية النسخ الهامة.'
            )}
          </p>
        </div>

        <div className="space-y-4 border-t border-[var(--knoux-border)] pt-5">
          {/* Rule 1: Creation / Modification Date Preference */}
          <div>
            <label className="text-xs font-bold text-[var(--knoux-text)] block mb-1">
              {t('1. Timestamp Preference Rule', '1. تفضيل تاريخ إنشاء أو تعديل الملف')}
            </label>
            <select
              value={rules.preferDate}
              onChange={e => updateRule('preferDate', e.target.value)}
              className="knoux-select text-xs w-full"
            >
              <option value="oldest">{t('Keep Oldest Creation Date (Original First Creation)', 'الاحتفاظ بالتاريخ الأقدم (أول ملف تم إنشاؤه)')}</option>
              <option value="newest">{t('Keep Newest Modification Date (Most Recent Update)', 'الاحتفاظ بالتاريخ الأحدث (آخر ملف تم تعديله)')}</option>
            </select>
          </div>

          {/* Rule 2: Folder Path Depth Preference */}
          <div>
            <label className="text-xs font-bold text-[var(--knoux-text)] block mb-1">
              {t('2. Directory Path Hierarchy Rule', '2. تفضيل عمق ومكان المجلد')}
            </label>
            <select
              value={rules.preferPath}
              onChange={e => updateRule('preferPath', e.target.value)}
              className="knoux-select text-xs w-full"
            >
              <option value="shortest">{t('Keep Shortest Path Depth (e.g. C:\\Docs before C:\\Docs\\Temp\\Backup)', 'الاحتفاظ بأقصر مسار رئيسي للمجلدات')}</option>
              <option value="longest">{t('Keep Deepest Subfolder Path', 'الاحتفاظ بأعمق مسار فرعي للمجلدات')}</option>
            </select>
          </div>

          {/* Rule 3: Auto Select Non-Keepers */}
          <div className="flex items-center gap-3 border-t border-[var(--knoux-border)] pt-4">
            <input
              type="checkbox"
              id="autoSelect"
              checked={rules.autoSelectNonKeepers}
              onChange={e => updateRule('autoSelectNonKeepers', e.target.checked)}
              className="rounded border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] text-blue-500"
            />
            <label htmlFor="autoSelect" className="text-xs text-[var(--knoux-text)] cursor-pointer">
              {t('Automatically check all non-keeper copies for quarantine', 'تحديد جميع النسخ غير الأصلية تلقائياً لإرسالها للمحجر')}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
