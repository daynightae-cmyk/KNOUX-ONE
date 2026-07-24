/**
 * KNOUX ONE — Responsive Status Cards Grid (5 Primary Cards)
 * Includes skeleton loading states and semantic colors for status communication
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { CheckCircle2, Cpu, HardDrive, ShieldCheck, Package, AlertCircle } from 'lucide-react';

interface StatusCardsGridProps {
  isLoading?: boolean;
}

export const StatusCardsGrid: React.FC<StatusCardsGridProps> = ({ isLoading = false }) => {
  const { systemSpecs, runtimeMode, isScanning, t } = useKnoux();
  const loading = isLoading || isScanning;

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div 
            key={idx} 
            className="p-4.5 rounded-xl knoux-surface border knoux-border animate-pulse space-y-3 flex flex-col justify-between h-36"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[var(--knoux-surface-muted)] rounded"></div>
              <div className="h-4 w-4 bg-[var(--knoux-surface-muted)] rounded-full"></div>
            </div>
            <div className="space-y-2">
              <div className="h-6 w-28 bg-[var(--knoux-surface-muted)] rounded"></div>
              <div className="h-2.5 w-36 bg-[var(--knoux-surface-muted)] rounded"></div>
            </div>
            <div className="h-4 w-24 bg-[var(--knoux-surface-muted)] rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const isHostScanned = systemSpecs.cpuCores > 0;
  const diskUsedPercentage = isHostScanned && systemSpecs.diskTotalGB > 0 ? Math.round((systemSpecs.diskUsedGB / systemSpecs.diskTotalGB) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Card 1: Device Status */}
      <div className="p-4.5 rounded-2xl knoux-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-semibold text-[var(--knoux-text-muted)] uppercase tracking-wider">
            {t('Device Status', 'حالة الجهاز')}
          </span>
          <CheckCircle2 className="w-4 h-4 text-[var(--knoux-success)]" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-[var(--knoux-text)]">
            {isHostScanned ? systemSpecs.computerName : (runtimeMode === 'desktop' ? t('Windows Host', 'جهاز ويندوز') : t('Web Preview', 'معاينة ويب'))}
          </div>
          <p className="text-sm text-[var(--knoux-text-muted)] font-mono mt-0.5 truncate">
            {systemSpecs.osEdition} {isHostScanned ? `• ${systemSpecs.uptimeFormatted}` : ''}
          </p>
        </div>
        <span className={isHostScanned ? "knoux-badge-success" : "knoux-badge-neutral"}>
          {isHostScanned ? t('Hardware Verified', 'المكونات محققة') : t('Awaiting Hardware Scan', 'بانتظار الفحص')}
        </span>
      </div>

      {/* Card 2: CPU & Memory */}
      <div className="p-4.5 rounded-2xl knoux-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-semibold text-[var(--knoux-text-muted)] uppercase tracking-wider">
            {t('CPU & Memory', 'المعالج والذاكرة')}
          </span>
          <Cpu className="w-4 h-4 text-[var(--knoux-primary)]" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-[var(--knoux-text)]">
            {isHostScanned ? `${systemSpecs.cpuLoadPercentage}%` : '—'} <span className="text-xs font-normal text-[var(--knoux-text-muted)] font-sans">({isHostScanned ? `${systemSpecs.cpuCores} Cores` : 'Unscanned'})</span>
          </div>
          <p className="text-sm text-[var(--knoux-text-muted)] font-mono mt-0.5 truncate">
            {isHostScanned ? `RAM: ${systemSpecs.usedRamGB} GB / ${systemSpecs.totalRamGB} GB` : 'RAM Telemetry Unscanned'}
          </p>
        </div>
        <div className="w-full bg-[var(--knoux-surface-muted)] rounded-full h-1.5 overflow-hidden border border-[var(--knoux-border)]">
          <div 
            className="bg-[var(--knoux-primary)] h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${isHostScanned ? systemSpecs.cpuLoadPercentage : 0}%` }}
          ></div>
        </div>
      </div>

      {/* Card 3: Storage */}
      <div className="p-4.5 rounded-2xl knoux-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-semibold text-[var(--knoux-text-muted)] uppercase tracking-wider">
            {t('Storage Space', 'مساحة القرص')}
          </span>
          <HardDrive className="w-4 h-4 text-[var(--knoux-warning)]" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-[var(--knoux-text)]">
            {isHostScanned ? `${systemSpecs.diskFreeGB} GB` : '—'} <span className="text-xs font-normal text-[var(--knoux-text-muted)] font-sans">{t('Free', 'متاح')}</span>
          </div>
          <p className="text-sm text-[var(--knoux-text-muted)] font-mono mt-0.5 truncate">
            {isHostScanned ? `Total ${systemSpecs.diskTotalGB} GB` : 'Disk Telemetry Unscanned'}
          </p>
        </div>
        <div className="w-full bg-[var(--knoux-surface-muted)] rounded-full h-1.5 overflow-hidden border border-[var(--knoux-border)]">
          <div 
            className="bg-[var(--knoux-warning)] h-1.5 rounded-full transition-all duration-300" 
            style={{ width: `${diskUsedPercentage}%` }}
          ></div>
        </div>
      </div>

      {/* Card 4: Security */}
      <div className="p-4.5 rounded-2xl knoux-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-semibold text-[var(--knoux-text-muted)] uppercase tracking-wider">
            {t('Security & Shield', 'الأمان والحماية')}
          </span>
          <ShieldCheck className="w-4 h-4 text-[var(--knoux-success)]" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-[var(--knoux-text)]">
            {isHostScanned ? (systemSpecs.defenderStatus ? t('Protected', 'محمي بالكامل') : t('Attention Needed', 'يحتاج انتباه')) : t('Status Pending', 'بانتظار الفحص')}
          </div>
          <p className="text-sm text-[var(--knoux-text-muted)] font-mono mt-0.5 truncate">
            {isHostScanned ? (systemSpecs.defenderStatus ? 'Defender Active' : 'Defender Disabled') : 'WMI Security Unscanned'}
          </p>
        </div>
        <span className={isHostScanned && systemSpecs.defenderStatus ? "knoux-badge-success" : "knoux-badge-neutral"}>
          {isHostScanned ? (systemSpecs.defenderStatus ? 'Secured' : 'Audit Security') : 'Unscanned'}
        </span>
      </div>

      {/* Card 5: Winget & Apps */}
      <div className="p-4.5 rounded-2xl knoux-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono font-semibold text-[var(--knoux-text-muted)] uppercase tracking-wider">
            {t('Winget Engine', 'محرك Winget')}
          </span>
          <Package className="w-4 h-4 text-[var(--knoux-accent-blue)]" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-[var(--knoux-text)]">
            {runtimeMode === 'desktop' ? 'Winget Native' : 'Desktop Only'}
          </div>
          <p className="text-sm text-[var(--knoux-text-muted)] font-mono mt-0.5 truncate">
            {t('19 Modules • 190 Capabilities', '19 موديول • 190 أداة')}
          </p>
        </div>
        <span className="knoux-badge-neutral">
          {t('Catalog Ready', 'الكتالوج جاهز')}
        </span>
      </div>
    </div>
  );
};
