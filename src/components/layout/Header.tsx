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
  Monitor, 
  Command,
  Sparkles,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';

export const Header: React.FC = () => {
  const { 
    theme, 
    setTheme, 
    language, 
    setLanguage, 
    setCurrentRoute,
    runtimeMode, 
    setRuntimeMode, 
    setCommandPaletteOpen,
    runSmartScan,
    isScanning,
    notificationCount,
    clearNotifications,
    systemSpecs,
    t
  } = useKnoux();

  return (
    <header className="h-18 border-b border-[var(--knoux-border)] bg-[var(--knoux-sidebar)] backdrop-blur-2xl px-5 md:px-7 flex items-center justify-between sticky top-0 z-40 select-none transition-all duration-200">
      {/* Left: Branding & Global Search */}
      <div className="flex items-center space-x-4 rtl:space-x-reverse">
        {/* Circular Logo Emblem with Halo */}
        <div 
          onClick={() => setCurrentRoute('brand-gallery')}
          className="flex items-center space-x-3 rtl:space-x-reverse cursor-pointer group"
          title={t('View Official KNOUX Branding & Assets', 'معرض هويّات وسكربتات كنوكس')}
        >
          <div className="relative w-10 h-10 rounded-full bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-glass-border-strong)] p-0.5 flex items-center justify-center overflow-hidden shadow-lg group-hover:scale-105 transition-all duration-300 shrink-0">
            <img
              src={theme === 'dark' ? OFFICIAL_LOGOS.night.localPath : OFFICIAL_LOGOS.day.localPath}
              onError={(e) => { (e.target as HTMLImageElement).src = theme === 'dark' ? OFFICIAL_LOGOS.night.remoteUrl : OFFICIAL_LOGOS.day.remoteUrl; }}
              alt="KNOUX ONE Emblem"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="font-black text-base tracking-tight text-[var(--knoux-text)] font-mono group-hover:text-[var(--knoux-primary)] transition-colors">
                KNOUX <span className="text-[var(--knoux-primary-bright)]">ONE</span>
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md font-mono font-bold bg-[var(--knoux-primary)]/15 text-[var(--knoux-primary)] border border-[var(--knoux-primary)]/30">
                v3.0
              </span>
            </div>
            <p className="text-sm text-[var(--knoux-text-muted)] font-medium hidden sm:block">
              {t('Windows Intelligence & Developer Suite', 'جناح ذكاء ويندوز والتطوير')}
            </p>
          </div>
        </div>

        {/* Device Context Chip */}
        <div className="hidden lg:flex items-center space-x-2 rtl:space-x-reverse pl-4 border-l border-[var(--knoux-border)] text-xs font-mono text-[var(--knoux-text-muted)]">
          <Monitor className="w-4 h-4 text-[var(--knoux-primary)] shrink-0" />
          <span className="font-bold text-[var(--knoux-text)]">{systemSpecs.computerName}</span>
          <span className="knoux-badge-muted">
            {systemSpecs.osEdition}
          </span>
        </div>

        {/* Global Command Search Input (320-480px width) */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden md:flex items-center justify-between w-72 lg:w-96 bg-[var(--knoux-surface-muted)] hover:bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-border)] text-[var(--knoux-text-muted)] px-3.5 py-2 rounded-xl text-xs transition-all duration-200 group shadow-inner"
        >
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Search className="w-4 h-4 text-[var(--knoux-primary)] group-hover:scale-110 transition-transform" />
            <span className="truncate group-hover:text-[var(--knoux-text)]">
              {t('Search 190 tools & services (Ctrl+K)...', 'ابحث في الـ 190 أداة وخدمة (Ctrl+K)...')}
            </span>
          </div>
          <kbd className="hidden lg:inline-flex items-center gap-1 bg-[var(--knoux-surface)] border border-[var(--knoux-border)] px-1.5 py-0.5 rounded text-xs font-mono font-bold text-[var(--knoux-primary)]">
            <Command className="w-3 h-3" /> K
          </kbd>
        </button>
      </div>

      {/* Right Controls & Runtime Badge */}
      <div className="flex items-center space-x-2 sm:space-x-3 rtl:space-x-reverse">
        {/* Quick Smart Scan Trigger */}
        <button
          onClick={runSmartScan}
          disabled={isScanning}
          className="hidden sm:flex items-center space-x-2 rtl:space-x-reverse knoux-button-primary text-xs"
        >
          <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? t('Scanning System...', 'جاري الفحص...') : t('Smart Scan', 'فحص ذكي')}</span>
        </button>

        {/* Runtime Mode Switcher */}
        <div>
          {runtimeMode === 'desktop_elevated' ? (
            <span className="knoux-badge-danger flex items-center space-x-1.5 rtl:space-x-reverse px-3 py-1.5 text-xs">
              <ShieldAlert className="w-4 h-4 animate-pulse" />
              <span className="hidden sm:inline">{t('Admin Elevated', 'مسؤول مرتفع')}</span>
            </span>
          ) : (
            <button
              onClick={() => setRuntimeMode(runtimeMode === 'desktop' ? 'web' : 'desktop')}
              className="knoux-button-secondary text-xs"
              title={t('Toggle Desktop / Web preview runtime', 'تبديل وضع سطح المكتب / الويب')}
            >
              <Monitor className="w-3.5 h-3.5 text-[var(--knoux-primary)]" />
              <span className="hidden sm:inline">{runtimeMode === 'desktop' ? t('Desktop', 'سطح المكتب') : t('Web', 'ويب')}</span>
            </button>
          )}
        </div>

        {/* Language Selector */}
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="w-10 h-10 rounded-xl bg-[var(--knoux-surface-muted)] hover:bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-border)] text-[var(--knoux-text)] font-mono font-bold text-xs flex items-center justify-center transition-all"
          title={t('Switch to Arabic', 'التحويل إلى الإنجليزية')}
        >
          {language === 'en' ? 'ع' : 'EN'}
        </button>

        {/* Theme Selector */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-10 h-10 rounded-xl bg-[var(--knoux-surface-muted)] hover:bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-border)] text-[var(--knoux-text)] flex items-center justify-center transition-all"
          title={t('Toggle Light / Dark Theme', 'تبديل النمط الفاتح والداكن')}
        >
          {theme === 'dark' ? (
            <Sun className="w-4.5 h-4.5 text-amber-400" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-indigo-500" />
          )}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={clearNotifications}
            className="w-10 h-10 rounded-xl bg-[var(--knoux-surface-muted)] hover:bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-border)] text-[var(--knoux-text)] flex items-center justify-center transition-all relative"
            title={t('Notifications', 'الإشعارات')}
          >
            <Bell className="w-4.5 h-4.5 text-[var(--knoux-primary)]" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-[var(--knoux-danger)] text-white text-xs font-bold flex items-center justify-center shadow-md animate-pulse">
                {notificationCount}
              </span>
            )}
          </button>
        </div>

        {/* Profile Card Badge */}
        <div className="hidden xl:flex items-center space-x-2.5 rtl:space-x-reverse pl-3 border-l border-[var(--knoux-border)] text-xs">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--knoux-primary)] to-[var(--knoux-accent-blue)] text-white flex items-center justify-center font-bold text-xs shadow-md">
            SE
          </div>
          <div className="leading-tight text-sm">
            <p className="font-extrabold text-[var(--knoux-text)]">Eng. Sadek Elgazar</p>
            <p className="text-xs text-[var(--knoux-primary)] font-mono">Knoux Founder</p>
          </div>
        </div>
      </div>
    </header>
  );
};

