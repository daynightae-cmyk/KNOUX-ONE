/**
 * KNOUX ONE — Suite Settings & About Information
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS } from '../../data/brandAssets';
import { Settings, Info, Sun, Moon, Globe, Image as ImageIcon, ArrowRight } from 'lucide-react';

export const SettingsAboutView: React.FC = () => {
  const { theme, setTheme, language, setLanguage, setCurrentRoute, t } = useKnoux();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Settings Section */}
      <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-4">
        <h2 className="text-base font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
          <Settings className="w-5 h-5 text-[#8226EE]" />
          <span>{t('Suite Preferences & Appearance', 'إعدادات البرنامج والمظهر')}</span>
        </h2>

        <div className="space-y-3 text-xs font-mono">
          {/* Theme Switcher */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-900/30">
            <div>
              <span className="font-bold text-white block">{t('Interface Theme', 'مظهر الواجهة')}</span>
              <span className="text-gray-400 text-[10px]">{t('Toggle Dark / Light mode visual styling', 'التبديل بين المظهر الداكن والفاتح')}</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 flex items-center space-x-1.5 rtl:space-x-reverse"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              <span className="capitalize">{theme}</span>
            </button>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-purple-950/30 border border-purple-900/30">
            <div>
              <span className="font-bold text-white block">{t('Language Direction (LTR / RTL)', 'لغة الواجهة والاتجاه')}</span>
              <span className="text-gray-400 text-[10px]">{t('Switch between English and Arabic UI', 'التحويل بين الإنجليزية والعربية')}</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="px-3 py-1.5 rounded-lg bg-purple-900/60 hover:bg-purple-800 text-purple-200 flex items-center space-x-1.5 rtl:space-x-reverse"
            >
              <Globe className="w-4 h-4 text-purple-400" />
              <span>{language === 'en' ? 'English (LTR)' : 'العربية (RTL)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* About & Branding Section */}
      <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-purple-900/30 pb-4">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <img
              src={theme === 'dark' ? OFFICIAL_LOGOS.night.localPath : OFFICIAL_LOGOS.day.localPath}
              onError={(e) => { (e.target as HTMLImageElement).src = theme === 'dark' ? OFFICIAL_LOGOS.night.remoteUrl : OFFICIAL_LOGOS.day.remoteUrl; }}
              alt="Knoux One Logo"
              className="h-12 max-w-[160px] object-contain"
            />
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">
                KNOUX ONE — Windows Intelligence Suite
              </h2>
              <p className="text-xs text-purple-300 font-mono">Version 1.0.0 (Build 2026.07)</p>
            </div>
          </div>

          <button
            onClick={() => setCurrentRoute('brand-gallery')}
            className="px-4 py-2 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white text-xs font-bold font-mono flex items-center space-x-2 rtl:space-x-reverse transition-all self-start sm:self-auto"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t('View Brand Gallery', 'معرض المراجع البصرية')}</span>
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed font-sans">
          KNOUX ONE is an all-in-one Windows management, optimization, security, and developer suite providing 19 modular subsystems and 190 registered capabilities. Designed for maximum speed, clean system maintenance, and developer productivity on Windows 11 and Windows 10.
        </p>

        {/* Official Brand Logos Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 space-y-2">
            <span className="text-[10px] text-purple-300 font-mono font-bold block">4.1 NIGHT MODE LOGO</span>
            <div className="p-3 rounded-lg bg-black/60 flex items-center justify-center">
              <img
                src={OFFICIAL_LOGOS.night.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.night.remoteUrl; }}
                alt="Night Logo"
                className="h-10 object-contain"
              />
            </div>
            <p className="text-[10px] text-gray-400 font-mono">Path: <code className="text-purple-300">public/brand/logos/knoux-one-night.png</code></p>
          </div>

          <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 space-y-2">
            <span className="text-[10px] text-amber-300 font-mono font-bold block">4.2 DAY MODE LOGO</span>
            <div className="p-3 rounded-lg bg-slate-200 flex items-center justify-center">
              <img
                src={OFFICIAL_LOGOS.day.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.day.remoteUrl; }}
                alt="Day Logo"
                className="h-10 object-contain"
              />
            </div>
            <p className="text-[10px] text-gray-400 font-mono">Path: <code className="text-purple-300">public/brand/logos/knoux-one-day.png</code></p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/40 text-xs font-mono space-y-1">
          <div className="flex justify-between text-gray-300">
            <span>Author & Architect:</span>
            <span className="font-bold text-purple-300">Eng. Sadek Elgazar (Knoux)</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Engine Architecture:</span>
            <span className="text-gray-200">19 Modules • 190 Capabilities</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>License:</span>
            <span className="text-emerald-400 font-bold">KNOUX Enterprise Suite License</span>
          </div>
        </div>
      </div>
    </div>
  );
};
