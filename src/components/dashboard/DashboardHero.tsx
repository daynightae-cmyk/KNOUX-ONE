/**
 * KNOUX ONE — Dashboard Hero Component
 * Reference: AiDEA node 17245:92328
 * SleekSphere Atmospheric Lighting
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS } from '../../data/brandAssets';
import { Monitor, Sparkles, ShieldCheck, Cpu, HardDrive, Play, ArrowRight, Zap } from 'lucide-react';

export const DashboardHero: React.FC = () => {
  const { 
    systemSpecs, 
    setCurrentRoute, 
    runSmartScan, 
    isScanning, 
    theme, 
    t 
  } = useKnoux();

  return (
    <div className="p-6 md:p-8 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border-strong)] relative overflow-hidden shadow-2xl transition-all duration-300">
      {/* SleekSphere atmospheric background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--knoux-primary)]/12 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-[var(--knoux-accent-blue)]/8 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
        <div className="flex items-start space-x-5 rtl:space-x-reverse">
          {/* Circular KNOUX Logo Emblem with Halo Effect */}
          <div className="w-18 h-18 rounded-full bg-[var(--knoux-surface-elevated)] border-2 border-[var(--knoux-primary)]/50 p-1 flex items-center justify-center shrink-0 shadow-xl shadow-[var(--knoux-primary)]/20 relative group">
            <img
              src={theme === 'dark' ? OFFICIAL_LOGOS.night.localPath : OFFICIAL_LOGOS.day.localPath}
              onError={(e) => { (e.target as HTMLImageElement).src = theme === 'dark' ? OFFICIAL_LOGOS.night.remoteUrl : OFFICIAL_LOGOS.day.remoteUrl; }}
              alt="KNOUX ONE"
              className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
            />
          </div>

          <div className="space-y-2">
            {/* Fact Badges */}
            <div className="flex items-center space-x-2 rtl:space-x-reverse flex-wrap gap-y-1.5">
              <span className="knoux-badge-primary">
                BUILD • PROTECT • OPTIMIZE
              </span>
              <span className="text-xs text-[var(--knoux-text-muted)] font-mono flex items-center gap-1.5 bg-[var(--knoux-surface-muted)] px-2.5 py-0.5 rounded-lg border border-[var(--knoux-border)]">
                <Monitor className="w-3.5 h-3.5 text-[var(--knoux-accent-blue)]" />
                {systemSpecs.computerName}
              </span>
              <span className="text-xs text-[var(--knoux-text-muted)] font-mono bg-[var(--knoux-surface-muted)] px-2.5 py-0.5 rounded-lg border border-[var(--knoux-border)]">
                {systemSpecs.osEdition} ({systemSpecs.osBuild})
              </span>
            </div>

            {/* Title */}
            <h1 className="knoux-hero-title">
              {t('Welcome back, Eng. Sadek', 'مرحبًا بك يا مهندس صادق')}
            </h1>
            
            {/* Description */}
            <p className="knoux-body max-w-2xl">
              {t(
                'KNOUX ONE is ready to inspect, configure and maintain this Windows device safely with 19 modules and 190 registered capabilities.',
                'كنوكس ون جاهز لفحص جهاز ويندوز وإعداده وصيانته بأمان عبر 19 قسمًا و 190 أداة مسجلة.'
              )}
            </p>

            {/* Quick Fact Pills */}
            <div className="pt-1 flex items-center space-x-5 rtl:space-x-reverse text-xs font-mono text-[var(--knoux-text-muted)] flex-wrap gap-y-1">
              <span className="flex items-center space-x-1.5 rtl:space-x-reverse">
                <Cpu className="w-4 h-4 text-[var(--knoux-primary)]" />
                <span>{systemSpecs.cpuCores} Threads</span>
              </span>
              <span className="flex items-center space-x-1.5 rtl:space-x-reverse">
                <HardDrive className="w-4 h-4 text-[var(--knoux-warning)]" />
                <span>{systemSpecs.totalRamGB} GB RAM</span>
              </span>
              <span className="flex items-center space-x-1.5 rtl:space-x-reverse">
                <ShieldCheck className="w-4 h-4 text-[var(--knoux-success)]" />
                <span>UAC Elevated</span>
              </span>
            </div>
          </div>
        </div>

        {/* Hero Action Buttons */}
        <div className="flex items-center space-x-3 rtl:space-x-reverse shrink-0 w-full lg:w-auto flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setCurrentRoute('first-run')}
            className="flex-1 sm:flex-initial knoux-button-secondary text-xs"
          >
            {t('First Run Setup', 'معالج البداية')}
          </button>
          <button
            onClick={() => setCurrentRoute('post-format')}
            className="flex-1 sm:flex-initial knoux-button-secondary text-xs"
          >
            {t('Post-Format Setup', 'إعداد ما بعد الفورمات')}
          </button>
          <button
            onClick={runSmartScan}
            disabled={isScanning}
            className="flex-1 sm:flex-initial knoux-button-primary text-xs disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? t('Scanning...', 'جاري الفحص...') : t('Run Device Discovery', 'فحص الجهاز')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

