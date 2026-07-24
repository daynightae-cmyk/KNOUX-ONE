/**
 * KNOUX ONE — All 190 Capabilities Searchable Grid
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG, ALL_CAPABILITIES } from '../../data/capabilitiesCatalog';
import { CapabilityCard } from '../common/CapabilityCard';
import { Grid, Search, Filter, Layers } from 'lucide-react';

export const CapabilitiesCatalogView: React.FC = () => {
  const { t } = useKnoux();

  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filtered = ALL_CAPABILITIES.filter(cap => {
    const matchesModule = selectedModule === 'all' || cap.moduleId === selectedModule;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesModule;
    return matchesModule && (
      cap.nameEn.toLowerCase().includes(q) ||
      cap.nameAr.toLowerCase().includes(q) ||
      cap.descriptionEn.toLowerCase().includes(q) ||
      cap.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--knoux-border)] pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-primary)] text-xs font-mono mb-1">
            <Grid className="w-3.5 h-3.5 text-[var(--knoux-primary)]" />
            <span>FULL CATALOG • 19 MODULES • 190 SERVICES</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--knoux-text)] tracking-tight">
            {t('All 190 Capabilities Catalog Grid', 'دليل كافة الـ 190 وظيفة للبرنامج')}
          </h1>
          <p className="text-xs text-[var(--knoux-text-muted)] mt-1">
            {t(
              'Complete master directory of all registered Windows intelligence capabilities.',
              'الدليل الكامل والشامل لجميع أدوات وسكربتات KNOUX ONE البالغ عددها 190 وظيفة.'
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--knoux-text-muted)] absolute left-3 rtl:right-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('Filter 190 tools...', 'تصفية الـ 190 أداة...')}
            className="w-full knoux-input pl-9 rtl:pr-9 rtl:pl-3"
          />
        </div>
      </div>

      {/* Module Filter Pills */}
      <div className="flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto custom-scrollbar pb-2">
        <button
          onClick={() => setSelectedModule('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
            selectedModule === 'all'
              ? 'bg-[var(--knoux-primary)] text-white font-bold shadow-md shadow-[var(--knoux-primary)]/20'
              : 'bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)] border border-[var(--knoux-border)] hover:bg-[var(--knoux-border)]/50'
          }`}
        >
          {t('All 190 Tools', 'جميع الـ 190 أداة')}
        </button>

        {MODULES_CATALOG.map(mod => (
          <button
            key={mod.id}
            onClick={() => setSelectedModule(mod.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono whitespace-nowrap transition-all ${
              selectedModule === mod.id
                ? 'bg-[var(--knoux-primary)] text-white font-bold shadow-md shadow-[var(--knoux-primary)]/20'
                : 'bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)] border border-[var(--knoux-border)] hover:bg-[var(--knoux-border)]/50'
            }`}
          >
            {mod.id.toUpperCase()}: {t(mod.titleEn, mod.titleAr)}
          </button>
        ))}
      </div>

      {/* Count Header */}
      <div className="text-xs font-mono text-[var(--knoux-text-muted)]">
        Showing <strong className="text-[var(--knoux-text)]">{filtered.length}</strong> of {ALL_CAPABILITIES.length} tools
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(cap => (
          <CapabilityCard key={cap.id} capability={cap} />
        ))}
      </div>
    </div>
  );
};
