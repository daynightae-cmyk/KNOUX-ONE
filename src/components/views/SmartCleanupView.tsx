/**
 * KNOUX ONE — Smart Storage Cleanup View
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { 
  Trash2, 
  ShieldCheck, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  HardDrive, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw 
} from 'lucide-react';

export const SmartCleanupView: React.FC = () => {
  const { 
    cleanupCategories, 
    toggleCategorySelect, 
    executeCleanup, 
    isScanning, 
    scanProgress, 
    t 
  } = useKnoux();

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const selectedCategories = cleanupCategories.filter(c => c.selected);
  let totalBytesToClean = 0;
  selectedCategories.forEach(c => { totalBytesToClean += c.sizeBytes; });

  const formattedTotalGB = (totalBytesToClean / (1024 * 1024 * 1024)).toFixed(2);
  const formattedTotalMB = (totalBytesToClean / (1024 * 1024)).toFixed(1);
  const displayTotal = totalBytesToClean > 1024 * 1024 * 1024 ? `${formattedTotalGB} GB` : `${formattedTotalMB} MB`;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Trash2 className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 02 • SMART STORAGE CLEANUP</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Smart Storage & Cache Cleanup', 'مستكشف ومُنظف الذاكرة الذكي')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Safely reclaim GBs of disk space by purging temporary files, browser cache, system crash dumps, and obsolete logs.',
              'استرجاع مساحات الأقراص بأمان عبر إزالة ملفات النظام المؤقتة ومخبئيات المتصفحات وسجلات الأخطاء.'
            )}
          </p>
        </div>

        {/* Action Reclaim Box */}
        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex items-center space-x-4 rtl:space-x-reverse shrink-0">
          <div>
            <span className="text-xs font-mono text-gray-400 block uppercase">
              {t('Selected Space Reclaimable:', 'المساحة القابلة للاسترجاع:')}
            </span>
            <span className="text-2xl font-extrabold text-[#8226EE] font-mono">{displayTotal}</span>
          </div>

          <button
            onClick={executeCleanup}
            disabled={totalBytesToClean === 0 || isScanning}
            className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? t('Cleaning Storage...', 'جاري التنفيذ...') : t('Clean Selected Now', 'تنظيف المحدد الآن')}</span>
          </button>
        </div>
      </div>

      {/* Progress Bar during execution */}
      {isScanning && (
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-2 animate-in fade-in">
          <div className="flex justify-between text-xs font-mono text-purple-200">
            <span>{t('Purging temporary disk files safely...', 'جاري تفريغ ملفات القرص المؤقتة...')}</span>
            <span>{scanProgress}%</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 overflow-hidden">
            <div className="bg-[#8226EE] h-2 rounded-full transition-all duration-200" style={{ width: `${scanProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Categories Checklist Grid */}
      <div className="space-y-3">
        {cleanupCategories.map(cat => (
          <div
            key={cat.id}
            className={`p-4 rounded-2xl border transition-all ${
              cat.selected
                ? 'bg-purple-950/30 border-purple-800/60'
                : 'bg-purple-950/10 border-purple-950 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div
                onClick={() => toggleCategorySelect(cat.id)}
                className="flex items-center space-x-3 rtl:space-x-reverse cursor-pointer min-w-0"
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                    cat.selected
                      ? 'bg-[#8226EE] border-[#8226EE] text-white'
                      : 'bg-purple-950 border-purple-800/60 text-transparent'
                  }`}
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <h3 className="font-bold text-sm text-white">
                      {t(cat.nameEn, cat.nameAr)}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono font-bold">
                      {cat.riskLevel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {t(cat.descriptionEn, cat.descriptionAr)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 rtl:space-x-reverse shrink-0">
                <div className="text-right font-mono">
                  <span className="text-sm font-extrabold text-white block">{cat.sizeFormatted}</span>
                  <span className="text-xs text-gray-400">{cat.fileCount} {t('files', 'ملف')}</span>
                </div>

                {cat.items && cat.items.length > 0 && (
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                    className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 transition-colors"
                  >
                    {expandedCategory === cat.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded Item Details */}
            {expandedCategory === cat.id && cat.items && cat.items.length > 0 && (
              <div className="mt-3 pt-3 border-t border-purple-900/30 space-y-1.5 font-mono text-sm">
                <span className="text-gray-400 block mb-1">{t('Sample scanned files:', 'عينات الملفات المكتشفة:')}</span>
                {cat.items.map((item, idx) => (
                  <div key={idx} className="p-2 rounded bg-[#060114] border border-purple-950 flex justify-between text-purple-200">
                    <span className="truncate max-w-[80%] text-emerald-400">{item.path}</span>
                    <span>{item.sizeFormatted}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
