/**
 * KNOUX ONE — Module 03 Duplicate Results Workspace
 */
import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Filter,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { DuplicateGroupCard } from './DuplicateGroupCard';
import { formatBytes } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateResultsWorkspace({ store }: { store: any }) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredGroups = useMemo(() => {
    return store.duplicateGroups.filter((group: any) => {
      const categoryMatch = selectedCategory === 'all' || group.category === selectedCategory;
      const searchMatch = !searchQuery || group.files.some((f: any) => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.path.toLowerCase().includes(searchQuery.toLowerCase()));
      return categoryMatch && searchMatch;
    });
  }, [store.duplicateGroups, selectedCategory, searchQuery]);

  const selectedCount = store.duplicateGroups.reduce((acc: number, g: any) => {
    return acc + g.files.filter((f: any) => f.selectedForQuarantine && !f.isKeeper).length;
  }, 0);

  const selectedBytes = store.duplicateGroups.reduce((acc: number, g: any) => {
    return acc + g.files.filter((f: any) => f.selectedForQuarantine && !f.isKeeper).reduce((s: number, f: any) => s + f.sizeBytes, 0);
  }, 0);

  if (store.duplicateGroups.length === 0) {
    return (
      <div className="knoux-card text-center p-12 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <Layers className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-[var(--knoux-text)]">
          {t('No Duplicate Scan Results Active', 'لا توجد نتائج فحص مكررات نشطة حالياً')}
        </h3>
        <p className="mt-2 text-sm text-[var(--knoux-subtext)] max-w-md mx-auto">
          {t(
            'Run a new scan using BLAKE3 cryptographic hashing or similar-image perceptual matching to identify duplicate files.',
            'قم بتشغيل فحص جديد باستخدام البصمة الرقمية الفائقة أو مطابقة الصور المكررة لإنشاء قائمة النتائج.'
          )}
        </p>
        <button
          onClick={() => store.setActiveTab('setup')}
          className="mt-6 knoux-btn-primary px-6 py-2.5 text-sm"
        >
          {t('Configure & Run Scan', 'تكوين وبدء الفحص')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between knoux-card p-4 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)]">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--knoux-subtext)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t('Search duplicates by file name or path...', 'بحث في النتائج عن طريق الاسم أو المسار...')}
              className="knoux-input ps-9 text-xs w-full"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="knoux-select text-xs min-w-[140px]"
          >
            <option value="all">{t('All Categories', 'جميع التصنيفات')}</option>
            <option value="images">{t('Images', 'الصور')}</option>
            <option value="videos">{t('Videos', 'الفيديو')}</option>
            <option value="documents">{t('Documents', 'المستندات')}</option>
            <option value="archives">{t('Archives', 'الملفات المضغوطة')}</option>
            <option value="other">{t('Other', 'ملفات أخرى')}</option>
          </select>
        </div>

        {/* Selected Batch Actions */}
        <div className="flex items-center gap-3">
          <div className="text-end">
            <div className="text-xs font-bold text-[var(--knoux-text)]">
              {selectedCount} {t('Selected for Quarantine', 'محدد للمحجر')}
            </div>
            <div className="text-[11px] text-amber-400 font-mono">
              {formatBytes(selectedBytes)} {t('Reclaimable', 'قابلة للاسترداد')}
            </div>
          </div>

          <button
            onClick={store.quarantineSelectedFiles}
            disabled={selectedCount === 0}
            className="knoux-btn-primary bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold px-5 py-2.5 rounded-lg shadow-lg shadow-amber-500/20 disabled:opacity-40 flex items-center gap-2 text-xs"
          >
            <ShieldAlert className="h-4 w-4" />
            {t('Quarantine Selected', 'نقل المحدد للمحجر الآمن')}
          </button>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {filteredGroups.map((group: any) => (
          <DuplicateGroupCard key={group.groupId} group={group} store={store} />
        ))}
      </div>
    </div>
  );
}
