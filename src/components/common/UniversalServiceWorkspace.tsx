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
    <div className="p-6 space-y-6">
      {/* Module Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#150B33] to-[#0D0527] border border-purple-900/40 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center space-x-4 rtl:space-x-reverse">
            <div className="w-14 h-14 rounded-2xl bg-[#8226EE]/20 border border-[#8226EE]/40 flex items-center justify-center font-mono font-bold text-2xl text-purple-300">
              M{moduleNumber.toString().padStart(2, '0')}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">
                {t(moduleNameEn, moduleNameAr)}
              </h1>
              <p className="text-sm text-purple-300/80 mt-1 max-w-3xl">
                {t(descriptionEn, descriptionAr)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse bg-purple-950/50 px-3 py-1.5 rounded-xl border border-purple-800/40 text-xs font-mono">
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="text-purple-200">{capabilities.length} {t('Native Capabilities', 'وظيفة محلية')}</span>
          </div>
        </div>
      </div>

      {/* Capabilities Grid (10 Services) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {capabilities.map((cap) => {
          const isImplemented = cap.status === 'available';
          const isPlanned = cap.status === 'planned';
          const isRequiresConfig = cap.status === 'requires_configuration';

          return (
            <div
              key={cap.id}
              className="p-5 rounded-xl bg-[#151027]/80 hover:bg-[#1a1432] border border-purple-900/30 hover:border-purple-800/60 transition-all flex flex-col justify-between space-y-4 shadow-lg group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 font-mono text-[10px] border border-purple-800/40">
                      S{cap.serviceNumber.toString().padStart(2, '0')}
                    </span>
                    <h3 className="font-semibold text-white text-base group-hover:text-purple-200 transition-colors">
                      {t(cap.nameEn, cap.nameAr)}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                    isImplemented
                      ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                      : isRequiresConfig
                      ? 'bg-amber-950/60 text-amber-400 border-amber-800/50'
                      : 'bg-purple-950/60 text-purple-400 border-purple-800/50'
                  }`}>
                    {t(
                      isImplemented ? 'Available' : isRequiresConfig ? 'Config Required' : 'Planned',
                      isImplemented ? 'جاهز' : isRequiresConfig ? 'يتطلب إعداد' : 'مخطط'
                    )}
                  </span>
                </div>

                <p className="text-xs text-gray-300/80 leading-relaxed">
                  {t(cap.descriptionEn, cap.descriptionAr)}
                </p>

                {/* Capability Attributes Tags */}
                <div className="flex items-center flex-wrap gap-2 mt-3 pt-3 border-t border-purple-950/50 text-[10px] text-gray-400 font-mono">
                  {cap.requiresAdmin && (
                    <span className="flex items-center space-x-1 rtl:space-x-reverse text-amber-400 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-900/30">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{t('Admin / UAC', 'مسؤول')}</span>
                    </span>
                  )}
                  <span className="bg-purple-950/40 px-1.5 py-0.5 rounded text-purple-300">
                    {cap.riskLevel.toUpperCase()} RISK
                  </span>
                  <span className="bg-purple-950/40 px-1.5 py-0.5 rounded text-purple-300">
                    {cap.runtime.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
                <button
                  onClick={() => handlePreview(cap)}
                  className="flex-1 flex items-center justify-center space-x-1.5 rtl:space-x-reverse px-3 py-2 rounded-lg bg-purple-950/50 hover:bg-purple-900/50 text-purple-300 border border-purple-800/40 text-xs font-medium transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t('Preview', 'معاينة')}</span>
                </button>

                <button
                  onClick={() => handleExecute(cap)}
                  disabled={!isImplemented || isExecuting}
                  className={`flex-1 flex items-center justify-center space-x-1.5 rtl:space-x-reverse px-3 py-2 rounded-lg text-xs font-bold transition-all shadow-md ${
                    isImplemented && !isExecuting
                      ? 'bg-[#8226EE] hover:bg-[#701AD3] text-white shadow-purple-950/50'
                      : 'bg-gray-800/50 text-gray-500 cursor-not-allowed border border-gray-700/30'
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#151027] border border-purple-800/50 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            {/* Drawer Header */}
            <div className="p-4 bg-purple-950/60 border-b border-purple-900/40 flex items-center justify-between">
              <div className="flex items-center space-x-2.5 rtl:space-x-reverse">
                <Terminal className="w-5 h-5 text-[#8226EE]" />
                <div>
                  <h3 className="font-bold text-white text-base">
                    {t(selectedCap.nameEn, selectedCap.nameAr)}
                  </h3>
                  <p className="text-xs font-mono text-purple-300/70">
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
                className="p-1.5 rounded-lg bg-purple-900/30 hover:bg-purple-800/50 text-gray-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
              {/* Preview Information */}
              {isPreviewing && !isExecuting && !lastResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-900/30 space-y-3">
                    <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center space-x-2 rtl:space-x-reverse">
                      <FileText className="w-4 h-4" />
                      <span>{t('Execution Contract & Prerequisites', 'العقد الإجرائي والشروط')}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 block">{t('Reads:', 'المسارات المقروءة:')}</span>
                        <span className="text-gray-200 font-medium">
                          {OperationService.getCapabilityPreview(selectedCap).readsEn}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">{t('Modifies:', 'التغييرات المتوقعة:')}</span>
                        <span className="text-gray-200 font-medium">
                          {OperationService.getCapabilityPreview(selectedCap).changesEn}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 rtl:space-x-reverse pt-2">
                    <button
                      onClick={() => setIsPreviewing(false)}
                      className="px-4 py-2 rounded-lg bg-purple-950/40 text-purple-300 text-xs font-medium hover:bg-purple-900/40"
                    >
                      {t('Close', 'إغلاق')}
                    </button>
                    <button
                      onClick={() => {
                        setIsPreviewing(false);
                        handleExecute(selectedCap);
                      }}
                      className="px-5 py-2 rounded-lg bg-[#8226EE] hover:bg-[#701AD3] text-white text-xs font-bold shadow-lg flex items-center space-x-1.5 rtl:space-x-reverse"
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
                      <div className="flex justify-between text-xs font-mono text-purple-300">
                        <span>{t('Executing native operation...', 'جاري تنفيذ العملية...')}</span>
                        <span>{executionProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-purple-950 rounded-full overflow-hidden border border-purple-900/50">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-[#8226EE] transition-all duration-300"
                          style={{ width: `${executionProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Output Terminal Console */}
                  <div className="p-4 rounded-xl bg-black/80 border border-purple-900/50 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                    {executionLog || t('Initializing task...', 'جاري التجهيز...')}
                  </div>

                  {lastResult && (
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center space-x-3 rtl:space-x-reverse">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-bold text-emerald-300 text-sm">
                          {t('Operation Completed Successfully', 'تمت العملية بنجاح')}
                        </h4>
                        <p className="text-xs text-emerald-200/80 mt-0.5">
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
