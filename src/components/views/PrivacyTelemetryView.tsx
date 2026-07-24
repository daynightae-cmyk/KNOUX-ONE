/**
 * KNOUX ONE — Privacy & Telemetry Block View
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { EyeOff, ShieldCheck, Check, Lock, Sparkles } from 'lucide-react';

export const PrivacyTelemetryView: React.FC = () => {
  const { addLog, requestElevation, t } = useKnoux();

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    telemetry: true,
    cortana: true,
    location: true,
    advertisingId: true,
    feedbackFrequency: true,
    bingStartSearch: true,
    activityHistory: true
  });

  const toggleItem = (key: string) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApplyPrivacyRules = () => {
    requestElevation(
      'Block Windows 11 Telemetry & Tracking',
      'حظر تتبع وإحصائيات ويندوز 11',
      'Modifying Windows Telemetry registry keys and diagnostic services requires Administrator rights.',
      'تعديل قيم سجل النظام الخاصة بالحصائيات يتطلب صلاحيات المسؤول.',
      'moderate',
      () => {
        addLog('m11_s01', 'Privacy & Telemetry Hardening', 'completed', 'Successfully updated Windows telemetry registry policies.');
      }
    );
  };

  const privacyItems = [
    { key: 'telemetry', titleEn: 'Disable Windows Diagnostic Data & Telemetry', titleAr: 'تعطيل بيانات التشخيص والتتبع التلقائي', descEn: 'Blocks background data transmission to Microsoft telemetry servers.', descAr: 'إيقاف إرسال بيانات التشخيص والأخطاء لسيرفرات مايكروسوفت.' },
    { key: 'cortana', titleEn: 'Disable Cortana & Windows Copilot AI Background', titleAr: 'تعطيل Cortana و Copilot في الخلفية', descEn: 'Prevents voice assistant and background AI indexing tasks.', descAr: 'منع مهام المساعد الصوتي والذكاء الاصطناعي في الخلفية.' },
    { key: 'location', titleEn: 'Block Windows Location Tracking Services', titleAr: 'حظر خدمات تتبع الموقع الجغرافي', descEn: 'Disables system-level location sensors and device tracking.', descAr: 'إيقاف خدمات تحديد الموقع الحساسة على مستوى النظام.' },
    { key: 'advertisingId', titleEn: 'Disable Advertising ID & Targeted Ads', titleAr: 'إلغاء المعرف الإعلاني والإعلانات المستهدفة', descEn: 'Prevents apps from using your unique Windows advertising identifier.', descAr: 'منع البرامج من تتبع التفضيلات عبر المعرف الإعلاني.' },
    { key: 'bingStartSearch', titleEn: 'Disable Bing Web Search in Windows Start Menu', titleAr: 'إلغاء نتائج بحث Bing من قائمة ابدأ', descEn: 'Limits Start Menu search purely to local disk files for maximum speed.', descAr: 'قصر البحث في قائمة ابدأ على الملفات المحلية فقط لسرعة فورية.' }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <EyeOff className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>MODULE 11 • WINDOWS 11 PRIVACY HARDENING</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Privacy & Telemetry Control Center', 'مركز التحكم بالخصوصية وحظر التتبع')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Enforce strict privacy policies by blocking Windows 11 telemetry, background diagnostics, and advertising IDs.',
              'تطبيق سياسات خصوصية صارمة لمنع تتبع ويندوز 11 وحجب الإعلانات الموجهة وبحث Bing.'
            )}
          </p>
        </div>

        <button
          onClick={handleApplyPrivacyRules}
          className="px-5 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
        >
          <Lock className="w-4 h-4" />
          <span>{t('Apply Privacy Rules', 'تطبيق الخصوصية القسري')}</span>
        </button>
      </div>

      {/* Toggles Grid */}
      <div className="space-y-3">
        {privacyItems.map(item => (
          <div
            key={item.key}
            onClick={() => toggleItem(item.key)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
              toggles[item.key]
                ? 'bg-purple-950/30 border-purple-800/60'
                : 'bg-purple-950/10 border-purple-950 opacity-60'
            }`}
          >
            <div>
              <h3 className="font-bold text-sm text-white">
                {t(item.titleEn, item.titleAr)}
              </h3>
              <p className="text-xs text-gray-300 mt-0.5">
                {t(item.descEn, item.descAr)}
              </p>
            </div>

            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                toggles[item.key]
                  ? 'bg-[#8226EE] border-[#8226EE] text-white'
                  : 'bg-purple-950 border-purple-800 text-transparent'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
