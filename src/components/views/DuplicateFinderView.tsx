/**
 * KNOUX ONE — Smart Duplicate Finder View
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { 
  Copy, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  Sparkles, 
  FileText, 
  Film, 
  Image, 
  Archive, 
  RotateCcw,
  Sliders,
  Check
} from 'lucide-react';

export const DuplicateFinderView: React.FC = () => {
  const { 
    duplicateGroups, 
    toggleKeepDuplicateItem, 
    quarantineDuplicates, 
    quarantineItems, 
    restoreQuarantineItem, 
    permanentDeleteQuarantineItem, 
    t 
  } = useKnoux();

  const [activeTab, setActiveTab] = useState<'duplicates' | 'quarantine'>('duplicates');
  const [similarityThreshold, setSimilarityThreshold] = useState<number>(90);

  const totalDuplicatesCount = duplicateGroups.reduce((acc, g) => acc + (g.items.length - 1), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--knoux-border)] pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-primary)] text-xs font-mono mb-1">
            <Copy className="w-3.5 h-3.5 text-[var(--knoux-primary)]" />
            <span>MODULE 03 • BLAKE3 HASH DEDUPLICATION ENGINE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--knoux-text)] tracking-tight">
            {t('Smart Duplicate Finder & Quarantine', 'مستكشف الملفات المكررة والحجر الصحي')}
          </h1>
          <p className="text-xs text-[var(--knoux-text-muted)] mt-1">
            {t(
              'Identify exact file duplicates using cryptographic BLAKE3 hashing and similar images. Safely quarantine before deletion.',
              'اكتشاف الملفات المكررة بدقة التشفير BLAKE3، وحجز النسخ في الحجر الصحي لاستعادتها أو مسحها نهائياً.'
            )}
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="flex bg-[var(--knoux-surface-muted)] p-1 rounded-xl border border-[var(--knoux-border)] text-xs font-mono">
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'duplicates'
                  ? 'bg-[var(--knoux-primary)] text-white font-bold shadow-md'
                  : 'text-[var(--knoux-text-muted)] hover:text-[var(--knoux-text)]'
              }`}
            >
              {t(`Duplicates (${totalDuplicatesCount})`, `المكررة (${totalDuplicatesCount})`)}
            </button>
            <button
              onClick={() => setActiveTab('quarantine')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'quarantine'
                  ? 'bg-[var(--knoux-primary)] text-white font-bold shadow-md'
                  : 'text-[var(--knoux-text-muted)] hover:text-[var(--knoux-text)]'
              }`}
            >
              {t(`Quarantine (${quarantineItems.length})`, `الحجر الصحي (${quarantineItems.length})`)}
            </button>
          </div>

          {activeTab === 'duplicates' && duplicateGroups.length > 0 && (
            <button
              onClick={quarantineDuplicates}
              className="knoux-button-primary flex items-center space-x-2 rtl:space-x-reverse"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{t('Quarantine Duplicates', 'نقل المكرر للحجر الصحي')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Duplicates Tab Content */}
      {activeTab === 'duplicates' && (
        <div className="space-y-6">
          {/* Similar image slider control */}
          <div className="p-4 rounded-xl knoux-surface border knoux-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Sliders className="w-4 h-4 text-[var(--knoux-primary)]" />
              <span className="text-xs font-mono text-[var(--knoux-text)]">
                {t('Perceptual Image Similarity Threshold:', 'حساسية مطابقة الصور المشابهة:')}
              </span>
            </div>
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <input
                type="range"
                min="70"
                max="100"
                value={similarityThreshold}
                onChange={e => setSimilarityThreshold(Number(e.target.value))}
                className="w-32 accent-[var(--knoux-primary)]"
              />
              <span className="text-xs font-mono font-bold text-[var(--knoux-primary)] w-10">{similarityThreshold}%</span>
            </div>
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="p-12 text-center rounded-2xl knoux-surface border knoux-border space-y-2">
              <CheckCircle2 className="w-10 h-10 text-[var(--knoux-success)] mx-auto" />
              <h3 className="font-bold text-base text-[var(--knoux-text)]">{t('Zero File Duplicates Found', 'لا توجد ملفات مكررة!')}</h3>
              <p className="text-xs text-[var(--knoux-text-muted)]">{t('Your disk is fully deduplicated. All duplicate files are quarantined.', 'قرصك خالٍ من الملفات المكررة.')}</p>
            </div>
          ) : (
            duplicateGroups.map(group => (
              <div key={group.id} className="p-5 rounded-2xl knoux-card space-y-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-[var(--knoux-border)] pb-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="knoux-badge-primary">
                      BLAKE3: {group.hash.substring(0, 12)}...
                    </span>
                    <span className="text-xs font-extrabold text-[var(--knoux-text)] font-mono">{group.fileSizeFormatted}</span>
                  </div>
                  {group.similarity && (
                    <span className="knoux-badge-warning">
                      {group.similarity}% Visual Match
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  {group.items.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleKeepDuplicateItem(group.id, item.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        item.keep
                          ? 'bg-[var(--knoux-success)]/10 border-[var(--knoux-success)]/40 text-[var(--knoux-text)]'
                          : 'bg-[var(--knoux-surface-muted)] border-[var(--knoux-border)] text-[var(--knoux-text-muted)] hover:border-[var(--knoux-primary)]/40'
                      }`}
                    >
                      <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            item.keep
                              ? 'bg-[var(--knoux-success)] border-[var(--knoux-success)] text-white'
                              : 'bg-[var(--knoux-surface)] border-[var(--knoux-border)] text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0 font-mono text-xs">
                          <span className="truncate block font-semibold text-[var(--knoux-text)]">{item.path}</span>
                          <span className="text-xs text-[var(--knoux-text-muted)]">Modified: {item.modified}</span>
                        </div>
                      </div>

                      <span className="text-xs font-mono px-2 py-0.5 rounded shrink-0">
                        {item.keep ? t('KEEP (Original)', 'احتفاظ (الأصلي)') : t('REMOVE (Duplicate)', 'حذف (مكرر)')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quarantine Tab Content */}
      {activeTab === 'quarantine' && (
        <div className="space-y-4">
          {quarantineItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl knoux-surface border knoux-border space-y-2">
              <ShieldCheck className="w-10 h-10 text-[var(--knoux-primary)] mx-auto" />
              <h3 className="font-bold text-base text-[var(--knoux-text)]">{t('Quarantine Vault is Empty', 'صندوق الحجر الصحي فارغ')}</h3>
              <p className="text-xs text-[var(--knoux-text-muted)]">{t('No quarantined files currently held.', 'لا توجد ملفات محجوزة حالياً.')}</p>
            </div>
          ) : (
            quarantineItems.map(item => (
              <div key={item.id} className="p-4 rounded-xl knoux-card flex items-center justify-between text-xs font-mono">
                <div>
                  <h4 className="font-bold text-[var(--knoux-text)]">{item.filename}</h4>
                  <p className="text-[var(--knoux-primary)] text-sm mt-0.5">Original: {item.originalPath}</p>
                  <p className="text-[var(--knoux-text-muted)] text-xs">{item.sizeFormatted} • Quarantined at {item.quarantinedAt}</p>
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <button
                    onClick={() => restoreQuarantineItem(item.id)}
                    className="knoux-button-secondary text-xs flex items-center space-x-1 rtl:space-x-reverse"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('Restore', 'استعادة')}</span>
                  </button>
                  <button
                    onClick={() => permanentDeleteQuarantineItem(item.id)}
                    className="px-3 py-1.5 rounded-xl bg-[var(--knoux-danger)]/10 text-[var(--knoux-danger)] border border-[var(--knoux-danger)]/30 text-xs font-bold flex items-center space-x-1 rtl:space-x-reverse hover:bg-[var(--knoux-danger)] hover:text-white transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('Delete Permanently', 'حذف نهائي')}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
