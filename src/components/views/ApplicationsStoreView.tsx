/**
 * KNOUX ONE — Applications Store & Winget Manager
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { Package, Search, Download, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ApplicationsStoreView: React.FC = () => {
  const { essentialApps, toggleAppInstall, t, language } = useKnoux();
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = essentialApps.filter(a => 
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.wingetId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Package className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 12 • WINGET SOFTWARE MANAGER</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Winget GUI Applications Catalog', 'متجر وإدارة برامج النظام')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Browse, search, and update installed Windows desktop software packages via Winget.',
              'استعراض وتحديث البرامج المثبتة على الكمبيوتر باستخدام المستودع الرسمي Winget.'
            )}
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-purple-400 absolute left-3 rtl:right-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('Search Winget store...', 'ابحث في المتجر...')}
            className="w-full bg-purple-950/40 border border-purple-800/50 rounded-xl pl-9 rtl:pr-9 rtl:pl-3 py-2 text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-[#8226EE]"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(app => (
          <div key={app.id} className="p-4 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-2 relative">
            {app.recommended && (
              <div className="absolute top-0 right-0 rtl:left-0 rtl:right-auto bg-[#8226EE] text-white text-xs font-bold px-2 py-0.5 rounded-bl-lg rtl:rounded-bl-none rtl:rounded-br-lg rounded-tr-lg rtl:rounded-tl-lg">
                RECOMMENDED
              </div>
            )}
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-sm text-white">{app.name}</h3>
                <p className="text-xs text-purple-300 font-mono">{app.wingetId}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 min-h-[32px]">{language === 'ar' ? app.descriptionAr : app.descriptionEn}</p>

            <button
              onClick={() => toggleAppInstall(app.id)}
              className={`w-full mt-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                app.installed
                  ? 'bg-emerald-950/80 border border-emerald-800/60 text-emerald-300'
                  : 'bg-[#8226EE] hover:bg-purple-600 text-white'
              }`}
            >
              {app.installed ? t('Installed / Ready', 'مثبت وجاهز') : t('Install Package', 'تثبيت البرنامج')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
