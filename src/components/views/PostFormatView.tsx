/**
 * KNOUX ONE — Post-Format Essential Applications Suite
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { 
  Download, 
  Check, 
  Terminal, 
  Copy, 
  CheckCircle2, 
  Code, 
  Globe, 
  Archive, 
  Film, 
  MessageSquare, 
  Sliders, 
  Cpu, 
  Layout, 
  Box, 
  Filter 
} from 'lucide-react';

export const PostFormatView: React.FC = () => {
  const { essentialApps, toggleAppInstall, addLog, requestElevation, t } = useKnoux();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedBatchScript, setCopiedBatchScript] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installProgress, setInstallProgress] = useState<number>(0);
  const [installStatusMsg, setInstallStatusMsg] = useState<string>('');

  const filteredApps = essentialApps.filter(app => {
    if (activeCategory === 'all') return true;
    return app.category === activeCategory;
  });

  const selectedApps = essentialApps.filter(a => a.installed);

  const generateWingetPowerShell = () => {
    if (selectedApps.length === 0) return '# Select apps to generate Winget script';
    const lines = [
      '# KNOUX ONE — Post-Format Automated Winget Batch Installer Script',
      '# Run in Elevated PowerShell (Admin)',
      ''
    ];
    selectedApps.forEach(app => {
      lines.push(`Write-Host "Installing ${app.name} (${app.wingetId})..." -ForegroundColor Cyan`);
      lines.push(`winget install --id ${app.wingetId} -e --accept-source-agreements --accept-package-agreements`);
    });
    return lines.join('\n');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generateWingetPowerShell());
    setCopiedBatchScript(true);
    setTimeout(() => setCopiedBatchScript(false), 2000);
  };

  const handleInstallAllSelected = () => {
    if (selectedApps.length === 0) return;

    requestElevation(
      `Winget Batch Install (${selectedApps.length} Apps)`,
      `تثبيت البرامج الأساسية (${selectedApps.length} برنامج)`,
      'Installing system applications requires Windows Package Manager (Winget) administrative privileges.',
      'تثبيت البرامج عبر Winget يتطلب صلاحيات المسؤول على النظام.',
      'safe',
      async () => {
        setIsInstalling(true);
        setInstallProgress(0);

        for (let index = 0; index < selectedApps.length; index++) {
          const app = selectedApps[index];
          setInstallStatusMsg(t(`Installing ${app.name} (${app.wingetId})...`, `جاري تثبيت ${app.name}...`));
          const p = Math.round(((index + 1) / selectedApps.length) * 100);
          setInstallProgress(p);
          await new Promise(res => setTimeout(res, 400));
        }

        setIsInstalling(false);
        addLog('m01_s01', 'Post-Format Winget Installer', 'completed', `Successfully installed ${selectedApps.length} essential software packages via Winget.`);
      }
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Download className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>WINGET PACKAGE MANAGER GUI</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Post-Format Software Installer', 'حزمة تثبيت البرامج بعد الفورمات')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Select software packages and install them instantly using official Microsoft Winget repositories.',
              'حدد البرامج المطلوبة وقم بتثبيتها تلقائياً بنقرة واحدة عبر المستودعات الرسمية لشركة مايكروسوفت.'
            )}
          </p>
        </div>

        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <button
            onClick={copyScript}
            className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 text-xs font-mono font-medium flex items-center space-x-1.5 rtl:space-x-reverse transition-colors"
          >
            {copiedBatchScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-purple-400" />}
            <span>{copiedBatchScript ? t('Script Copied!', 'تم نسخ السكربت!') : t('Copy PowerShell Script', 'نسخ سكربت الباورشيل')}</span>
          </button>

          <button
            onClick={handleInstallAllSelected}
            disabled={selectedApps.length === 0 || isInstalling}
            className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isInstalling ? 'animate-bounce' : ''}`} />
            <span>
              {isInstalling
                ? t('Installing Packages...', 'جاري التثبيت...')
                : t(`Install Selected (${selectedApps.length})`, `تثبيت البرامج المحددة (${selectedApps.length})`)}
            </span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isInstalling && (
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-800/50 space-y-2 animate-in fade-in">
          <div className="flex justify-between text-xs font-mono text-purple-200">
            <span>{installStatusMsg}</span>
            <span>{installProgress}%</span>
          </div>
          <div className="w-full bg-purple-950 rounded-full h-2 overflow-hidden">
            <div className="bg-[#8226EE] h-2 rounded-full transition-all duration-200" style={{ width: `${installProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto custom-scrollbar pb-2">
        {['all', 'browser', 'developer', 'utility', 'media', 'communication', 'design'].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium capitalize whitespace-nowrap transition-colors ${
              activeCategory === cat
                ? 'bg-[#8226EE] text-white font-bold shadow-md shadow-purple-900/40'
                : 'bg-purple-950/30 text-purple-300 hover:bg-purple-900/40 border border-purple-900/40'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Apps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApps.map(app => (
          <div
            key={app.id}
            onClick={() => toggleAppInstall(app.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between space-x-3 rtl:space-x-reverse ${
              app.installed
                ? 'bg-purple-900/30 border-[#8226EE] shadow-lg shadow-purple-900/30'
                : 'bg-purple-950/20 border-purple-900/40 hover:border-purple-700/50 hover:bg-purple-950/30'
            }`}
          >
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <span className="font-bold text-sm text-white truncate">{app.name}</span>
                {app.recommended && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono font-bold">
                    RECOMMENDED
                  </span>
                )}
              </div>
              <p className="text-[11px] text-purple-300/80 font-mono truncate">{app.wingetId}</p>
              <p className="text-[10px] text-gray-400">{app.publisher} • ~{app.sizeMB} MB</p>
            </div>

            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                app.installed
                  ? 'bg-[#8226EE] border-[#8226EE] text-white'
                  : 'bg-purple-950/40 border-purple-800/60 text-transparent'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>
        ))}
      </div>

      {/* Winget PowerShell Script Preview */}
      <div className="p-5 rounded-2xl bg-[#060114] border border-purple-900/40 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-purple-300 border-b border-purple-950 pb-2">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Terminal className="w-4 h-4 text-[#8226EE]" />
            <span className="font-bold">{t('Generated Winget PowerShell Script', 'كود الباورشيل المولد للـ Winget')}</span>
          </div>
          <span className="text-[10px] text-gray-500">{selectedApps.length} packages selected</span>
        </div>
        <pre className="text-emerald-400 whitespace-pre-wrap overflow-x-auto max-h-48 custom-scrollbar">
          {generateWingetPowerShell()}
        </pre>
      </div>
    </div>
  );
};
