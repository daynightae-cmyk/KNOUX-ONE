/**
 * KNOUX ONE — Universal Capability Card Component
 * Honest state display for Implemented vs Planned capabilities
 */

import React, { useState } from 'react';
import { KnouxCapability } from '../../types';
import { useKnoux } from '../../context/KnouxContext';
import { OperationService } from '../../services/operationService';
import { 
  Play, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  Code, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check,
  Clock,
  Info
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

  const isImplemented = capability.implementationState === 'implemented';

  const handleRun = () => {
    if (!isImplemented) {
      const plannedMsg = language === 'ar'
        ? (capability.availabilityReasonAr || 'المحرك المحلي لهذه الخدمة مخطط له في المرحلة التالية.')
        : (capability.availabilityReasonEn || 'Native engine implementation scheduled for subsequent phase.');
      setLastExecutedMessage(plannedMsg);
      return;
    }

    if (capability.requiresAdmin) {
      requestElevation(
        capability.nameEn,
        capability.nameAr,
        `Execution of ${capability.nameEn} requires administrative privileges on Windows.`,
        `تتطلب أداة ${capability.nameAr} صلاحيات المسؤول للتنفيذ على ويندوز.`,
        capability.riskLevel,
        () => executeDirectly()
      );
    } else {
      executeDirectly();
    }
  };

  const executeDirectly = async () => {
    setIsRunning(true);
    setLastExecutedMessage(null);

    try {
      const result = await OperationService.executeCapability(capability);
      setIsRunning(false);

      const msg = language === 'ar' ? result.summaryAr : result.summaryEn;
      setLastExecutedMessage(msg);
      addLog(capability.id, capability.nameEn, result.status === 'completed' ? 'completed' : 'failed', msg);
    } catch (err: any) {
      setIsRunning(false);
      setLastExecutedMessage(`Error: ${err.message || 'Execution failed'}`);
    }
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between group space-y-3 knoux-card shadow-sm ${
      isImplemented 
        ? 'hover:border-[var(--knoux-primary)]/60' 
        : 'opacity-90 hover:border-[var(--knoux-border)]'
    }`}>
      <div>
        {/* Header Badges */}
        <div className="flex items-center justify-between mb-2">
          <span className="knoux-badge-primary">
            {capability.id.toUpperCase()}
          </span>
          <div className="flex items-center space-x-1.5 rtl:space-x-reverse">
            {isImplemented ? (
              <span className="knoux-badge-success flex items-center space-x-1 rtl:space-x-reverse">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>NATIVE</span>
              </span>
            ) : (
              <span className="knoux-badge-muted flex items-center space-x-1 rtl:space-x-reverse">
                <Clock className="w-2.5 h-2.5" />
                <span>PLANNED</span>
              </span>
            )}

            {capability.requiresAdmin && (
              <span className="knoux-badge-danger flex items-center space-x-1 rtl:space-x-reverse">
                <ShieldAlert className="w-2.5 h-2.5" />
                <span>ADMIN</span>
              </span>
            )}
          </div>
        </div>

        {/* Title & Description */}
        <h4 className="font-bold text-sm text-[var(--knoux-text)] group-hover:text-[var(--knoux-primary)] transition-colors">
          {t(capability.nameEn, capability.nameAr)}
        </h4>
        <p className="text-xs text-[var(--knoux-text-muted)] mt-1 leading-relaxed">
          {t(capability.descriptionEn, capability.descriptionAr)}
        </p>

        {/* Execution / Planned Feedback */}
        {lastExecutedMessage && (
          <div className={`mt-2.5 p-2 rounded-lg text-sm flex items-start space-x-1.5 rtl:space-x-reverse animate-in fade-in ${
            isImplemented
              ? 'bg-[var(--knoux-success)]/10 border border-[var(--knoux-success)]/30 text-[var(--knoux-success)]'
              : 'bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-text-muted)]'
          }`}>
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{lastExecutedMessage}</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-2 rtl:space-x-reverse pt-1">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className={`flex-1 py-1.5 px-3 rounded-xl font-medium text-xs flex items-center justify-center space-x-1.5 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50 ${
            isImplemented
              ? 'knoux-button-primary'
              : 'knoux-button-secondary'
          }`}
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
          <span>
            {isRunning
              ? t('Executing...', 'جاري التنفيذ...')
              : isImplemented
              ? t('Execute Native', 'تشغيل محلي')
              : t('Planned Info', 'معلومات الخدمة')}
          </span>
        </button>
      </div>
    </div>
  );
};
