/**
 * KNOUX ONE — First-Run Setup Wizard Component
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { 
  Sparkles, 
  Code2, 
  Gamepad2, 
  Palette, 
  Briefcase, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  Zap, 
  ShieldCheck, 
  Layers 
} from 'lucide-react';

interface PersonaProfile {
  id: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: React.ElementType;
  tweaksEn: string[];
  tweaksAr: string[];
}

export const FirstRunView: React.FC = () => {
  const { completeFirstRunWizard, addLog, language, t } = useKnoux();

  const [step, setStep] = useState<number>(1);
  const [selectedPersona, setSelectedPersona] = useState<string>('developer');
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [applyProgress, setApplyProgress] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);

  const personas: PersonaProfile[] = [
    {
      id: 'developer',
      titleEn: 'Software Engineer & Developer',
      titleAr: 'مهندس ومطور برمجيات',
      descriptionEn: 'Optimized for Git, Node.js, Docker, WSL2, local web dev ports, and low background noise.',
      descriptionAr: 'تحسين الخيارات لبيئات التطوير، منافذ السيرفرات المحلية، وأدوات المطورين.',
      icon: Code2,
      tweaksEn: [
        'Enable High Performance Power Plan',
        'Configure Git LongPaths & AutoCRLF',
        'Disable Windows Telemetry & Cortana',
        'Reserve local dev ports (3000, 5173, 8080)',
        'Enable Developer Mode & WSL2 components'
      ],
      tweaksAr: [
        'تفعيل وضع الأداء العالي لمنع خمول المعالج',
        'ضبط المسارات الطويلة في Git',
        'إيقاف التتبع الإحصائي لـ ويندوز وCortana',
        'حجز وإخلاء منافذ المطورين (3000, 5173)',
        'تفعيل وضع المطورين ومكونات WSL2'
      ]
    },
    {
      id: 'gamer',
      titleEn: 'High-Performance Gaming',
      titleAr: 'ألعاب والأداء الأقصى',
      descriptionEn: 'Unlocks Ultimate Performance power profile, disables background bloat, and enables GPU Hardware Acceleration.',
      descriptionAr: 'تفعيل نمط الطاقة الخارق، إيقاف خلفيات الويندوز الزائدة، وتفريغ الرام للجمينج.',
      icon: Gamepad2,
      tweaksEn: [
        'Unlock Ultimate Performance Power Plan',
        'Enable Hardware-Accelerated GPU Scheduling (HAGS)',
        'Trim background startup services',
        'Flush DNS & optimize TCP latency for low ping',
        'Disable Fullscreen Optimizations globally'
      ],
      tweaksAr: [
        'تفعيل خيار الطاقة Ultimate Performance',
        'تفعيل التسريع العتادي لكرت الشاشة (HAGS)',
        'إيقاف خدمات البدء غير الضرورية',
        'تصفية ذاكرة DNS وتحسين زمن الاستجابة Ping',
        'تعطيل تحسينات الشاشة الكاملة المزعجة'
      ]
    },
    {
      id: 'creator',
      titleEn: 'Content Creator & Designer',
      titleAr: 'صانع محتوى وتصميم',
      descriptionEn: 'Optimized for video rendering, high RAM cache allocation, and fast NVMe disk indexing.',
      descriptionAr: 'تهيأة الموارد لمعالجة الفيديو، ذاكرة التخزين المؤقت العالية، وسرعة القرص.',
      icon: Palette,
      tweaksEn: [
        'Maximize Virtual Memory paging file size',
        'Increase Thumbnail cache database limits',
        'Disable Background Apps auto-refresh',
        'Prioritize Foreground Application CPU cycles',
        'Configure NVMe SSD write caching'
      ],
      tweaksAr: [
        'زيادة حجم الذاكرة الافتراضية Paging File',
        'توسيع حدود قاعدة بيانات مصغرات الصور',
        'إيقاف تحديث التطبيقات في الخلفية',
        'إعطاء أولوية المعالجة للتطبيق النشط',
        'ضبط الذاكرة المخبئية لأقراص NVMe'
      ]
    },
    {
      id: 'business',
      titleEn: 'Business & Productivity',
      titleAr: 'أعمال وإنتاجية مكتبية',
      descriptionEn: 'Maximum security hardening, Windows Defender cloud rules, and automated restore points.',
      descriptionAr: 'أعلى معدل أمان، حماية جدار الناري، والنسخ الاحتياطي التلقائي.',
      icon: Briefcase,
      tweaksEn: [
        'Enable Windows Defender Cloud Protection',
        'Create System Restore Point',
        'Disable Bing search integration in Start Menu',
        'Configure Automated Smart Storage Sense',
        'Enforce BitLocker hardware status audit'
      ],
      tweaksAr: [
        'تفعيل حماية Defender السحابية',
        'إنشاء نقطة استعادة نظام فورية',
        'إلغاء دمج نتائج بحث Bing في قائمة ابدأ',
        'تفعيل الحساس الذكي لتنظيف القرص تلقائياً',
        'فحص حالة تشفير BitLocker'
      ]
    }
  ];

  const currentPersonaObj = personas.find(p => p.id === selectedPersona) || personas[0];

  const handleApplyTweaks = async () => {
    setIsApplying(true);
    setApplyProgress(0);

    for (let p = 10; p <= 100; p += 20) {
      setApplyProgress(p);
      await new Promise(res => setTimeout(res, 250));
    }

    setIsApplying(false);
    setCompleted(true);
    addLog('m01_s01', 'First-Run Wizard', 'completed', `Successfully applied ${currentPersonaObj.titleEn} profile tweaks to Windows.`);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Wizard Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-3 py-1 rounded-full bg-purple-950/80 border border-purple-800 text-purple-300 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5 text-[#8226EE]" />
          <span>{t('Guided First-Run Setup', 'معالج التهيئة الأولى لنظام ويندوز')}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">
          {t('Tailor Windows for Your Exact Workflow', 'تخصيص ويندوز لنمط عملك المحدد')}
        </h1>
        <p className="text-xs md:text-sm text-gray-300 max-w-xl mx-auto">
          {t(
            'Select your target system usage profile. KNOUX ONE will automatically configure system tweaks, registry tweaks, and power plans.',
            'اختر نمط الاستخدام الرئيسي. سيقوم KNOUX ONE بتعديل خيارات الطاقة وسكربتات التسريع تلقائياً.'
          )}
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center justify-center space-x-4 rtl:space-x-reverse text-xs font-mono">
        <span className={`flex items-center space-x-1.5 ${step >= 1 ? 'text-[#8226EE] font-bold' : 'text-gray-500'}`}>
          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
          <span>{t('Select Profile', 'اختيار النمط')}</span>
        </span>
        <span className="text-gray-600">—</span>
        <span className={`flex items-center space-x-1.5 ${step >= 2 ? 'text-[#8226EE] font-bold' : 'text-gray-500'}`}>
          <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
          <span>{t('Review & Apply', 'مراجعة وتطبيق')}</span>
        </span>
      </div>

      {/* Step 1: Select Profile */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {personas.map(persona => {
              const Icon = persona.icon;
              const isSelected = selectedPersona === persona.id;
              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 relative overflow-hidden ${
                    isSelected
                      ? 'bg-purple-900/30 border-[#8226EE] shadow-xl shadow-purple-900/40'
                      : 'bg-purple-950/20 border-purple-900/40 hover:border-purple-700/50 hover:bg-purple-950/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-purple-900/60 border border-purple-700/50 flex items-center justify-center text-purple-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[#8226EE] flex items-center justify-center text-white">
                        <Check className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {t(persona.titleEn, persona.titleAr)}
                    </h3>
                    <p className="text-xs text-gray-300 mt-1">
                      {t(persona.descriptionEn, persona.descriptionAr)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
            >
              <span>{t('Next: Review Tweaks', 'التالي: مراجعة التعديلات')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review Tweaks & Apply */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-6 rounded-2xl bg-purple-950/20 border border-purple-900/40 space-y-4">
            <div className="flex items-center space-x-3 rtl:space-x-reverse">
              <div className="w-10 h-10 rounded-xl bg-[#8226EE] flex items-center justify-center text-white">
                <currentPersonaObj.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  {t(currentPersonaObj.titleEn, currentPersonaObj.titleAr)}
                </h3>
                <p className="text-xs text-purple-300 font-mono">
                  {t('The following 5 system configurations will be applied:', 'سيتم تطبيق الـ 5 تعديلات التالية على النظام:')}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              {(language === 'ar' ? currentPersonaObj.tweaksAr : currentPersonaObj.tweaksEn).map((tweak, i) => (
                <div key={i} className="p-3 rounded-xl bg-purple-950/40 border border-purple-900/40 flex items-center space-x-3 rtl:space-x-reverse text-xs text-gray-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{tweak}</span>
                </div>
              ))}
            </div>

            {isApplying && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs font-mono text-purple-300">
                  <span>{t('Applying Windows Tweaks...', 'جاري تطبيق التعديلات...')}</span>
                  <span>{applyProgress}%</span>
                </div>
                <div className="w-full bg-purple-950 rounded-full h-2.5 overflow-hidden">
                  <div className="bg-[#8226EE] h-2.5 rounded-full transition-all duration-200" style={{ width: `${applyProgress}%` }}></div>
                </div>
              </div>
            )}

            {completed && (
              <div className="p-4 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs font-medium flex items-center space-x-2 rtl:space-x-reverse">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{t('All first-run configurations successfully applied to Windows OS!', 'تم تطبيق جميع التعديلات بنجاح!')}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              disabled={isApplying}
              className="px-5 py-2.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-800/50 text-gray-300 text-xs font-semibold flex items-center space-x-2 rtl:space-x-reverse transition-colors disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t('Back to Profiles', 'العودة للاختيار')}</span>
            </button>

            {!completed ? (
              <button
                onClick={handleApplyTweaks}
                disabled={isApplying}
                className="px-6 py-2.5 rounded-xl bg-[#8226EE] hover:bg-purple-600 text-white font-bold text-xs shadow-lg shadow-purple-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                <span>{isApplying ? t('Applying...', 'جاري التطبيق...') : t('Apply Profile Tweaks', 'تطبيق التعديلات الآن')}</span>
              </button>
            ) : (
              <button
                onClick={completeFirstRunWizard}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/50 flex items-center space-x-2 rtl:space-x-reverse transition-all active:scale-95"
              >
                <span>{t('Finish & Open Dashboard', 'إنهاء والانتقال للوحة التحكم')}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
