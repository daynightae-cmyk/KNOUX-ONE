import React, { useMemo, useState } from 'react';
import { FolderTree, Layers, Search, ShieldAlert } from 'lucide-react';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateResultsWorkspace({ store }: { store: any }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredGroups = useMemo(
    () =>
      store.duplicateGroups.filter((group: any) => {
        const categoryMatches = selectedCategory === 'all' || group.category === selectedCategory;
        const query = searchQuery.trim().toLowerCase();
        const searchMatches =
          !query ||
          group.files.some(
            (file: any) =>
              file.name.toLowerCase().includes(query) ||
              file.canonicalPath.toLowerCase().includes(query),
          );
        return categoryMatches && searchMatches;
      }),
    [searchQuery, selectedCategory, store.duplicateGroups],
  );

  const selected = store.duplicateGroups.flatMap((group: any) =>
    group.files.filter(
      (file: any) =>
        group.actionable &&
        file.selectedForQuarantine &&
        !file.isKeeper &&
        !file.isHardLinkAlias &&
        !file.protectedPath,
    ),
  );
  const selectedBytes = selected.reduce((total: number, file: any) => total + file.sizeBytes, 0);

  if (store.folderComparison) {
    return (
      <div className="space-y-4">
        {store.folderComparison.comparisons.map((comparison: any) => (
          <section key={`${comparison.leftPath}:${comparison.rightPath}`} className="knoux-glass-panel p-5">
            <div className="flex items-start gap-3">
              <FolderTree className="mt-1 h-5 w-5 text-blue-300" />
              <div className="min-w-0">
                <h3 className="text-base font-black text-[var(--knoux-text)]">{comparison.classification}</h3>
                <p className="mt-2 break-all font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr">{comparison.leftPath}</p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr">{comparison.rightPath}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="knoux-chip">{comparison.commonEntries} common</span>
                  <span className="knoux-chip">{comparison.leftOnlyEntries} left only</span>
                  <span className="knoux-chip">{comparison.rightOnlyEntries} right only</span>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    );
  }

  if (store.duplicateGroups.length === 0) {
    return (
      <div className="knoux-glass-panel p-12 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
          <Layers className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-black text-[var(--knoux-text)]">
          {t('No verified duplicate results', 'لا توجد نتائج تكرار موثقة')}
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-[var(--knoux-subtext)]">
          {t(
            store.runtime.available
              ? 'Choose real folders and run a native scan. Empty results are not replaced with sample files.'
              : 'Open KNOUX ONE Desktop to scan the device. The web preview never fabricates duplicate files.',
            store.runtime.available
              ? 'اختر مجلدات حقيقية وشغّل الفحص المحلي، ولن تُستبدل النتائج الفارغة بملفات تجريبية.'
              : 'افتح تطبيق KNOUX ONE Desktop لفحص الجهاز، فنسخة الويب لا تختلق ملفات مكررة.',
          )}
        </p>
        <button type="button" onClick={() => store.setActiveTab('setup')} className="knoux-btn-primary mt-6 px-6">
          {t('Open scan setup', 'فتح إعدادات الفحص')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="knoux-glass-panel sticky top-2 z-10 flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--knoux-subtext)]" />
            <input
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={t('Search file name or path…', 'ابحث باسم الملف أو المسار…')}
              className="knoux-input w-full ps-9 text-xs"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={event => setSelectedCategory(event.target.value)}
            className="knoux-select min-w-[145px] text-xs"
          >
            <option value="all">{t('All categories', 'كل التصنيفات')}</option>
            <option value="images">{t('Images', 'الصور')}</option>
            <option value="videos">{t('Videos', 'الفيديو')}</option>
            <option value="audio">{t('Audio', 'الصوت')}</option>
            <option value="documents">{t('Documents', 'المستندات')}</option>
            <option value="archives">{t('Archives', 'الأرشيف')}</option>
            <option value="other">{t('Other', 'أخرى')}</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <div className="text-end">
            <p className="text-xs font-black text-[var(--knoux-text)]">
              {selected.length} {t('verified selections', 'عناصر محددة وموثقة')}
            </p>
            <p className="font-mono text-[11px] text-amber-300">{formatBytes(selectedBytes)}</p>
          </div>
          <button
            type="button"
            onClick={store.quarantineSelectedFiles}
            disabled={selected.length === 0}
            className="knoux-btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-rose-600 text-xs disabled:opacity-40"
          >
            <ShieldAlert className="h-4 w-4" />
            {t('Quarantine selected', 'نقل المحدد للمحجر')}
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {filteredGroups.map((group: any) => (
          <React.Fragment key={group.groupId}>
            <DuplicateGroupCard group={group} store={store} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
