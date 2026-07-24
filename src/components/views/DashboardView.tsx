/**
 * KNOUX ONE — Dashboard Overview View
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
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
  TrendingUp,
  Server
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { 
    systemSpecs, 
    setCurrentRoute, 
    runSmartScan, 
    isScanning, 
    actionLogs, 
    executeCleanup,
    t 
  } = useKnoux();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner Hero */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/40 via-[#8226EE]/20 to-indigo-900/40 border border-purple-800/40 backdrop-blur-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 z-10">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#8226EE] text-white">
              BUILD • PROTECT • OPTIMIZE
            </span>
            <span className="text-xs text-purple-300 font-mono">
              {systemSpecs.computerName}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            KNOUX <span className="text-[#8226EE]">ONE</span> — {t('Windows Intelligence Suite', 'جناح إدارة وذكاء ويندوز')}
          </h1>
          <p className="text-xs md:text-sm text-gray-300 max-w-2xl">
            {t(
              'Integrated operating environment providing 19 modules and 190 registered capabilities for Windows optimization, security, and developer productivity.',
              'بيئة تشغيل متكاملة توفر 19 موديل و 190 وظيفة لتطوير، حماية، وتنظيف نظام ويندوز للجاهزية القصوى.'
            )}
          </p>
        </div>

        <div className="flex items-center space-x-3 rtl:space-x-reverse z-10 shrink-0">
          <button
            onClick={() => setCurrentRoute('first-run')}
            className="px-4 py-2.5 rounded-xl bg-purple-950/80 hover:bg-purple-900 border border-purple-700/50 text-white font-medium text-xs shadow transition-all duration-150 active:scale-95"
          >
            {t('First-Run Wizard', 'معالج الإعداد الأول')}
          </button>
          <button
            onClick={runSmartScan}
            disabled={isScanning}
            className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all duration-150 active:scale-95 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? t('Scanning System...', 'جاري الفحص...') : t('Run Smart Audit', 'إجراء فحص شامل')}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* System Health Score */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/50 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-gray-400">
              {t('System Health Index', 'مؤشر صحة النظام')}
            </span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2 rtl:space-x-reverse">
            <span className="text-3xl font-extrabold text-white font-mono">{systemSpecs.healthScore}</span>
            <span className="text-xs text-emerald-400 font-bold font-mono">/ 100 ({t('Optimal', 'ممتاز')})</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full" style={{ width: `${systemSpecs.healthScore}%` }}></div>
          </div>
        </div>

        {/* CPU Load */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/50 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-gray-400">
              {t('CPU Load & Cores', 'استهلاك المعالج')}
            </span>
            <Cpu className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-2 rtl:space-x-reverse">
            <span className="text-3xl font-extrabold text-white font-mono">{systemSpecs.cpuLoadPercentage}%</span>
            <span className="text-xs text-gray-400 font-mono">({systemSpecs.cpuCores} Threads)</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full" style={{ width: `${systemSpecs.cpuLoadPercentage}%` }}></div>
          </div>
        </div>

        {/* RAM Usage */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/50 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-gray-400">
              {t('RAM Memory Used', 'ذاكرة RAM المستهلكة')}
            </span>
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-2 rtl:space-x-reverse">
            <span className="text-3xl font-extrabold text-white font-mono">{systemSpecs.usedRamGB} GB</span>
            <span className="text-xs text-gray-400 font-mono">/ {systemSpecs.totalRamGB} GB</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full" style={{ width: `${systemSpecs.ramLoadPercentage}%` }}></div>
          </div>
        </div>

        {/* Disk Free Space */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/50 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono font-semibold text-gray-400">
              {t('NVMe SSD Free Space', 'المساحة المتاحة للقرص')}
            </span>
            <HardDrive className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2 rtl:space-x-reverse">
            <span className="text-3xl font-extrabold text-white font-mono">{systemSpecs.diskFreeGB} GB</span>
            <span className="text-xs text-gray-400 font-mono">/ {systemSpecs.diskTotalGB} GB</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full" style={{ width: `${(systemSpecs.diskUsedGB / systemSpecs.diskTotalGB) * 100}%` }}></div>
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Action Hub & System Specs Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Hub (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
              <Zap className="w-4 h-4 text-[#8226EE]" />
              <span>{t('Primary Suite Hubs', 'مراكز التحكم الرئيسية')}</span>
            </h2>
            <button
              onClick={() => setCurrentRoute('catalog')}
              className="text-xs text-purple-400 hover:text-purple-200 font-mono flex items-center space-x-1 rtl:space-x-reverse"
            >
              <span>{t('View All 190 Tools', 'عرض الـ 190 أداة')}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Post-Format Card */}
            <div
              onClick={() => setCurrentRoute('post-format')}
              className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/60 hover:bg-purple-900/30 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform mb-3">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                {t('Post-Format Installer', 'حزمة ما بعد الفورمات')}
              </h3>
              <p className="text-xs text-gray-300 mt-1">
                {t('One-click Winget catalog installer for Chrome, VS Code, Git, 7-Zip, Discord & PowerToys.', 'تثبيت بنقرة واحدة لجميع البرامج الأساسية بعد الفورمات.')}
              </p>
            </div>

            {/* Smart Storage Cleanup */}
            <div
              onClick={() => setCurrentRoute('cleanup')}
              className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/60 hover:bg-purple-900/30 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform mb-3">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                {t('Smart Storage Cleanup', 'التنظيف الذكي للمساحة')}
              </h3>
              <p className="text-xs text-gray-300 mt-1">
                {t('Recycle temp files, browser cache, crash dumps and old logs safely with 0 risk.', 'تفصيل وتنظيف المخبئيات والملفات المؤقتة بسلامة كاملة.')}
              </p>
            </div>

            {/* Windows Repair */}
            <div
              onClick={() => setCurrentRoute('repair')}
              className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/60 hover:bg-purple-900/30 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform mb-3">
                <Wrench className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                {t('Windows Repair & SFC/DISM', 'أدوات صيانة ويندوز')}
              </h3>
              <p className="text-xs text-gray-300 mt-1">
                {t('Execute SFC /scannow, DISM RestoreHealth, and reset Windows Update agent.', 'تصليح وتصحيح ملفات نظام ويندوز وتحديثات النظام.')}
              </p>
            </div>

            {/* Developer Environments */}
            <div
              onClick={() => setCurrentRoute('developer')}
              className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/60 hover:bg-purple-900/30 transition-all cursor-pointer group"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-900/50 border border-purple-700/50 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform mb-3">
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
                {t('Developer Tools & Local Ports', 'أدوات المطورين والمنافذ')}
              </h3>
              <p className="text-xs text-gray-300 mt-1">
                {t('Audit local dev ports (3000, 5173), inspect Node, Python, Git, and WSL2 distros.', 'إدارة منافذ الويب والبيئات البرمجية والتطوير.')}
              </p>
            </div>
          </div>
        </div>

        {/* System Hardware Specifications Card */}
        <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-4">
          <h2 className="text-base font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>{t('Hardware & OS Identity', 'بيانات الجهاز والنظام')}</span>
          </h2>

          <div className="space-y-2.5 text-xs font-mono">
            <div className="flex justify-between py-1 border-b border-purple-950">
              <span className="text-gray-400">{t('OS Edition:', 'إصدار ويندوز:')}</span>
              <span className="font-bold text-white">{systemSpecs.osEdition} ({systemSpecs.osVersion})</span>
            </div>

            <div className="flex justify-between py-1 border-b border-purple-950">
              <span className="text-gray-400">{t('Build Number:', 'رقم البناء:')}</span>
              <span className="text-purple-300">{systemSpecs.osBuild}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-purple-950">
              <span className="text-gray-400">{t('Processor:', 'المعالج:')}</span>
              <span className="text-gray-200 text-right truncate max-w-[180px]">{systemSpecs.processor}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-purple-950">
              <span className="text-gray-400">{t('Uptime:', 'مدة التشغيل:')}</span>
              <span className="text-emerald-400 font-bold">{systemSpecs.uptimeFormatted}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-purple-950">
              <span className="text-gray-400">{t('IP Address:', 'عنوان IP المحلي:')}</span>
              <span className="text-gray-200">{systemSpecs.ipAddress}</span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-gray-400">{t('Defender & Firewall:', 'الحماية والجدار الناري:')}</span>
              <span className="text-emerald-400 font-bold flex items-center space-x-1 rtl:space-x-reverse">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{t('Active', 'مفعل')}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Action Activity Stream */}
      <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>{t('Audit Trail & Action Logs', 'سجل العمليات والتدقيق')}</span>
          </h3>
          <span className="text-xs text-gray-400 font-mono">
            {actionLogs.length} {t('records logged', 'عملية مسجلة')}
          </span>
        </div>

        <div className="space-y-2">
          {actionLogs.slice(0, 4).map(log => (
            <div key={log.id} className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/30 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-3 rtl:space-x-reverse">
                <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                <div>
                  <span className="font-bold text-white font-mono">{log.capabilityName}</span>
                  <p className="text-gray-300 text-[11px] mt-0.5">{log.details}</p>
                </div>
              </div>
              <span className="text-[10px] text-purple-300 font-mono shrink-0">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
