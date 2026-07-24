/**
 * KNOUX ONE — Post-Format Essential Applications Suite
 * Validated Winget software package manager interface for Module 01
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { ESSENTIAL_SOFTWARE_CATALOG, EssentialSoftwareItem } from '../../data/essentialSoftwareCatalog';
import { LocalStorageService } from '../../services/localStorageService';
import { NativeClient } from '../../services/nativeClient';
import { 
  Download, 
  Check, 
  Terminal, 
  Copy, 
  CheckCircle2, 
  Cpu, 
  FileUp, 
  FileDown, 
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';

export const PostFormatView: React.FC = () => {
  const { addLog, requestElevation, t } = useKnoux();

  const [softwareList, setSoftwareList] = useState<EssentialSoftwareItem[]>(ESSENTIAL_SOFTWARE_CATALOG);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedBatchScript, setCopiedBatchScript] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [installStatusMsg, setInstallStatusMsg] = useState<string>('');

  const filteredApps = softwareList.filter(app => {
    const matchesCategory = activeCategory === 'all' || app.category === activeCategory;
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          app.packageId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedApps = softwareList.filter(a => a.selected);

  const toggleSelectApp = (id: string) => {
    setSoftwareList(prev => prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item));
  };

  const generateWingetPowerShell = () => {
    if (selectedApps.length === 0) return '# Select software packages to generate Winget script';
    const lines = [
      '# KNOUX ONE — Post-Format Automated Winget Batch Installer Script',
      '# Run in Elevated PowerShell (Administrator)',
      ''
    ];
    selectedApps.forEach(app => {
      lines.push(`Write-Host "Installing ${app.name} (${app.packageId})..." -ForegroundColor Cyan`);
      lines.push(`winget install --id ${app.packageId} -e --accept-source-agreements --accept-package-agreements`);
    });
    return lines.join('\n');
  };

  const copyScript = () => {
    navigator.clipboard.writeText(generateWingetPowerShell());
    setCopiedBatchScript(true);
    setTimeout(() => setCopiedBatchScript(false), 2000);
  };

  const handleExportInventory = async () => {
    try {
      const res = await NativeClient.executeModule01Capability('m01_s07', 'm01.software.export_inventory');
      const exportData = JSON.stringify(selectedApps.map(a => a.packageId), null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knoux_software_inventory_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addLog('m01_s07', 'Export Inventory', 'completed', 'Exported selected software packages to JSON file.');
    } catch (e: any) {
      console.warn('Export inventory error:', e);
    }
  };

  const handleInstallQueue = () => {
    if (selectedApps.length === 0) return;

    requestElevation(
      `Winget Batch Install (${selectedApps.length} Packages)`,
      `تثبيت الحزم المحددة (${selectedApps.length} تطبيق)`,
      'Installing system software packages requires Windows Package Manager administrative privileges.',
      'تثبيت البرامج عبر Winget يتطلب صلاحيات المسؤول على وندوز.',
      'low',
      async () => {
        setIsInstalling(true);
        setInstallStatusMsg(t('Enqueuing selected packages into local queue...', 'جاري إضافة التطبيقات لطابور التثبيت...'));

        const packageIds = selectedApps.map(a => {
          LocalStorageService.enqueuePackage(a.packageId, a.name, a.source);
          return a.packageId;
        });

        setInstallStatusMsg(t('Executing Winget installer queue via native engine...', 'جاري تشغيل محرك تثبيت مدير الحزم...'));

        const res = await NativeClient.executeModule01Capability('m01_s05', 'm01.software.install_queue', {
          packageIds
        });

        setIsInstalling(false);
        setInstallStatusMsg('');

        addLog(
          'm01_s05',
          'Bulk Essential Software Installation',
          res.status === 'completed' ? 'completed' : 'failed',
          res.summaryEn
        );
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
            <span>OFFICIAL WINGET PACKAGE REPOSITORY</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Post-Format Software Catalog', 'كتالوج البرامج والنسخ الأساسية بعد الفورمات')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Browse validated software packages, queue bulk silent installation, and export workstation inventories.',
              'تصفح التطبيقات المعتمدة، قم بإضافتها لطابور التثبيت التلقائي الصامت، وتصدير واستيراد القوائم.'
            )}
          </p>
        </div>

        <div className="flex items-center space-x-3 rtl:space-x-reverse">
          <button
            onClick={handleExportInventory}
            className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 text-xs font-mono font-medium flex items-center space-x-1.5 rtl:space-x-reverse transition-colors"
          >
            <FileDown className="w-4 h-4 text-purple-400" />
            <span>{t('Export List', 'تصدير القائمة')}</span>
          </button>

          <button
            onClick={copyScript}
            className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 text-xs font-mono font-medium flex items-center space-x-1.5 rtl:space-x-reverse transition-colors"
          >
            {copiedBatchScript ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-purple-400" />}
            <span>{copiedBatchScript ? t('Copied!', 'تم النسخ!') : t('Copy PowerShell Script', 'نسخ السكربت')}</span>
          </button>

          <button
            onClick={handleInstallQueue}
            disabled={selectedApps.length === 0 || isInstalling}
            className="px-5 py-2 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${isInstalling ? 'animate-bounce' : ''}`} />
            <span>
              {isInstalling
                ? t('Processing...', 'جاري المعالجة...')
                : t(`Install Queue (${selectedApps.length})`, `تثبيت الطابور (${selectedApps.length})`)}
            </span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Tabs */}
        <div className="flex items-center space-x-2 rtl:space-x-reverse overflow-x-auto custom-scrollbar pb-2 w-full sm:w-auto">
          {['all', 'browsers', 'utilities', 'communication', 'media', 'developer', 'design'].map(cat => (
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

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-purple-400 absolute left-3 rtl:right-3 rtl:left-auto top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('Search Winget packages...', 'بحث عن برنامج...')}
            className="w-full pl-9 rtl:pr-9 rtl:pl-3 pr-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-900/40 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8226EE]"
          />
        </div>
      </div>

      {/* Installing Banner */}
      {isInstalling && (
        <div className="p-4 rounded-xl bg-purple-950/50 border border-purple-800 space-y-2 animate-in fade-in">
          <p className="text-xs font-mono text-purple-300">{installStatusMsg}</p>
        </div>
      )}

      {/* Apps Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredApps.map(app => (
          <div
            key={app.id}
            onClick={() => toggleSelectApp(app.id)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between space-x-3 rtl:space-x-reverse ${
              app.selected
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
              <p className="text-[11px] text-purple-300/80 font-mono truncate">{app.packageId}</p>
              <p className="text-[10px] text-gray-400">{t(app.descriptionEn, app.descriptionAr)}</p>
            </div>

            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                app.selected
                  ? 'bg-[#8226EE] border-[#8226EE] text-white'
                  : 'bg-purple-950/40 border-purple-800/60 text-transparent'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>
        ))}
      </div>

      {/* Winget Script Preview */}
      <div className="p-5 rounded-2xl bg-[#060114] border border-purple-900/40 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-purple-300 border-b border-purple-950 pb-2">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Terminal className="w-4 h-4 text-[#8226EE]" />
            <span className="font-bold">{t('Generated Winget Batch Script', 'سكربت التثبيت التلقائي لمدير الحزم')}</span>
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
