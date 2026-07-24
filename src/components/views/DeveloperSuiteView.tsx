/**
 * KNOUX ONE — Developer Suite & Environment Inspector
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { DEV_TOOLS_STATUS } from '../../data/mockSystemData';
import { Code2, Terminal, CheckCircle2, Box, Cpu, Shield, Layers } from 'lucide-react';

export const DeveloperSuiteView: React.FC = () => {
  const { t } = useKnoux();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Code2 className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 17 • DEVELOPER WORKFLOWS & COMPILERS</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Developer Runtimes & CLI Tools', 'بيئات التطوير والمترجمات البرمجية')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Audit installed developer runtimes (Node.js, Python, Git, .NET, Rust, Java, Android SDK) and WSL2 linux distributions.',
              'فحص المترجمات والبيئات البرمجية المثبتة على الكمبيوتر ومسارات التنفيذ.'
            )}
          </p>
        </div>
      </div>

      {/* Grid of Runtimes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEV_TOOLS_STATUS.map(tool => (
          <div key={tool.id} className="p-4 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-sm text-white font-mono">{tool.name}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 font-mono font-bold">
                {tool.version}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 font-mono truncate">{tool.path}</p>
            <div className="flex items-center space-x-1 rtl:space-x-reverse text-emerald-400 text-xs font-mono pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('Operational', 'جاهز للعمل')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
