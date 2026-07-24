/**
 * KNOUX ONE — Application Header / Titlebar Component
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS } from '../../data/brandAssets';
import { 
  ShieldCheck, 
  Search, 
  Globe, 
  Sun, 
  Moon, 
  Bell, 
  Terminal, 
  Monitor, 
  AlertTriangle,
  Command,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    theme, 
    setTheme, 
    language, 
    setLanguage, 
    currentRoute,
    setCurrentRoute,
    runtimeMode, 
    setRuntimeMode, 
    setCommandPaletteOpen,
    runSmartScan,
    isScanning,
    notificationCount,
    clearNotifications,
    t
  } = useKnoux();

  return (
    <header className="h-16 border-b border-purple-950/40 bg-[#0D0527]/90 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Search trigger & Title branding */}
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <div 
          onClick={() => setCurrentRoute('brand-gallery')}
          className="flex items-center space-x-2 rtl:space-x-reverse cursor-pointer group"
          title={t('View Official Branding & Gallery', 'معرض المراجع البصرية والهوية الرسمية')}
        >
          <img
            src={theme === 'dark' ? OFFICIAL_LOGOS.night.localPath : OFFICIAL_LOGOS.day.localPath}
            onError={(e) => { (e.target as HTMLImageElement).src = theme === 'dark' ? OFFICIAL_LOGOS.night.remoteUrl : OFFICIAL_LOGOS.day.remoteUrl; }}
            alt="KNOUX ONE Logo"
            className="h-8 max-w-[120px] object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="font-extrabold text-sm tracking-tight text-white font-mono group-hover:text-purple-300 transition-colors">
                KNOUX <span className="text-[#8226EE]">ONE</span>
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-purple-900/40 text-purple-300 border border-purple-800/50">
                v1.0.0
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-sans hidden sm:block">
              {t('Windows Intelligence & Developer Suite', 'جناح ذكاء ويندوز والتطوير')}
            </p>
          </div>
        </div>

        {/* Global Command Palette Trigger */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center space-x-2 rtl:space-x-reverse bg-purple-950/30 hover:bg-purple-900/40 border border-purple-900/50 hover:border-purple-600/50 text-gray-300 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 group"
        >
          <Search className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
          <span className="text-gray-400 group-hover:text-gray-200">
            {t('Search 190 capabilities & tools...', 'ابحث في 190 أداة ووظيفة...')}
          </span>
          <kbd className="hidden lg:inline-flex items-center gap-1 bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.5 rounded text-[10px] font-mono text-purple-300">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right Controls & Runtime Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3 rtl:space-x-reverse">
        {/* Quick Smart Scan trigger */}
        <button
          onClick={runSmartScan}
          disabled={isScanning}
          className="hidden sm:flex items-center space-x-1.5 rtl:space-x-reverse bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-md shadow-purple-900/30 transition-all duration-200 active:scale-95 disabled:opacity-50"
        >
          <Sparkles className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? t('Scanning...', 'جاري الفحص...') : t('Smart Scan', 'فحص ذكي')}</span>
        </button>

        {/* Runtime Mode Badge */}
        <div className="flex items-center">
          {runtimeMode === 'desktop_elevated' ? (
            <span className="flex items-center space-x-1 rtl:space-x-reverse bg-red-950/60 border border-red-800/60 text-red-300 px-2 py-1 rounded-md text-[11px] font-mono shadow-sm">
              <ShieldCheck className="w-3 h-3 text-red-400 animate-pulse" />
              <span className="hidden sm:inline">{t('Elevated (Admin)', 'وضع المسؤول (Admin)')}</span>
            </span>
          ) : (
            <button
              onClick={() => setRuntimeMode(runtimeMode === 'desktop' ? 'web' : 'desktop')}
              className="flex items-center space-x-1 rtl:space-x-reverse bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-300 px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors"
              title={t('Toggle Desktop / Web preview runtime', 'تبديل وضع سطح المكتب / الويب')}
            >
              {runtimeMode === 'desktop' ? (
                <>
                  <Monitor className="w-3 h-3 text-purple-400" />
                  <span className="hidden sm:inline">{t('Desktop Mode', 'وضع سطح المكتب')}</span>
                </>
              ) : (
                <>
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span className="hidden sm:inline">{t('Web Mode', 'وضع الويب')}</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Language Selector */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-200 text-xs font-mono transition-colors flex items-center space-x-1 rtl:space-x-reverse"
          title={t('Switch to Arabic', 'التحويل إلى الإنجليزية')}
        >
          <Globe className="w-3.5 h-3.5 text-purple-400" />
          <span className="font-bold">{language === 'en' ? 'عربي' : 'EN'}</span>
        </button>

        {/* Theme Selector */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-200 transition-colors"
          title={t('Toggle Theme', 'تبديل المظهر')}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={clearNotifications}
            className="p-1.5 rounded-lg bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 text-purple-200 transition-colors relative"
            title={t('Notifications', 'الإشعارات')}
          >
            <Bell className="w-4 h-4 text-purple-300" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-bounce">
                {notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
