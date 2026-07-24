/**
 * KNOUX ONE — Universal Service Workspace
 * Renders any Module's capabilities with full execution contract, previews, UAC flow, and output console.
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { KnouxCapability, OperationResult } from '../../types';
import { OperationService } from '../../services/operationService';
import { 
  Play, 
  Eye, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Terminal, 
  RotateCw, 
  X,
  FileText,
  Lock,
  Layers
} from 'lucide-react';

interface UniversalServiceWorkspaceProps {
  moduleNumber: number;
  moduleNameEn: string;
  moduleNameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  capabilities: KnouxCapability[];
}

export const UniversalServiceWorkspace: React.FC<UniversalServiceWorkspaceProps> = ({
  moduleNumber,
  moduleNameEn,
  moduleNameAr,
  descriptionEn,
  descriptionAr,
  capabilities
}) => {
  const { t, triggerElevation } = useKnoux();
  const [selectedCap, setSelectedCap] = useState<KnouxCapability | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionLog, setExecutionLog] = useState<string>('');
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);

  const handlePreview = (cap: KnouxCapability) => {
    setSelectedCap(cap);
    setIsPreviewing(true);
    setLastResult(null);
  };

  const handleExecute = async (cap: KnouxCapability) => {
    setSelectedCap(cap);
    setLastResult(null);

    // If capability requires admin elevation, trigger elevation modal flow first
    if (cap.requiresAdmin) {
      triggerElevation(
        cap.id,
        t(
          `Requires administrator privileges to perform ${cap.nameEn}.`,
          `تتطلب هذه أداة صلاحيات المسؤول لتنفيذ ${cap.nameAr}.`
        ),
        async () => {
          await runExecutionLogic(cap);
        }
      );
      return;
    }

    await runExecutionLogic(cap);
  };

  const runExecutionLogic = async (cap: KnouxCapability) => {
    setIsExecuting(true);
    setExecutionProgress(0);
    setExecutionLog(`[KNOUX NATIVE SUITE] Starting capability ${cap.id} (${cap.nameEn})...\n`);

    try {
      const result = await OperationService.executeCapability(cap, (progress, msg) => {
        setExecutionProgress(progress);
        setExecutionLog(prev => prev + `[${new Date().toLocaleTimeString()}] ${msg}\n`);
      });

      setLastResult(result);
      setExecutionLog(prev => prev + `\n[RESULT] Status: ${result.status.toUpperCase()}\n${result.stdout || ''}`);
    } catch (err: any) {
      setExecutionLog(prev => prev + `\n[ERROR] ${err.message || 'Execution error'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Module Header Banner */}
      <div className="p-6 rounded-2xl knoux-surface border knoux-border shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <div className="w-14 h-14 rounded-2xl bg-[var(--knoux-primary)]/15 border border-[var(--knoux-primary)]/40 flex items-center justify-center font-mono font-bold text-2xl text-[var(--knoux-primary)]">
              M{moduleNumber.toString().padStart(2, '0')}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--knoux-text)] tracking-wide">
                {t(moduleNameEn, moduleNameAr)}
              </h1>
              <p className="text-sm text-[var(--knoux-text-muted)] mt-1 max-w-3xl">
                {t(descriptionEn, descriptionAr)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse bg-[var(--knoux-surface-muted)] px-3 py-1.5 rounded-xl border border-[var(--knoux-border)] text-xs font-mono">
            <Layers className="w-4 h-4 text-[var(--knoux-primary)]" />
            <span className="text-[var(--knoux-text)] font-semibold">{capabilities.length} {t('Native Capabilities', 'وظيفة محلية')}</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid (10 Services) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 xl:gap-6">
        {capabilities.map((cap) => {
          const isImplemented = cap.implementationState === 'implemented' && Boolean(cap.handlerId);
          const isPlanned = cap.implementationState === 'planned';
          const isRequiresConfig = cap.implementationState === 'requires_configuration';

          const cardStyle = cap.riskLevel === 'high' 
            ? 'border-red-900/30 bg-red-950/10 hover:border-red-500/50'
            : cap.riskLevel === 'low'
            ? 'border-yellow-900/30 bg-yellow-950/10 hover:border-yellow-500/50'
            : cap.requiresAdmin
            ? 'border-purple-900/30 bg-purple-950/10 hover:border-purple-500/50'
            : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] hover:border-[var(--knoux-primary)]/50';

          return (
            <div
              key={cap.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-sm group ${cardStyle}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="knoux-badge-primary">
                      S{cap.serviceNumber.toString().padStart(2, '0')}
                    </span>
                    <h3 className="font-semibold text-[var(--knoux-text)] text-base group-hover:text-[var(--knoux-primary)] transition-colors">
                      {t(cap.nameEn, cap.nameAr)}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border uppercase shrink-0 ${
                    isImplemented
                      ? 'knoux-badge-success'
                      : isRequiresConfig
                      ? 'knoux-badge-warning'
                      : 'knoux-badge-muted'
                  }`}>
                    {t(
                      isImplemented ? 'Available' : isRequiresConfig ? 'Config Required' : 'Planned',
                      isImplemented ? 'جاهز' : isRequiresConfig ? 'يتطلب إعداد' : 'مخطط'
                    )}
                  </span>
                </div>

                <p className="text-xs text-[var(--knoux-text-muted)] leading-relaxed">
                  {t(cap.descriptionEn, cap.descriptionAr)}
                </p>

                {/* Capability Attributes Tags */}
                <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-[var(--knoux-border)] text-xs text-[var(--knoux-text-muted)] font-mono">
                  {cap.requiresAdmin && (
                    <span className="flex items-center space-x-1 rtl:space-x-reverse text-[var(--knoux-warning)] bg-[var(--knoux-warning)]/10 px-1.5 py-0.5 rounded border border-[var(--knoux-warning)]/30 font-bold">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{t('Admin / UAC', 'مسؤول')}</span>
                    </span>
                  )}
                  <span className="bg-[var(--knoux-surface-muted)] px-1.5 py-0.5 rounded text-[var(--knoux-text-muted)] border border-[var(--knoux-border)]">
                    {cap.riskLevel.toUpperCase()} RISK
                  </span>
                  <span className="bg-[var(--knoux-surface-muted)] px-1.5 py-0.5 rounded text-[var(--knoux-text-muted)] border border-[var(--knoux-border)]">
                    {cap.runtime.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
                <button
                  onClick={() => handlePreview(cap)}
                  className="flex-1 flex items-center justify-center space-x-1.5 rtl:space-x-reverse px-3 py-2 rounded-xl knoux-button-secondary text-xs font-medium"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('Preview', 'معاينة')}</span>
                </button>

                <button
                  onClick={() => handleExecute(cap)}
                  disabled={!isImplemented || isExecuting}
                  className={`flex-1 flex items-center justify-center space-x-1.5 rtl:space-x-reverse px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isImplemented && !isExecuting
                      ? 'knoux-button-primary'
                      : 'bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)] opacity-50 cursor-not-allowed border border-[var(--knoux-border)]'
                  }`}
                >
                  {isExecuting && selectedCap?.id === cap.id ? (
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{t('Execute', 'تشغيل')}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview / Execution Drawer Modal */}
      {(selectedCap && (isPreviewing || isExecuting || lastResult)) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex justify-end rtl:justify-start">
          <div className="bg-[var(--knoux-surface)] border-l rtl:border-l-0 rtl:border-r border-[var(--knoux-border)] w-full md:w-[480px] h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in">
            {/* Drawer Header */}
            <div className="p-4 bg-[var(--knoux-surface-muted)] border-b border-[var(--knoux-border)] flex items-center justify-between">
              <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
                <Terminal className="w-5 h-5 text-[var(--knoux-primary)]" />
                <div>
                  <h3 className="font-bold text-[var(--knoux-text)] text-base">
                    {t(selectedCap.nameEn, selectedCap.nameAr)}
                  </h3>
                  <p className="text-xs font-mono text-[var(--knoux-text-muted)]">
                    Capability ID: {selectedCap.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedCap(null);
                  setIsPreviewing(false);
                  setIsExecuting(false);
                  setLastResult(null);
                }}
                className="p-1.5 rounded-lg bg-[var(--knoux-surface)] hover:bg-[var(--knoux-border)]/50 text-[var(--knoux-text-muted)] hover:text-[var(--knoux-text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              {/* Preview Information */}
              {isPreviewing && !isExecuting && !lastResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] space-y-3">
                    <h4 className="text-xs font-mono font-bold text-[var(--knoux-primary)] uppercase tracking-wider flex items-center space-x-2 rtl:space-x-reverse">
                      <FileText className="w-4 h-4" />
                      <span>{t('Execution Contract & Prerequisites', 'العقد الإجرائي والشروط')}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[var(--knoux-text-muted)] block">{t('Reads:', 'المسارات المقروءة:')}</span>
                        <span className="text-[var(--knoux-text)] font-medium">
                          {OperationService.getCapabilityPreview(selectedCap).readsEn}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--knoux-text-muted)] block">{t('Modifies:', 'التغييرات المتوقعة:')}</span>
                        <span className="text-[var(--knoux-text)] font-medium">
                          {OperationService.getCapabilityPreview(selectedCap).changesEn}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-2">
                    <button
                      onClick={() => setIsPreviewing(false)}
                      className="knoux-button-secondary"
                    >
                      {t('Close', 'إغلاق')}
                    </button>
                    <button
                      onClick={() => {
                        setIsPreviewing(false);
                        handleExecute(selectedCap);
                      }}
                      className="knoux-button-primary flex items-center space-x-1.5 rtl:space-x-reverse"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t('Confirm & Execute', 'تأكيد وتشغيل')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Progress & Output Console */}
              {(isExecuting || lastResult) && (
                <div className="space-y-4">
                  {isExecuting && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono text-[var(--knoux-primary)]">
                        <span>{t('Executing native operation...', 'جاري تنفيذ العملية...')}</span>
                        <span>{executionProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-[var(--knoux-surface-muted)] rounded-full overflow-hidden border border-[var(--knoux-border)]">
                        <div
                          className="h-full bg-[var(--knoux-primary)] transition-all duration-300"
                          style={{ width: `${executionProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Output Terminal Console */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                    {executionLog || t('Initializing task...', 'جاري التجهيز...')}
                  </div>

                  {lastResult && (
                    <div className={`p-4 rounded-xl flex items-center space-x-3 rtl:space-x-reverse border ${
                      lastResult.status === 'completed'
                        ? 'bg-[var(--knoux-success)]/10 border-[var(--knoux-success)]/30'
                        : lastResult.status === 'partially_completed'
                        ? 'bg-[var(--knoux-warning)]/10 border-[var(--knoux-warning)]/30'
                        : lastResult.status === 'requires_elevation'
                        ? 'bg-[var(--knoux-primary)]/15 border-[var(--knoux-primary)]/40'
                        : 'bg-[var(--knoux-danger)]/10 border-[var(--knoux-danger)]/30'
                    }`}>
                      {lastResult.status === 'completed' ? (
                        <CheckCircle2 className="w-6 h-6 text-[var(--knoux-success)] shrink-0" />
                      ) : lastResult.status === 'partially_completed' ? (
                        <AlertTriangle className="w-6 h-6 text-[var(--knoux-warning)] shrink-0" />
                      ) : lastResult.status === 'requires_elevation' ? (
                        <ShieldAlert className="w-6 h-6 text-[var(--knoux-primary)] shrink-0" />
                      ) : (
                        <X className="w-6 h-6 text-[var(--knoux-danger)] shrink-0" />
                      )}
                      <div>
                        <h4 className={`font-bold text-sm ${
                          lastResult.status === 'completed'
                            ? 'text-[var(--knoux-success)]'
                            : lastResult.status === 'partially_completed'
                            ? 'text-[var(--knoux-warning)]'
                            : lastResult.status === 'requires_elevation'
                            ? 'text-[var(--knoux-primary)]'
                            : 'text-[var(--knoux-danger)]'
                        }`}>
                          {t(
                            lastResult.status === 'completed'
                              ? 'Operation Completed'
                              : lastResult.status === 'partially_completed'
                              ? 'Partial Completion Warning'
                              : lastResult.status === 'requires_elevation'
                              ? 'Administrator Elevation Required'
                              : 'Operation Failed / Unavailable',
                            lastResult.status === 'completed'
                              ? 'تمت العملية بنجاح'
                              : lastResult.status === 'partially_completed'
                              ? 'اكتملت العملية مع تنبيهات'
                              : lastResult.status === 'requires_elevation'
                              ? 'تتطلب العملية رفع الصلاحيات'
                              : 'فشلت العملية أو غير متاحة'
                          )}
                        </h4>
                        <p className="text-xs text-[var(--knoux-text-muted)] mt-0.5">
                          {t(lastResult.summaryEn, lastResult.summaryAr)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
