/**
 * KNOUX ONE — Command Palette (Ctrl+K)
 */

import React, { useState, useEffect } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { KnouxCapability } from '../../types';
import { Search, Terminal, Play, ShieldAlert, ArrowRight, X, Command } from 'lucide-react';

export const CommandPalette: React.FC = () => {
  const { 
    commandPaletteOpen, 
    setCommandPaletteOpen, 
    setCurrentRoute, 
    addLog, 
    requestElevation, 
    language, 
    t 
  } = useKnoux();

  const [query, setQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedCap, setSelectedCap] = useState<KnouxCapability | null>(null);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedCap(null);
    }
  }, [commandPaletteOpen]);

  if (!commandPaletteOpen) return null;

  const filteredCapabilities = ALL_CAPABILITIES.filter(cap => {
    const matchesModule = selectedModule === 'all' || cap.moduleId === selectedModule;
    const q = query.toLowerCase().trim();
    if (!q) return matchesModule;
    
    return matchesModule && (
      cap.nameEn.toLowerCase().includes(q) ||
      cap.nameAr.toLowerCase().includes(q) ||
      cap.descriptionEn.toLowerCase().includes(q) ||
      cap.id.toLowerCase().includes(q) ||
      (cap.psCommand && cap.psCommand.toLowerCase().includes(q))
    );
  }).slice(0, 30); // Top 30 matches for snappy performance

  const executeCapability = (cap: KnouxCapability) => {
    if (cap.requiresAdmin) {
      requestElevation(
        cap.nameEn,
        cap.nameAr,
        `Execution of ${cap.nameEn} requires administrative privileges on Windows.`,
        `تتطلب أداة ${cap.nameAr} صلاحيات المسؤول للتنفيذ على ويندوز.`,
        cap.riskLevel,
        () => {
          addLog(cap.id, cap.nameEn, 'completed', `Successfully executed ${cap.nameEn} via Command Palette.`);
          setCommandPaletteOpen(false);
        }
      );
    } else {
      addLog(cap.id, cap.nameEn, 'completed', `Successfully executed ${cap.nameEn} via Command Palette.`);
      setCommandPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-3xl bg-[#0E062B] border border-purple-800/50 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-purple-900/40 flex items-center space-x-3 rtl:space-x-reverse bg-purple-950/30">
          <Search className="w-5 h-5 text-purple-400 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('Search 190 capabilities, commands, modules...', 'ابحث في 190 أداة وسكربت وموديول...')}
            className="w-full bg-transparent text-gray-100 placeholder-purple-400/60 focus:outline-none text-sm font-sans"
          />
          <button
            onClick={() => setCommandPaletteOpen(false)}
            className="p-1 rounded-lg hover:bg-purple-900/40 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Module Filter Pills */}
        <div className="px-4 py-2 border-b border-purple-900/30 bg-[#0A0322] flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setSelectedModule('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium whitespace-nowrap transition-colors ${
              selectedModule === 'all'
                ? 'bg-[#8226EE] text-white font-bold'
                : 'bg-purple-950/40 text-purple-300 hover:bg-purple-900/40'
            }`}
          >
            {t('All 19 Modules', 'جميع الـ 19 موديل')}
          </button>
          {MODULES_CATALOG.map(mod => (
            <button
              key={mod.id}
              onClick={() => setSelectedModule(mod.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono whitespace-nowrap transition-colors ${
                selectedModule === mod.id
                  ? 'bg-[#8226EE] text-white font-bold'
                  : 'bg-purple-950/40 text-purple-300 hover:bg-purple-900/40'
              }`}
            >
              {mod.id.toUpperCase()}: {t(mod.titleEn, mod.titleAr)}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
          {filteredCapabilities.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-sans">
              <p className="text-sm">{t('No capabilities found matching query.', 'لم يتم العثور على أداة مطابقة.')}</p>
              <p className="text-xs text-purple-400/70 mt-1">
                {t('Try searching for "SFC", "Registry", "DNS", "RAM", "Winget", "PowerShell"', 'جرب البحث عن "SFC" أو "Registry" أو "RAM" أو "Winget"')}
              </p>
            </div>
          ) : (
            filteredCapabilities.map(cap => (
              <div
                key={cap.id}
                onClick={() => setSelectedCap(cap)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  selectedCap?.id === cap.id
                    ? 'bg-purple-900/40 border-purple-500 text-white'
                    : 'bg-purple-950/20 border-purple-900/30 hover:bg-purple-900/30 text-gray-200'
                }`}
              >
                <div className="flex items-start space-x-3 rtl:space-x-reverse min-w-0 pr-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-purple-300 font-mono text-xs font-bold shrink-0">
                    {cap.id.split('_')[1]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <span className="font-semibold text-xs text-white truncate">
                        {t(cap.nameEn, cap.nameAr)}
                      </span>
                      {cap.requiresAdmin && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/50 font-mono font-bold">
                          ADMIN
                        </span>
                      )}
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/40 font-mono">
                        {cap.moduleId.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-1 mt-0.5">
                      {t(cap.descriptionEn, cap.descriptionAr)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 rtl:space-x-reverse shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeCapability(cap);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#8226EE] hover:bg-purple-600 text-white text-xs font-medium flex items-center space-x-1 rtl:space-x-reverse shadow transition-all active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{t('Run', 'تشغيل')}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer command tips */}
        <div className="px-4 py-2.5 border-t border-purple-900/40 bg-[#070216] flex items-center justify-between text-[11px] text-gray-400 font-mono">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <span>
              Showing <strong className="text-purple-300">{filteredCapabilities.length}</strong> of {ALL_CAPABILITIES.length} items
            </span>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse text-purple-400">
            <kbd className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-[10px]">Esc</kbd>
            <span>{t('to close', 'للاغلاق')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
