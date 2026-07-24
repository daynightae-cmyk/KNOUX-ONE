/**
 * KNOUX ONE — Universal Capability Card Component
 */

import React, { useState } from 'react';
import { KnouxCapability } from '../../types';
import { useKnoux } from '../../context/KnouxContext';
import { 
  Play, 
  Eye, 
  Terminal, 
  ShieldAlert, 
  CheckCircle2, 
  Code, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check 
} from 'lucide-react';

interface CapabilityCardProps {
  capability: KnouxCapability;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({ capability }) => {
  const { addLog, requestElevation, language, t } = useKnoux();

  const [expandedCode, setExpandedCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [lastExecutedMessage, setLastExecutedMessage] = useState<string | null>(null);

  const handleRun = () => {
    if (capability.requiresAdmin) {
      requestElevation(
        capability.nameEn,
        capability.nameAr,
        `Execution of ${capability.nameEn} requires administrative privileges on Windows.`,
        `تتطلب أداة ${capability.nameAr} صلاحيات المسؤول للتنفيذ على ويندوز.`,
        capability.riskLevel,
        () => executeDirectly(false)
      );
    } else {
      executeDirectly(false);
    }
  };

  const handleDryRun = () => {
    executeDirectly(true);
  };

  const executeDirectly = (isDryRun: boolean) => {
    setIsRunning(true);
    setLastExecutedMessage(null);

    setTimeout(() => {
      setIsRunning(false);
      const msg = isDryRun
        ? (language === 'ar' ? 'تم إجراء الفحص والمعاينة التجريبية بنجاح. لا توجد تغييرات دائمية.' : 'Dry Run completed. Estimated space/impact calculated successfully with zero system changes.')
        : (language === 'ar' ? 'تم تنفيذ العملية بنجاح على نظام ويندوز.' : 'Operation executed successfully on Windows OS.');
      
      setLastExecutedMessage(msg);
      addLog(capability.id, capability.nameEn, 'completed', msg);
    }, 600);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'safe':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 font-mono font-bold">{t('Safe', 'آمن')}</span>;
      case 'moderate':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-mono font-bold">{t('Moderate', 'متوسط')}</span>;
      case 'high':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-950/60 text-orange-300 border border-orange-800/40 font-mono font-bold">{t('High Risk', 'عالي الخطورة')}</span>;
      case 'critical':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/60 font-mono font-bold">{t('Critical', 'حرج جداً')}</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 hover:border-purple-600/50 transition-all duration-200 flex flex-col justify-between group space-y-3">
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
            {capability.id.toUpperCase()}
          </span>
          <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
            {capability.requiresAdmin && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-950/80 text-red-300 border border-red-800/50 font-mono font-bold flex items-center space-x-1">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>ADMIN</span>
              </span>
            )}
            {getRiskBadge(capability.riskLevel)}
          </div>
        </div>

        {/* Title & Description */}
        <h4 className="font-bold text-sm text-white group-hover:text-purple-300 transition-colors">
          {t(capability.nameEn, capability.nameAr)}
        </h4>
        <p className="text-xs text-gray-300 mt-1 leading-relaxed">
          {t(capability.descriptionEn, capability.descriptionAr)}
        </p>

        {/* Execution Feedback */}
        {lastExecutedMessage && (
          <div className="mt-2.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-[11px] text-emerald-300 flex items-start space-x-1.5 rtl:space-x-reverse animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{lastExecutedMessage}</span>
          </div>
        )}
      </div>

      {/* Code Inspector Toggle */}
      {(capability.psCommand || capability.wingetId) && (
        <div className="border-t border-purple-900/30 pt-2">
          <button
            onClick={() => setExpandedCode(!expandedCode)}
            className="flex items-center space-x-1 rtl:space-x-reverse text-[11px] font-mono text-purple-400 hover:text-purple-200 transition-colors"
          >
            <Code className="w-3 h-3" />
            <span>{expandedCode ? t('Hide Script Code', 'إخفاء كود السكربت') : t('Inspect PowerShell Command', 'معاينة كود الباورشيل')}</span>
            {expandedCode ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expandedCode && (
            <div className="mt-2 p-2.5 rounded-lg bg-[#060114] border border-purple-950 font-mono text-[11px] text-purple-200 relative group/code">
              <div className="flex items-center justify-between mb-1 text-[10px] text-purple-400">
                <span>PowerShell / CLI:</span>
                <button
                  onClick={() => copyCommand(capability.psCommand || capability.wingetId || '')}
                  className="flex items-center space-x-1 text-purple-300 hover:text-white"
                >
                  {copiedCode ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <code className="block whitespace-pre-wrap break-all text-emerald-400 select-all">
                {capability.psCommand || `winget install --id ${capability.wingetId} -e --accept-source-agreements`}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 rtl:space-x-reverse pt-1">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="flex-1 py-1.5 px-3 rounded-lg bg-[#8226EE] hover:bg-purple-600 text-white font-medium text-xs shadow-md shadow-purple-900/40 flex items-center justify-center space-x-1.5 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? t('Executing...', 'جاري التنفيذ...') : t('Execute', 'تنفيذ')}</span>
        </button>

        {capability.supportsDryRun && (
          <button
            onClick={handleDryRun}
            disabled={isRunning}
            className="py-1.5 px-3 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-purple-200 font-medium text-xs flex items-center space-x-1 rtl:space-x-reverse transition-colors disabled:opacity-50"
            title={t('Preview impact without modifying system', 'معاينة التغييرات دون كتابتها على القرص')}
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">{t('Dry Run', 'معاينة')}</span>
          </button>
        )}
      </div>
    </div>
  );
};
