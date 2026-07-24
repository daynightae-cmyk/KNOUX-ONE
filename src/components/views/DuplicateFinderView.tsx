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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Copy className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 03 • BLAKE3 HASH DEDUPLICATION ENGINE</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Smart Duplicate Finder & Quarantine', 'مستكشف الملفات المكررة والحجر الصحي')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Identify exact file duplicates using cryptographic BLAKE3 hashing and similar images. Safely quarantine before deletion.',
              'اكتشاف الملفات المكررة بدقة التشفير BLAKE3، وحجز النسخ في الحجر الصحي لاستعادتها أو مسحها نهائياً.'
            )}
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <div className="flex bg-purple-950/60 p-1 rounded-xl border border-purple-800/40 text-xs font-mono">
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'duplicates'
                  ? 'bg-[#8226EE] text-white font-bold'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              {t(`Duplicates (${totalDuplicatesCount})`, `المكررة (${totalDuplicatesCount})`)}
            </button>
            <button
              onClick={() => setActiveTab('quarantine')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'quarantine'
                  ? 'bg-[#8226EE] text-white font-bold'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              {t(`Quarantine (${quarantineItems.length})`, `الحجر الصحي (${quarantineItems.length})`)}
            </button>
          </div>

          {activeTab === 'duplicates' && duplicateGroups.length > 0 && (
            <button
              onClick={quarantineDuplicates}
              className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
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
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <Sliders className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-mono text-gray-200">
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
                className="w-32 accent-[#8226EE]"
              />
              <span className="text-xs font-mono font-bold text-purple-300 w-10">{similarityThreshold}%</span>
            </div>
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-purple-950/20 border border-purple-900/40 text-gray-300 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <h3 className="font-bold text-base text-white">{t('Zero File Duplicates Found', 'لا توجد ملفات مكررة!')}</h3>
              <p className="text-xs text-gray-400">{t('Your disk is fully deduplicated. All duplicate files are quarantined.', 'قرصك خالٍ من الملفات المكررة.')}</p>
            </div>
          ) : (
            duplicateGroups.map(group => (
              <div key={group.id} className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
                <div className="flex items-center justify-between border-b border-purple-900/30 pb-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="text-xs font-mono text-purple-300 bg-purple-900/60 px-2 py-0.5 rounded border border-purple-800/40">
                      BLAKE3: {group.hash.substring(0, 12)}...
                    </span>
                    <span className="text-xs font-extrabold text-white font-mono">{group.fileSizeFormatted}</span>
                  </div>
                  {group.similarity && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/50 font-mono font-bold">
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
                          ? 'bg-emerald-950/30 border-emerald-800/50 text-white'
                          : 'bg-purple-950/40 border-purple-900/30 opacity-70 text-gray-300 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center space-x-3 rtl:space-x-reverse min-w-0">
                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            item.keep
                              ? 'bg-emerald-600 border-emerald-500 text-white'
                              : 'bg-purple-950 border-purple-800 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="min-w-0 font-mono text-xs">
                          <span className="truncate block font-semibold">{item.path}</span>
                          <span className="text-[10px] text-gray-400">Modified: {item.modified}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0">
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
            <div className="p-12 text-center rounded-2xl bg-purple-950/20 border border-purple-900/40 text-gray-300 space-y-2">
              <ShieldCheck className="w-10 h-10 text-purple-400 mx-auto" />
              <h3 className="font-bold text-base text-white">{t('Quarantine Vault is Empty', 'صندوق الحجر الصحي فارغ')}</h3>
              <p className="text-xs text-gray-400">{t('No quarantined files currently held.', 'لا توجد ملفات محجوزة حالياً.')}</p>
            </div>
          ) : (
            quarantineItems.map(item => (
              <div key={item.id} className="p-4 rounded-xl bg-purple-950/30 border border-purple-900/40 flex items-center justify-between text-xs font-mono">
                <div>
                  <h4 className="font-bold text-white">{item.filename}</h4>
                  <p className="text-purple-300 text-[11px] mt-0.5">Original: {item.originalPath}</p>
                  <p className="text-gray-400 text-[10px]">{item.sizeFormatted} • Quarantined at {item.quarantinedAt}</p>
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <button
                    onClick={() => restoreQuarantineItem(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 text-xs flex items-center space-x-1 rtl:space-x-reverse transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('Restore', 'استعادة')}</span>
                  </button>
                  <button
                    onClick={() => permanentDeleteQuarantineItem(item.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-800/60 text-red-200 text-xs flex items-center space-x-1 rtl:space-x-reverse transition-colors"
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
