/**
 * KNOUX ONE — Visual Storage Analyzer View
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { PieChart, HardDrive, Folder, File, Filter, ArrowUpRight, Search } from 'lucide-react';

export const StorageAnalyzerView: React.FC = () => {
  const { systemSpecs, t } = useKnoux();
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');

  const diskFolders = [
    { name: 'C:\\Windows', sizeGB: 48.2, percent: 24.8, category: 'system', filesCount: 184920 },
    { name: 'C:\\Program Files', sizeGB: 38.6, percent: 19.8, category: 'apps', filesCount: 94210 },
    { name: 'C:\\Users\\Knoux\\AppData', sizeGB: 32.4, percent: 16.7, category: 'cache', filesCount: 231400 },
    { name: 'C:\\Users\\Knoux\\Downloads', sizeGB: 28.1, percent: 14.5, category: 'downloads', filesCount: 640 },
    { name: 'C:\\Users\\Knoux\\Videos', sizeGB: 22.8, percent: 11.7, category: 'media', filesCount: 120 },
    { name: 'C:\\Users\\Knoux\\Documents', sizeGB: 14.2, percent: 7.3, category: 'documents', filesCount: 5410 },
    { name: 'C:\\ProgramData', sizeGB: 9.7, percent: 5.2, category: 'system', filesCount: 38100 }
  ];

  const largeFiles = [
    { path: 'C:\\Users\\Knoux\\Downloads\\ubuntu-22.04-desktop.iso', size: '4.20 GB', age: '45 days ago' },
    { path: 'C:\\Users\\Knoux\\Videos\\Unrendered_4K_Project.mp4', size: '12.80 GB', age: '12 days ago' },
    { path: 'C:\\Users\\Knoux\\AppData\\Local\\Docker\\wsl\\data\\ext4.vhdx', size: '18.40 GB', age: 'Today' },
    { path: 'C:\\ProgramData\\Microsoft\\Windows\\WER\\Memory_Dump.dmp', size: '1.02 GB', age: '3 days ago' }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <PieChart className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 04 • VISUAL DISK TREE ANALYSIS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Visual Storage Analyzer & Map', 'مُحلل تفاصيل قرص التخزين')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Interactive treemap and folder size breakdown across Windows drive partitions.',
              'تحليل مرئي شامل لأحجام المجلدات والملفات الضخمة المستهلكة لقسم القرص C:.'
            )}
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-purple-950/40 border border-purple-800/60 flex items-center space-x-4 rtl:space-x-reverse shrink-0">
          <HardDrive className="w-8 h-8 text-[#8226EE]" />
          <div className="font-mono">
            <span className="text-xs text-gray-400 block">System Drive C: (NVMe SSD)</span>
            <span className="text-sm font-bold text-white">{systemSpecs.diskUsedGB} GB used of {systemSpecs.diskTotalGB} GB</span>
          </div>
        </div>
      </div>

      {/* Visual Bar Map */}
      <div className="p-5 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-3">
        <h3 className="text-sm font-bold text-white font-mono">{t('Drive Space Distribution', 'توزيع مساحة القرص')}</h3>
        <div className="h-6 w-full bg-purple-950 rounded-xl overflow-hidden flex">
          <div style={{ width: '24.8%' }} className="bg-purple-600 h-full text-xs font-mono text-white flex items-center justify-center font-bold">Windows (24.8%)</div>
          <div style={{ width: '19.8%' }} className="bg-indigo-600 h-full text-xs font-mono text-white flex items-center justify-center font-bold">Programs (19.8%)</div>
          <div style={{ width: '16.7%' }} className="bg-cyan-600 h-full text-xs font-mono text-white flex items-center justify-center font-bold">AppData (16.7%)</div>
          <div style={{ width: '14.5%' }} className="bg-amber-600 h-full text-xs font-mono text-white flex items-center justify-center font-bold">Downloads (14.5%)</div>
          <div style={{ width: '24.2%' }} className="bg-emerald-600 h-full text-xs font-mono text-white flex items-center justify-center font-bold">Other & Free</div>
        </div>
      </div>

      {/* Main Grid: Folder List & Large Files */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Folders Treemap List (2 cols) */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Folder className="w-4 h-4 text-purple-400" />
            <span>{t('Largest System Folders', 'أكبر مجلدات القرص')}</span>
          </h3>

          <div className="space-y-2">
            {diskFolders.map((folder, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-900/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
                    <Folder className="w-4 h-4 text-[#8226EE]" />
                    <span>{folder.name}</span>
                  </span>
                  <span className="text-purple-300 font-bold">{folder.sizeGB} GB ({folder.percent}%)</span>
                </div>
                <div className="w-full bg-purple-950 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-[#8226EE] h-1.5 rounded-full" style={{ width: `${folder.percent}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Large Files Box */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <File className="w-4 h-4 text-amber-400" />
            <span>{t('Top Large Files (>1 GB)', 'الملفات الفردية الضخمة')}</span>
          </h3>

          <div className="space-y-2">
            {largeFiles.map((file, i) => (
              <div key={i} className="p-3 rounded-xl bg-purple-950/30 border border-purple-900/40 text-xs font-mono space-y-1">
                <div className="flex justify-between font-bold text-white">
                  <span className="truncate max-w-[180px] text-amber-300">{file.path.split('\\').pop()}</span>
                  <span>{file.size}</span>
                </div>
                <p className="text-xs text-gray-400 truncate">{file.path}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
