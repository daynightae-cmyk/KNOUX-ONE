/**
 * KNOUX ONE — Module 03 Side-by-Side Visual Compare Component
 */
import React from 'react';
import { Copy, Eye, CheckCircle2, FileText, Image as ImageIcon, Video as VideoIcon, ArrowRight } from 'lucide-react';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateMediaCompare({ store }: { store: any }) {
  const { t } = useTranslation();
  const group = store.selectedGroupForCompare || store.duplicateGroups[0];

  if (!group) {
    return (
      <div className="knoux-card text-center p-12 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl">
        <Copy className="mx-auto h-12 w-12 text-blue-400" />
        <h3 className="mt-3 text-base font-bold text-[var(--knoux-text)]">
          {t('No Group Selected for Side-by-Side Compare', 'لم يتم اختيار مجموعة للمقارنة البصرية')}
        </h3>
        <p className="mt-1 text-xs text-[var(--knoux-subtext)]">
          {t('Select a duplicate group from the results workspace to inspect files side-by-side.', 'اختر مجموعة مكررات من جدول النتائج لمعاينة الملفات جنباً إلى جنب.')}
        </p>
      </div>
    );
  }

  const fileA = group.files[0];
  const fileB = group.files[1] || group.files[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between knoux-card p-4 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)]">
        <div>
          <span className="text-xs text-[var(--knoux-subtext)]">{t('Visual Comparison Workspace', 'مسار المقارنة البصرية')}</span>
          <h3 className="text-base font-bold text-[var(--knoux-text)]">
            {t('Comparing Group:', 'مقارنة المجموعة:')} <span className="font-mono text-blue-400">{group.commonHash}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-emerald-400 font-bold">
            {t('Wasted Space:', 'المساحة الضائعة:')} {formatBytes(group.wastedSizeBytes)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* File A Card */}
        <div className={`knoux-card p-5 rounded-xl border ${fileA.isKeeper ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-[var(--knoux-border)] bg-[var(--knoux-card-bg)]'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-blue-400">{t('File A (Original)', 'الملف أ (الأصلي)')}</span>
            {fileA.isKeeper && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {t('KEEPER', 'الأصل المحفوظ')}
              </span>
            )}
          </div>

          <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center border border-[var(--knoux-border)] overflow-hidden mb-4">
            {group.category === 'images' ? (
              <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" alt="Preview A" className="h-full w-full object-cover" />
            ) : (
              <FileText className="h-16 w-16 text-[var(--knoux-subtext)]" />
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[var(--knoux-subtext)] block">{t('Name:', 'الاسم:')}</span>
              <span className="font-bold text-[var(--knoux-text)] font-mono">{fileA.name}</span>
            </div>
            <div>
              <span className="text-[var(--knoux-subtext)] block">{t('Path:', 'المسار:')}</span>
              <span className="text-[var(--knoux-subtext)] font-mono break-all">{fileA.path}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--knoux-border)] pt-2">
              <span className="text-[var(--knoux-subtext)]">{t('Size:', 'الحجم:')}</span>
              <span className="font-mono font-bold text-[var(--knoux-text)]">{formatBytes(fileA.sizeBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--knoux-subtext)]">{t('Modified:', 'تاريخ التعديل:')}</span>
              <span className="font-mono text-[var(--knoux-text)]">{new Date(fileA.modifiedTime).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* File B Card */}
        <div className={`knoux-card p-5 rounded-xl border ${fileB.isKeeper ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-400">{t('File B (Duplicate Copy)', 'الملف ب (النسخة المكررة)')}</span>
            {!fileB.isKeeper && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {t('DUPLICATE COPY', 'نسخة مكررة')}
              </span>
            )}
          </div>

          <div className="aspect-video bg-black/40 rounded-lg flex items-center justify-center border border-[var(--knoux-border)] overflow-hidden mb-4">
            {group.category === 'images' ? (
              <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80" alt="Preview B" className="h-full w-full object-cover filter brightness-95" />
            ) : (
              <FileText className="h-16 w-16 text-[var(--knoux-subtext)]" />
            )}
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[var(--knoux-subtext)] block">{t('Name:', 'الاسم:')}</span>
              <span className="font-bold text-[var(--knoux-text)] font-mono">{fileB.name}</span>
            </div>
            <div>
              <span className="text-[var(--knoux-subtext)] block">{t('Path:', 'المسار:')}</span>
              <span className="text-[var(--knoux-subtext)] font-mono break-all">{fileB.path}</span>
            </div>
            <div className="flex justify-between border-t border-[var(--knoux-border)] pt-2">
              <span className="text-[var(--knoux-subtext)]">{t('Size:', 'الحجم:')}</span>
              <span className="font-mono font-bold text-[var(--knoux-text)]">{formatBytes(fileB.sizeBytes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--knoux-subtext)]">{t('Modified:', 'تاريخ التعديل:')}</span>
              <span className="font-mono text-[var(--knoux-text)]">{new Date(fileB.modifiedTime).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
