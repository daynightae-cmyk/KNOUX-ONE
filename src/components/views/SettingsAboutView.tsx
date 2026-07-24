/**
 * KNOUX ONE — Suite Settings & About Information
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS } from '../../data/brandAssets';
import { Settings, Info, Sun, Moon, Globe, Image as ImageIcon, ShieldCheck, Check } from 'lucide-react';

export const SettingsAboutView: React.FC = () => {
  const { theme, setTheme, language, setLanguage, setCurrentRoute, t } = useKnoux();

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Settings Section */}
      <div className="p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4">
        <h2 className="knoux-section-title flex items-center space-x-2.5 rtl:space-x-reverse">
          <Settings className="w-5 h-5 text-[var(--knoux-primary)]" />
          <span>{t('Suite Preferences & Appearance', 'إعدادات البرنامج والمظهر')}</span>
        </h2>

        <div className="space-y-3 text-xs font-mono">
          {/* Theme Switcher */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
            <div>
              <span className="font-bold text-[var(--knoux-text)] block">{t('Interface Theme Mode', 'نمط مظهر الواجهة')}</span>
              <span className="text-[var(--knoux-text-muted)] text-sm">{t('Toggle between Dark and Light glass theme', 'التبديل بين المظهر الداكن والفاتح زجاجي')}</span>
            </div>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="knoux-button-secondary text-xs"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
              <span className="capitalize">{theme} Mode</span>
            </button>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
            <div>
              <span className="font-bold text-[var(--knoux-text)] block">{t('Language Direction (LTR / RTL)', 'لغة الواجهة والاتجاه')}</span>
              <span className="text-[var(--knoux-text-muted)] text-sm">{t('Switch between English and Arabic UI', 'التحويل بين الإنجليزية والعربية')}</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="knoux-button-secondary text-xs"
            >
              <Globe className="w-4 h-4 text-[var(--knoux-primary)]" />
              <span>{language === 'en' ? 'English (LTR)' : 'العربية (RTL)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* About & Branding Section */}
      <div className="p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--knoux-border)] pb-4">
          <div className="flex items-center space-x-3.5 rtl:space-x-reverse">
            <div className="w-12 h-12 rounded-full bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-glass-border-strong)] p-1 flex items-center justify-center overflow-hidden shadow-md shrink-0">
              <img
                src={theme === 'dark' ? OFFICIAL_LOGOS.night.localPath : OFFICIAL_LOGOS.day.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = theme === 'dark' ? OFFICIAL_LOGOS.night.remoteUrl : OFFICIAL_LOGOS.day.remoteUrl; }}
                alt="Knoux One Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <h2 className="knoux-module-title font-black text-[var(--knoux-text)] tracking-tight">
                KNOUX ONE — Windows Intelligence Suite
              </h2>
              <p className="text-xs text-[var(--knoux-primary)] font-mono font-bold">Version 3.0 (Build 2026.07)</p>
            </div>
          </div>

          <button
            onClick={() => setCurrentRoute('brand-gallery')}
            className="knoux-button-primary text-xs self-start sm:self-auto"
          >
            <ImageIcon className="w-4 h-4" />
            <span>{t('View Brand Gallery', 'معرض المراجع البصرية')}</span>
          </button>
        </div>

        <p className="knoux-body leading-relaxed">
          KNOUX ONE is an all-in-one Windows management, optimization, security, and developer suite providing 19 modular subsystems and 190 registered capabilities. Engineered for maximum speed, clean system maintenance, and developer productivity on Windows 11 and Windows 10.
        </p>

        {/* Official Brand Logos Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] space-y-2">
            <span className="text-sm text-[var(--knoux-primary)] font-mono font-bold block">4.1 NIGHT MODE LOGO</span>
            <div className="p-3 rounded-lg bg-[#070A12] border border-[var(--knoux-border)] flex items-center justify-center">
              <img
                src={OFFICIAL_LOGOS.night.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.night.remoteUrl; }}
                alt="Night Logo"
                className="h-10 object-contain"
              />
            </div>
            <p className="text-xs text-[var(--knoux-text-muted)] font-mono">Path: <code className="text-[var(--knoux-primary)]">public/brand/logos/knoux-one-night.png</code></p>
          </div>

          <div className="p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] space-y-2">
            <span className="text-sm text-[var(--knoux-warning)] font-mono font-bold block">4.2 DAY MODE LOGO</span>
            <div className="p-3 rounded-lg bg-[#F5F7FC] border border-[var(--knoux-border)] flex items-center justify-center">
              <img
                src={OFFICIAL_LOGOS.day.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.day.remoteUrl; }}
                alt="Day Logo"
                className="h-10 object-contain"
              />
            </div>
            <p className="text-xs text-[var(--knoux-text-muted)] font-mono">Path: <code className="text-[var(--knoux-primary)]">public/brand/logos/knoux-one-day.png</code></p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-xs font-mono space-y-2">
          <div className="flex justify-between text-[var(--knoux-text-secondary)]">
            <span>Author & Architect:</span>
            <span className="font-bold text-[var(--knoux-primary)]">Eng. Sadek Elgazar (Knoux Founder)</span>
          </div>
          <div className="flex justify-between text-[var(--knoux-text-secondary)]">
            <span>Engine Architecture:</span>
            <span className="text-[var(--knoux-text)]">19 Modules • 190 Capabilities</span>
          </div>
          <div className="flex justify-between text-[var(--knoux-text-secondary)]">
            <span>License:</span>
            <span className="knoux-badge-success">KNOUX Enterprise Suite License</span>
          </div>
        </div>
      </div>
    </div>
  );
};

