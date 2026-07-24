/**
 * KNOUX ONE — Windows Repair & SFC/DISM Suite
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { CapabilityCard } from '../common/CapabilityCard';
import { Wrench, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const WindowsRepairView: React.FC = () => {
  const { t } = useKnoux();

  const repairModule = MODULES_CATALOG.find(m => m.id === 'm09');
  const repairCapabilities = repairModule?.services || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <Wrench className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 09 • WINDOWS REPAIR & SFC/DISM</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Windows Repair & Image Integrity', 'أدوات صيانة وتصحيح نظام ويندوز')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Execute official Windows diagnostics: System File Checker (SFC), DISM Component Repair, and Windows Update Agent reset.',
              'فحص وتصحيح الملفات التالفة لنظام ويندوز باستخدام أدوات SFC و DISM الرسمية وإعادة تشغيل التحديثات.'
            )}
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs font-mono font-bold flex items-center space-x-2 rtl:space-x-reverse">
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>{t('Requires Admin Rights', 'يتطلب صلاحيات المسؤول')}</span>
        </div>
      </div>

      {/* Capabilities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {repairCapabilities.map(cap => (
          <CapabilityCard key={cap.id} capability={cap} />
        ))}
      </div>
    </div>
  );
};
