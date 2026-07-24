/**
 * KNOUX ONE — Administrative Elevation Confirmation Modal
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { ShieldAlert, AlertTriangle, CheckCircle, X } from 'lucide-react';

export const ElevationModal: React.FC = () => {
  const { elevationRequest, closeElevationModal, language, t } = useKnoux();

  if (!elevationRequest.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0D0527] border-2 border-red-600/70 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-red-950 to-purple-950 border-b border-red-800/40 flex items-center justify-between">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <ShieldAlert className="w-6 h-6 text-red-400 animate-bounce" />
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wide">
              {t('Windows User Account Control (UAC) Prompt', 'طلب صلاحيات المسؤول (UAC)')}
            </h3>
          </div>
          <button
            onClick={closeElevationModal}
            className="p-1 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-xs text-red-200 space-y-1">
            <p className="font-semibold text-red-300 flex items-center space-x-1 rtl:space-x-reverse">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{t('Administrative Privilege Required', 'يتطلب هذا الإجراء صلاحيات المسؤول')}</span>
            </p>
            <p className="text-gray-300">
              {t(
                'The operation you requested modifies Windows system configurations, drivers, or system directories.',
                'العملية التي طلبتها تقوم بتعديل إعدادات نظام ويندوز أو تعريفات الأجهزة أو ملفات النظام.'
              )}
            </p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div>
              <span className="text-gray-400">{t('Operation:', 'العملية:')}</span>
              <p className="font-bold text-white text-sm mt-0.5">
                {t(elevationRequest.operationNameEn, elevationRequest.operationNameAr)}
              </p>
            </div>
            <div>
              <span className="text-gray-400">{t('Target Reason:', 'سبب الطلب:')}</span>
              <p className="text-purple-200 mt-0.5 font-sans">
                {t(elevationRequest.reasonEn, elevationRequest.reasonAr)}
              </p>
            </div>
            <div className="flex items-center space-x-2 rtl:space-x-reverse">
              <span className="text-gray-400">{t('Publisher:', 'الناشر:')}</span>
              <span className="text-green-400 font-bold">KNOUX ONE Security Engine (Verified)</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#070216] border-t border-purple-950 flex items-center justify-end space-x-3 rtl:space-x-reverse">
          <button
            onClick={closeElevationModal}
            className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-gray-300 text-xs font-semibold transition-colors"
          >
            {t('Cancel', 'إلغاء')}
          </button>
          <button
            onClick={elevationRequest.onConfirm}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-purple-600 hover:from-red-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-red-900/40 flex items-center space-x-1.5 rtl:space-x-reverse transition-all active:scale-95"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{t('Grant Elevation & Run', 'منح الصلاحية والتنفيذ')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
