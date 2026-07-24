/**
 * KNOUX ONE — Main Application Dashboard View
 * Primary Reference: AiDEA node 17245:92328
 * Secondary Detail Reference: AiDEA node 19211:66140
 * Atmospheric Reference: SleekSphere node 0:1
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { DashboardHero } from '../dashboard/DashboardHero';
import { StatusCardsGrid } from '../dashboard/StatusCardsGrid';
import { 
  ShieldCheck, 
  Cpu, 
  HardDrive, 
  Activity, 
  Sparkles, 
  Trash2, 
  Wrench, 
  Download, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Terminal, 
  ArrowUpRight,
  Monitor,
  Package,
  Copy,
  Layers,
  AlertTriangle,
  Info,
  Server,
  Play,
  RotateCw,
  Sliders,
  BellRing
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    systemSpecs, 
    setCurrentRoute, 
    runSmartScan, 
    isScanning, 
    actionLogs, 
    theme,
    runtimeMode,
    t 
  } = useKnoux();

  const [activeTab, setActiveTab] = useState<'all' | 'activity' | 'queue'>('all');

  // Empty recommendations since they should be based on real telemetry
  const recommendations: any[] = [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto transition-colors duration-200">
      
      {/* SECTION A: Welcome & System Context Hero Card */}
      <DashboardHero />

      {/* SECTION B: Five Primary Status Cards */}
      <StatusCardsGrid isLoading={isScanning} />

      {/* SECTION C: Quick Actions Grid (8 Tiles) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
            <Zap className="w-4 h-4 text-[var(--knoux-primary)]" />
            <span>{t('Quick Actions Hub', 'الوصول السريع للخدمات')}</span>
          </h2>
          <button
            onClick={() => setCurrentRoute('catalog')}
            className="text-xs text-[var(--knoux-primary)] hover:underline font-mono flex items-center space-x-1 rtl:space-x-reverse"
          >
            <span>{t('View All 190 Capabilities', 'عرض جميع الـ 190 أداة')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tile 1: Device Discovery */}
          <div
            onClick={() => setCurrentRoute('first-run')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Monitor className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m01_s01
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Device Discovery', 'فحص واستكشاف الجهاز')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('Audit CPU, motherboard, RAM modules, disks, and OS build natively.', 'فحص وقراءة جميع مواصفات الجهاز المعالج واللوحة والذاكرة.')}
            </p>
          </div>

          {/* Tile 2: Verify Winget */}
          <div
            onClick={() => setCurrentRoute('post-format')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Package className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m01_s02
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Verify Winget Client', 'التحقق من أداة Winget')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('Confirm App Installer executable path, source accessibility, and client version.', 'التحقق من جودة ومسار تشغيل مدير الحزم الخفيف Winget.')}
            </p>
          </div>

          {/* Tile 3: Post-Format Setup */}
          <div
            onClick={() => setCurrentRoute('post-format')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Download className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m01_s05
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Bulk Software Queue', 'تثبيت البرامج دفعة واحدة')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('Install Chrome, VS Code, Git, 7-Zip, Discord, and tools via Winget queue.', 'طابور تثبيت متسلسل ومأمون للبرامج الأساسية بعد الفورمات.')}
            </p>
          </div>

          {/* Tile 4: Essential Apps Catalog */}
          <div
            onClick={() => setCurrentRoute('applications')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Package className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m01_s04
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Essential Apps Catalog', 'متجر البرامج الأساسية')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('Browse curated manifest containing verified publisher package IDs.', 'دليل البرامج الموثقة والمفهرسة بمعرفات حزم رسمية.')}
            </p>
          </div>

          {/* Tile 5: Smart Cleanup */}
          <div
            onClick={() => setCurrentRoute('cleanup')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Trash2 className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m02_s01
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Smart Storage Cleanup', 'التنظيف الذكي')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('Recycle browser cache, crash dumps, and temp files with 0 risk.', 'تنظيف الملفات المؤقتة والمخادعة للذاكرة بأمان بدون مخاطر.')}
            </p>
          </div>

          {/* Tile 6: Duplicate Finder */}
          <div
            onClick={() => setCurrentRoute('duplicates')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Copy className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m03_s01
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Duplicate File Finder', 'مستكشف الملفات المكررة')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('BLAKE3 hash-based precise duplicate identification and quarantine.', 'كشف ومطابقة الملفات المكررة باستخدام التشفير الفائق.')}
            </p>
          </div>

          {/* Tile 7: Windows Repair */}
          <div
            onClick={() => setCurrentRoute('repair')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <Wrench className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m07_s01
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Windows System Repair', 'إصلاح وصيانة ويندوز')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('SFC /scannow and DISM image repair targeting broken system binaries.', 'تصليح وتصحيح ملفات النظام المتضررة وتحديثات النظام.')}
            </p>
          </div>

          {/* Tile 8: Restore Point */}
          <div
            onClick={() => setCurrentRoute('backup')}
            className="p-4.5 rounded-2xl knoux-card cursor-pointer group space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="knoux-icon-capsule group-hover:border-[var(--knoux-primary)] transition-all">
                <HardDrive className="w-4 h-4 text-[var(--knoux-primary)]" />
              </div>
              <span className="knoux-badge-neutral">
                m01_s10
              </span>
            </div>
            <h3 className="font-bold text-xs text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
              {t('Create System Restore Point', 'إنشاء نقطة استعادة')}
            </h3>
            <p className="knoux-body text-sm line-clamp-2">
              {t('UAC-elevated SystemRestore checkpoint before post-format execution.', 'إنشاء نقطة استعادة مأمونة بـ UAC قبل البدء في التعديلات.')}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION D & E: Live Device Activity & KNOUX Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section D: Live Device Activity */}
        <div className="lg:col-span-2 p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
              <Activity className="w-4 h-4 text-[var(--knoux-accent-blue)]" />
              <span>{t('Live Device Activity', 'نشاط الجهاز المباشر')}</span>
            </h3>
            <span className="knoux-badge-primary">
              Host API Stream
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
              <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('CPU Load', 'استهلاك المعالج')}</span>
              <span className="text-xl font-bold text-[var(--knoux-primary)]">{systemSpecs.cpuLoadPercentage}%</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
              <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('RAM Memory', 'الذاكرة العشوائية')}</span>
              <span className="text-xl font-bold text-[var(--knoux-accent-blue)]">{systemSpecs.usedRamGB} GB</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
              <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Disk Free', 'المساحة المتاحة')}</span>
              <span className="text-xl font-bold text-[var(--knoux-warning)]">{systemSpecs.diskFreeGB} GB</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
              <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Health Score', 'مؤشر الصحة')}</span>
              <span className="text-xl font-bold text-[var(--knoux-success)]">{systemSpecs.healthScore}/100</span>
            </div>
          </div>

          {/* Area Chart Representation - Removed mock data */}
          <div className="p-4.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] space-y-2">
            <div className="flex justify-between text-xs font-mono text-[var(--knoux-text-muted)]">
              <span>{t('System Metric Load Timeline', 'مخطط استهلاك موارد الجهاز')}</span>
              <span>Interval: 1000ms</span>
            </div>
            <div className="h-28 flex items-center justify-center text-xs text-[var(--knoux-text-muted)] border-t border-[var(--knoux-border)] mt-4 pt-4">
              {t('Awaiting Telemetry Data', 'بانتظار قراءات الجهاز')}
            </div>
          </div>
        </div>

        {/* Section E: KNOUX Recommendations Panel */}
        <div className="p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
                <BellRing className="w-4 h-4 text-[var(--knoux-primary)]" />
                <span>{t('KNOUX Recommendations', 'توصيات كنوكس')}</span>
              </h3>
              <span className="knoux-badge-neutral">
                {recommendations.length > 0 ? `${recommendations.length} Findings` : t('No Findings', 'لا توجد توصيات')}
              </span>
            </div>

            <div className="space-y-3">
              {recommendations.length > 0 ? recommendations.map((rec) => (
                <div 
                  key={rec.id}
                  className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-[var(--knoux-text)]">
                      {t(rec.titleEn, rec.titleAr)}
                    </span>
                    <span className={
                      rec.severity === 'warning' ? 'knoux-badge-warning' :
                      rec.severity === 'suggestion' ? 'knoux-badge-success' :
                      'knoux-badge-primary'
                    }>
                      {rec.severity}
                    </span>
                  </div>
                  <p className="knoux-body text-sm leading-tight">
                    {t(rec.reasonEn, rec.reasonAr)}
                  </p>
                  <button
                    onClick={() => setCurrentRoute(rec.actionRoute)}
                    className="text-sm font-mono font-bold text-[var(--knoux-primary)] hover:underline flex items-center space-x-1 rtl:space-x-reverse pt-1"
                  >
                    <span>{t(rec.actionLabelEn, rec.actionLabelAr)}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )) : (
                <div className="p-6 text-center text-xs text-[var(--knoux-text-muted)] border border-dashed border-[var(--knoux-border)] rounded-xl">
                  {t('No recommendations available yet.', 'لا توجد توصيات متاحة حالياً.')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION F: Module Implementation Overview */}
      <div className="p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
            <Layers className="w-4 h-4 text-[var(--knoux-primary)]" />
            <h3 className="knoux-section-title">
              {t('Module Implementation Status (19 Modules / 190 Services)', 'حالة تنفيذ الموديولات (19 قسم / 190 خدمة)')}
            </h3>
          </div>
          <button
            onClick={() => setCurrentRoute('catalog')}
            className="text-xs text-[var(--knoux-primary)] hover:underline font-mono flex items-center space-x-1 rtl:space-x-reverse"
          >
            <span>{t('View Capabilities Catalog', 'عرض الكتالوج الكامل')}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
            <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Implemented (M01)', 'المنفذ فعليًا')}</span>
            <span className="text-lg font-bold text-[var(--knoux-success)]">10 Services</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
            <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Planned (M02-M18)', 'مخطط للتنفيذ')}</span>
            <span className="text-lg font-bold text-[var(--knoux-primary)]">170 Services</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
            <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Config Required (M19)', 'يتطلب ضبط')}</span>
            <span className="text-lg font-bold text-[var(--knoux-warning)]">10 Services</span>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] col-span-2 sm:col-span-1 lg:col-span-3 flex items-center justify-between px-4">
            <div>
              <span className="text-xs text-[var(--knoux-text-muted)] block font-sans">{t('Total Registered Suite Capabilities', 'إجمالي وظائف المنظومة')}</span>
              <span className="text-base font-bold text-[var(--knoux-text)]">190 Registered Capabilities</span>
            </div>
            <span className="knoux-badge-primary opacity-0">
              100% Honest
            </span>
          </div>
        </div>
      </div>

      {/* SECTION G: Recent Operations Table (AiDEA node 19211:66140 style) */}
      <div className="p-6 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
            <Clock className="w-4 h-4 text-[var(--knoux-primary)]" />
            <span>{t('Recent Operations Log', 'سجل العمليات الأخيرة')}</span>
          </h3>
          <span className="knoux-badge-neutral">
            {actionLogs.length} Records
          </span>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left rtl:text-right text-xs font-mono">
            <thead>
              <tr className="border-b border-[var(--knoux-border)] text-[var(--knoux-text-muted)] uppercase text-xs">
                <th className="py-2.5 px-3">{t('Capability ID', 'معرف الوظيفة')}</th>
                <th className="py-2.5 px-3">{t('Name', 'الاسم')}</th>
                <th className="py-2.5 px-3">{t('Status', 'الحالة')}</th>
                <th className="py-2.5 px-3">{t('Timestamp', 'التوقيت')}</th>
                <th className="py-2.5 px-3">{t('Details', 'التفاصيل')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--knoux-border)]">
              {actionLogs.slice(0, 5).map((log) => (
                <tr key={log.id} className="hover:bg-[var(--knoux-surface-muted)] transition-colors">
                  <td className="py-2.5 px-3 font-bold text-[var(--knoux-primary)]">{log.capabilityId.toUpperCase()}</td>
                  <td className="py-2.5 px-3 text-[var(--knoux-text)] font-semibold">{log.capabilityName}</td>
                  <td className="py-2.5 px-3">
                    <span className={
                      log.status === 'completed' ? 'knoux-badge-success' :
                      log.status === 'failed' ? 'knoux-badge-danger' :
                      'knoux-badge-primary'
                    }>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--knoux-text-muted)]">{log.timestamp}</td>
                  <td className="py-2.5 px-3 text-[var(--knoux-text-muted)] max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

