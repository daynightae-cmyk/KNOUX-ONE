/**
 * KNOUX ONE — Official Web Landing Page View
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS, VISUAL_GALLERY_ASSETS } from '../../data/brandAssets';
import { 
  Sparkles, 
  ShieldCheck, 
  Download, 
  Cpu, 
  Terminal, 
  ArrowRight, 
  Image as ImageIcon,
  ExternalLink
} from 'lucide-react';

export const WebLandingView: React.FC = () => {
  const { setCurrentRoute, t } = useKnoux();

  return (
    <div className="min-h-screen bg-[#070216] text-white p-6 space-y-12 max-w-6xl mx-auto">
      {/* Hero Header with Official Night Logo */}
      <div className="text-center space-y-6 pt-6">
        <div className="flex justify-center">
          <img
            src={OFFICIAL_LOGOS.night.localPath}
            onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.night.remoteUrl; }}
            alt="KNOUX ONE Official Night Logo"
            className="h-20 max-w-xs object-contain drop-shadow-[0_10px_20px_rgba(130,38,238,0.4)]"
          />
        </div>

        <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#8226EE]" />
          <span>KNOUX ONE — WINDOWS INTELLIGENCE SUITE</span>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight">
          Build • Protect • Optimize <br />
          <span className="text-[#8226EE]">Windows Developer Power</span>
        </h1>

        <p className="text-sm md:text-base text-gray-300 max-w-2xl mx-auto">
          Crafted by Eng. Sadek Elgazar (Knoux). 19 modules and 190 registered capabilities in one unified, lightweight desktop and web suite.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => setCurrentRoute('dashboard')}
            className="px-6 py-3 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-sm shadow-xl shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
          >
            <span>{t('Launch App Dashboard', 'افتح اللوحة الرئيسية')}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button
            onClick={() => setCurrentRoute('brand-gallery')}
            className="px-6 py-3 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 font-bold text-sm flex items-center space-x-2 rtl:space-x-reverse transition-colors"
          >
            <ImageIcon className="w-4 h-4 text-purple-400" />
            <span>{t('View 19 Visual References', 'معرض المراجع البصرية 19')}</span>
          </button>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert('KNOUX ONE v1.0.0 Setup Executable (KNOUX-ONE-Setup.exe) ready for download.'); }}
            className="px-6 py-3 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 font-bold text-sm flex items-center space-x-2 rtl:space-x-reverse transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>{t('Download .EXE Setup (52 MB)', 'تحميل برنامج التثبيت .exe')}</span>
          </a>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-2">
          <Download className="w-8 h-8 text-[#8226EE]" />
          <h3 className="font-bold text-base text-white">{t('Post-Format Installer', 'حزمة ما بعد الفورمات')}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            One-click Winget package installer for developer software, tools, and runtimes without command-line hassle.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-2">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <h3 className="font-bold text-base text-white">{t('BLAKE3 Deduplication', 'مطابقة التشفير الذكية')}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Blazing fast BLAKE3 cryptographic hash matching and similar image detection with zero-risk quarantine.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-2">
          <Terminal className="w-8 h-8 text-cyan-400" />
          <h3 className="font-bold text-base text-white">{t('190 PowerShell Tools', '190 أداة باورشيل')}</h3>
          <p className="text-xs text-gray-300 leading-relaxed">
            Full control over SFC, DISM, Registry, Network stacks, local port auditing, and Windows 11 telemetry block.
          </p>
        </div>
      </div>

      {/* Official Visual Reference Gallery Showcase */}
      <div className="p-6 rounded-3xl bg-purple-950/20 border border-purple-900/50 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-purple-400 font-mono block mb-1">SECTION 4.3 • VISUAL REFERENCES</span>
            <h2 className="text-xl font-extrabold text-white">
              {t('Official UI Visual Gallery (19 References)', 'معرض الواجهات والمراجع البصرية الـ 19')}
            </h2>
            <p className="text-xs text-gray-300 mt-1">
              Explore official design screenshots and module architecture breakdowns across KNOUX ONE.
            </p>
          </div>
          <button
            onClick={() => setCurrentRoute('brand-gallery')}
            className="px-4 py-2 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs flex items-center space-x-2 rtl:space-x-reverse transition-colors self-start md:self-auto"
          >
            <span>{t('Explore Full Gallery Modal', 'فتح المعرض التفاعلي الكامل')}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        {/* 6 Featured Image Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {VISUAL_GALLERY_ASSETS.slice(0, 6).map(asset => (
            <div
              key={asset.id}
              onClick={() => setCurrentRoute('brand-gallery')}
              className="p-3 rounded-2xl bg-purple-950/40 border border-purple-900/40 hover:border-[#8226EE] transition-all cursor-pointer group space-y-2"
            >
              <div className="rounded-xl overflow-hidden aspect-video bg-black/40 border border-purple-900/30">
                <img
                  src={asset.localPath}
                  onError={(e) => { (e.target as HTMLImageElement).src = asset.remoteUrl; }}
                  alt={asset.titleEn}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#8226EE] font-mono font-bold block">{asset.id.toUpperCase()} • {t(asset.moduleNameEn, asset.moduleNameAr)}</span>
                <h4 className="text-xs font-bold text-white truncate">{t(asset.titleEn, asset.titleAr)}</h4>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
