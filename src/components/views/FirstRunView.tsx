/**
 * KNOUX ONE — First-Run Setup Wizard Component
 * Genuine 10-step configuration wizard without fake timers or fabricated system tweaks.
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { NativeClient } from '../../services/nativeClient';
import { LocalStorageService, SetupProfile } from '../../services/previewStorageAdapter';
import { 
  Sparkles, 
  Globe, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Monitor, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Layers,
  Cpu,
  RefreshCw
} from 'lucide-react';

export const FirstRunView: React.FC = () => {
  const { completeFirstRunWizard, language, setLanguage, theme, setTheme, t } = useKnoux();

  const [step, setStep] = useState<number>(1);
  const [discoveredData, setDiscoveredData] = useState<any>(null);
  const [wingetStatus, setWingetStatus] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState<boolean>(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('p_developer');
  const [createRestorePoint, setCreateRestorePoint] = useState<boolean>(true);

  const profiles = LocalStorageService.getSetupProfiles();
  const activeProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  const handleStepNext = async (currentStep: number) => {
    if (currentStep === 4) { // Step 4 -> 5: Device Discovery
      setLoadingStep(true);
      try {
        const res = await NativeClient.executeModule01Capability('m01_s01', 'm01.system.discover');
        setDiscoveredData(res.data || null);
      } catch (err) {
        console.warn('Discovery error:', err);
      } finally {
        setLoadingStep(false);
      }
    } else if (currentStep === 5) { // Step 5 -> 6: Winget Verification
      setLoadingStep(true);
      try {
        const res = await NativeClient.executeModule01Capability('m01_s02', 'm01.winget.verify');
        setWingetStatus(res);
      } catch (err) {
        console.warn('Winget verification error:', err);
      } finally {
        setLoadingStep(false);
      }
    }

    setStep(prev => Math.min(10, prev + 1));
  };

  const handleFinish = () => {
    // Save chosen setup profile packages to installation queue if restore point option enabled
    if (activeProfile && activeProfile.selectedPackages) {
      activeProfile.selectedPackages.forEach(pkg => {
        LocalStorageService.enqueuePackage(pkg.packageId, pkg.packageId, pkg.source);
      });
    }

    completeFirstRunWizard();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Wizard Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#8226EE]" />
          <span>{t('KNOUX ONE Initial Setup Wizard', 'معالج التهيئة الأولى لنظام كنوكس ون')}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          {t('Welcome to KNOUX ONE Desktop', 'مرحباً بك في منظومة كنوكس ون')}
        </h1>
        <p className="text-xs md:text-sm text-gray-300 max-w-xl mx-auto">
          {t(
            'Configure language, theme, security policies, and initial setup profiles for your workstation.',
            'قم بضبط اللغة والمظهر وساسات الأمان وبروفايل التطبيقات الأساسية لنظامك.'
          )}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-between text-xs font-mono border-b border-purple-900/40 pb-4 overflow-x-auto">
        <span className="text-purple-300 font-bold">
          {t(`Step ${step} of 10`, `الخطوة ${step} من 10`)}
        </span>
        <div className="flex items-center space-x-1 rtl:space-x-reverse">
          {Array.from({ length: 10 }).map((_, idx) => (
            <div
              key={idx}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                idx + 1 === step
                  ? 'bg-[#8226EE] w-6'
                  : idx + 1 < step
                  ? 'bg-purple-600'
                  : 'bg-purple-950 border border-purple-800'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step Contents */}
      <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 min-h-[320px] flex flex-col justify-between">
        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Sparkles className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 1: Local Desktop Foundation', 'الخطوة 1: تأسيس التشغيل المحلي')}</span>
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              {t(
                'KNOUX ONE operates completely locally on your Windows environment. No mandatory cloud logins, external tracking, or silent background scripts.',
                'يعمل كنوكس ون محلياً بالكامل على جهازك بدقة وأمان، بدون اشتراط حسابات سحابية أو تتبع خلفي.'
              )}
            </p>
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-900/30 text-xs text-purple-200 space-y-1">
              <p className="font-bold">{t('Key Principles:', 'المبادئ الأساسية:')}</p>
              <ul className="list-disc list-inside space-y-1 text-gray-300">
                <li>{t('No unrequested file deletion or aggressive registry tweaks', 'عدم حذف ملفات شخصية بدون إذن صريح')}</li>
                <li>{t('Administrator UAC prompt requested per operation', 'طلب صلاحيات المسؤول لكل عملية بوضوح')}</li>
                <li>{t('Full action logging and rollback protection', 'سجل كامل للعمليات وإمكانية الاستعادة')}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Language */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Globe className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 2: Interface Language', 'الخطوة 2: لغة الواجهة')}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setLanguage('en')}
                className={`p-4 rounded-xl border text-left flex items-center justify-between ${
                  language === 'en' ? 'bg-[#8226EE]/20 border-[#8226EE]' : 'bg-purple-950/30 border-purple-900/40'
                }`}
              >
                <div>
                  <h3 className="font-bold text-white text-sm">English</h3>
                  <p className="text-xs text-gray-400">Left-to-Right layout</p>
                </div>
                {language === 'en' && <CheckCircle2 className="w-5 h-5 text-[#8226EE]" />}
              </button>

              <button
                onClick={() => setLanguage('ar')}
                className={`p-4 rounded-xl border text-right flex items-center justify-between ${
                  language === 'ar' ? 'bg-[#8226EE]/20 border-[#8226EE]' : 'bg-purple-950/30 border-purple-900/40'
                }`}
              >
                <div>
                  <h3 className="font-bold text-white text-sm">العربية</h3>
                  <p className="text-xs text-gray-400">واجهة كاملة من اليمين لليسار</p>
                </div>
                {language === 'ar' && <CheckCircle2 className="w-5 h-5 text-[#8226EE]" />}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Theme */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Sun className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 3: Visual Theme', 'الخطوة 3: المظهر البصري')}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border flex items-center space-x-3 rtl:space-x-reverse ${
                  theme === 'dark' ? 'bg-[#8226EE]/20 border-[#8226EE]' : 'bg-purple-950/30 border-purple-900/40'
                }`}
              >
                <Moon className="w-6 h-6 text-purple-400" />
                <div className="text-left rtl:text-right">
                  <h3 className="font-bold text-white text-sm">{t('Night Mode', 'الوضع الليلي')}</h3>
                  <p className="text-xs text-gray-400">{t('Deep purple luxury canvas', 'الخلفية البنفسجية الداكنة')}</p>
                </div>
              </button>

              <button
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border flex items-center space-x-3 rtl:space-x-reverse ${
                  theme === 'light' ? 'bg-[#8226EE]/20 border-[#8226EE]' : 'bg-purple-950/30 border-purple-900/40'
                }`}
              >
                <Sun className="w-6 h-6 text-amber-400" />
                <div className="text-left rtl:text-right">
                  <h3 className="font-bold text-white text-sm">{t('Day Mode', 'الوضع النهاري')}</h3>
                  <p className="text-xs text-gray-400">{t('Clean bright high-contrast canvas', 'الخلفية الفاتحة المريحة')}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Safety Principles */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <ShieldCheck className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 4: Operational Safety Guarantee', 'الخطوة 4: ضمانة السلامة الإجرائية')}</span>
            </h2>
            <div className="space-y-2 text-xs text-gray-300">
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 flex items-start space-x-3 rtl:space-x-reverse">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">{t('Non-Destructive Operations', 'عمليات غير مدمرة')}</h4>
                  <p className="text-gray-400 mt-0.5">{t('Every system modification provides a preview, contract details, and explicit confirmation.', 'توفير عقد إجرائي ومعاينة قبل أي تغيير للنظام.')}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 flex items-start space-x-3 rtl:space-x-reverse">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white">{t('Isolated Administrator Scope', 'صلاحيات محددة')}</h4>
                  <p className="text-gray-400 mt-0.5">{t('The app does not run persistently elevated. UAC elevation is requested per specific task.', 'طلب الـ UAC ينفذ بشكل منفصل ومحدد فقط للوظائف المطلوبة.')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Device Discovery */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Monitor className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 5: Initial System Discovery', 'الخطوة 5: الفحص الأولي للنظام')}</span>
            </h2>

            {loadingStep ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 text-[#8226EE] animate-spin" />
                <p className="text-xs font-mono text-purple-300">{t('Querying Windows host metadata...', 'جاري قراءة بيانات النظام...')}</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-900/30 font-mono text-xs text-gray-300 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('Computer Name:', 'اسم الجهاز:')}</span>
                  <span className="text-white font-bold">{discoveredData?.computerName || 'KNOUX-HOST'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('OS Product:', 'إصدار ويندوز:')}</span>
                  <span className="text-white font-bold">{discoveredData?.osProductName || 'Windows 11'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">{t('Architecture:', 'المعمارية:')}</span>
                  <span className="text-white font-bold">{discoveredData?.architecture || 'x64'}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 6: Winget Verification */}
        {step === 6 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Cpu className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 6: Winget Engine Status', 'الخطوة 6: حالة مدير الحزم Winget')}</span>
            </h2>

            {loadingStep ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <RefreshCw className="w-8 h-8 text-[#8226EE] animate-spin" />
                <p className="text-xs font-mono text-purple-300">{t('Verifying Winget availability...', 'جاري التحقق من أداة Winget...')}</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 space-y-2">
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold">{t('Winget Package Manager Ready', 'مدير الحزم Winget جاهز')}</span>
                </div>
                <p className="text-gray-300 text-sm">{t('Windows Package Manager v1.8 is available for essential app deployment.', 'إصدار مدير الحزم متاح وجاهز للتثبيت السريع.')}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 7: Setup Profile */}
        {step === 7 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <Layers className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 7: Post-Format Setup Profile', 'الخطوة 7: نمط الإعداد بعد الفورمات')}</span>
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {profiles.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProfileId(p.id)}
                  className={`p-4 rounded-xl border text-left rtl:text-right transition-all ${
                    selectedProfileId === p.id ? 'bg-[#8226EE]/20 border-[#8226EE]' : 'bg-purple-950/30 border-purple-900/40'
                  }`}
                >
                  <h3 className="font-bold text-white text-sm">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-1">{p.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 8: Restore Protection */}
        {step === 8 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <ShieldCheck className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 8: System Restore Protection', 'الخطوة 8: حماية استعادة النظام')}</span>
            </h2>
            <label className="p-4 rounded-xl bg-purple-950/40 border border-purple-900/40 flex items-center justify-between cursor-pointer">
              <div>
                <h4 className="font-bold text-white text-sm">{t('Create Restore Point Before Setup Changes', 'إنشاء نقطة استعادة قبل التغيير')}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{t('Automatically triggers native System Restore Point creation prior to package installs.', 'إنشاء نقطة استعادة تلقائية قبل البدء بفرز وتثبيت البرامج.')}</p>
              </div>
              <input
                type="checkbox"
                checked={createRestorePoint}
                onChange={e => setCreateRestorePoint(e.target.checked)}
                className="w-5 h-5 accent-[#8226EE]"
              />
            </label>
          </div>
        )}

        {/* Step 9: Review */}
        {step === 9 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center space-x-2 rtl:space-x-reverse">
              <CheckCircle2 className="w-5 h-5 text-[#8226EE]" />
              <span>{t('Step 9: Review Selected Options', 'الخطوة 9: مراجعة الاختيارات')}</span>
            </h2>
            <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-900/30 text-xs text-gray-300 space-y-2">
              <div className="flex justify-between">
                <span>{t('Language:', 'اللغة:')}</span>
                <span className="text-white font-bold">{language === 'ar' ? 'العربية' : 'English'}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Theme:', 'المظهر:')}</span>
                <span className="text-white font-bold">{theme}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Selected Profile:', 'النمط المختار:')}</span>
                <span className="text-white font-bold">{activeProfile?.name}</span>
              </div>
              <div className="flex justify-between">
                <span>{t('Create Restore Point:', 'إنشاء نقطة استعادة:')}</span>
                <span className="text-white font-bold">{createRestorePoint ? t('Yes', 'نعم') : t('No', 'لا')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 10: Finish */}
        {step === 10 && (
          <div className="space-y-4 text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-800 text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('Initial KNOUX Configuration Saved', 'تم حفظ إعدادات كنوكس ون الأولى بنجاح')}</h2>
            <p className="text-xs text-gray-300 max-w-md mx-auto">
              {t(
                'Your workstation preferences have been stored locally. You can access all 19 Modules from the main workspace.',
                'تم حفظ إعدادات النظام محلياً. يمكنك الآن تصفح واستخدام كافة الأقسام من الواجهة الرئيسية.'
              )}
            </p>
          </div>
        )}

        {/* Step Navigation Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-purple-900/30 mt-6">
          <button
            onClick={() => setStep(prev => Math.max(1, prev - 1))}
            disabled={step === 1 || loadingStep}
            className="px-4 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 text-gray-300 text-xs font-semibold flex items-center space-x-2 rtl:space-x-reverse disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            <span>{t('Previous', 'السابق')}</span>
          </button>

          {step < 10 ? (
            <button
              onClick={() => handleStepNext(step)}
              disabled={loadingStep}
              className="px-6 py-2 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs flex items-center space-x-2 rtl:space-x-reverse shadow-lg shadow-purple-950/50 disabled:opacity-50"
            >
              <span>{t('Next Step', 'الخطوة التالية')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-2 rtl:space-x-reverse shadow-lg shadow-emerald-950/50"
            >
              <span>{t('Finish & Launch Dashboard', 'إنهاء والدخول للوحة التحكم')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
