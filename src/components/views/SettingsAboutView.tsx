import React, { useState } from 'react';
import {
  Accessibility,
  ArrowUpRight,
  Check,
  Globe,
  Image as ImageIcon,
  Info,
  Languages,
  Moon,
  Palette,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_KNOUX_ASSETS, getOfficialKnouxLogo } from '../../data/officialBrand';

export const SettingsAboutView: React.FC = () => {
  const { theme, setTheme, language, setLanguage, setCurrentRoute, t } = useKnoux();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="knoux-page-container space-y-7">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[42%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,.16),transparent_68%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="knoux-eyebrow"><Settings className="h-4 w-4" />{t('Preferences', 'التفضيلات')}</div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.1rem)] font-black leading-[1.08] tracking-[-.045em] text-[var(--knoux-text)]">{t('Shape KNOUX ONE around your work', 'اضبط كنوكس ون ليتوافق مع طريقة عملك')}</h1>
            <p className="mt-4 max-w-3xl text-[14px] font-medium leading-7 text-[var(--knoux-text-secondary)]">{t('Manage appearance, language direction, accessibility, and product identity from one organized settings workspace.', 'أدر المظهر واتجاه اللغة وإمكانية الوصول وهوية المنتج من مساحة إعدادات واحدة منظمة.')}</p>
          </div>
          <div className="knoux-logo-orbit mx-auto h-[116px] w-[116px] shrink-0 xl:mx-10">
            {!logoFailed ? <img src={getOfficialKnouxLogo(theme)} onError={() => setLogoFailed(true)} alt="KNOUX ONE" className="h-full w-full rounded-full object-cover" /> : <span className="text-4xl font-black text-[var(--knoux-primary-bright)]">K</span>}
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-5">
          <article className="knoux-glass-panel p-6">
            <div className="flex items-center gap-3 rtl:flex-row-reverse"><div className="knoux-icon-plate"><Palette className="h-[21px] w-[21px]" /></div><div><h2 className="text-[19px] font-black text-[var(--knoux-text)]">{t('Appearance', 'المظهر')}</h2><p className="mt-1 text-[12px] text-[var(--knoux-text-muted)]">{t('Choose a complete light or dark workspace—not a simple recolor.', 'اختر مساحة عمل نهارية أو ليلية متكاملة، لا مجرد تغيير لون.')}</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setTheme('dark')} className={`relative min-h-[150px] overflow-hidden rounded-2xl border p-4 text-start transition ${theme === 'dark' ? 'border-[var(--knoux-primary)] shadow-[0_14px_36px_rgba(139,92,246,.18)]' : 'border-[var(--knoux-border)]'}`} style={{ background: 'linear-gradient(145deg,#0d1020,#171229)' }}>
                <div className="flex items-center justify-between"><Moon className="h-5 w-5 text-violet-300" />{theme === 'dark' && <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500 text-white"><Check className="h-4 w-4" /></span>}</div>
                <p className="mt-8 text-[16px] font-black text-white">{t('Night workspace', 'مساحة العمل الليلية')}</p><p className="mt-1 text-[12px] text-white/55">{t('Deep graphite glass with violet and blue depth.', 'زجاج جرافيتي عميق بلمسات بنفسجية وزرقاء.')}</p>
              </button>
              <button type="button" onClick={() => setTheme('light')} className={`relative min-h-[150px] overflow-hidden rounded-2xl border p-4 text-start transition ${theme === 'light' ? 'border-[#7545e8] shadow-[0_14px_36px_rgba(117,69,232,.16)]' : 'border-[var(--knoux-border)]'}`} style={{ background: 'linear-gradient(145deg,#ffffff,#f0ebff)' }}>
                <div className="flex items-center justify-between"><Sun className="h-5 w-5 text-amber-500" />{theme === 'light' && <span className="grid h-7 w-7 place-items-center rounded-full bg-[#7545e8] text-white"><Check className="h-4 w-4" /></span>}</div>
                <p className="mt-8 text-[16px] font-black text-[#171425]">{t('Day workspace', 'مساحة العمل النهارية')}</p><p className="mt-1 text-[12px] text-[#655f72]">{t('Pearl-white glass with clear purple structure.', 'زجاج أبيض لؤلؤي بهيكل بنفسجي واضح.')}</p>
              </button>
            </div>
          </article>

          <article className="knoux-glass-panel p-6">
            <div className="flex items-center gap-3 rtl:flex-row-reverse"><div className="knoux-icon-plate"><Languages className="h-[21px] w-[21px]" /></div><div><h2 className="text-[19px] font-black text-[var(--knoux-text)]">{t('Language & direction', 'اللغة والاتجاه')}</h2><p className="mt-1 text-[12px] text-[var(--knoux-text-muted)]">{t('Arabic uses a deliberate RTL layout while technical strings remain LTR.', 'تستخدم العربية تخطيط RTL مقصودًا، بينما تظل النصوص التقنية باتجاه LTR.')}</p></div></div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setLanguage('en')} className={`flex min-h-[78px] items-center justify-between rounded-2xl border p-4 text-start transition ${language === 'en' ? 'border-[var(--knoux-primary)] bg-[var(--knoux-primary)]/10' : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]'}`}><div><p className="text-[14px] font-black text-[var(--knoux-text)]">English</p><p className="mt-1 text-[11px] text-[var(--knoux-text-muted)]">Left-to-right workspace</p></div>{language === 'en' && <Check className="h-5 w-5 text-[var(--knoux-primary-bright)]" />}</button>
              <button type="button" onClick={() => setLanguage('ar')} className={`flex min-h-[78px] items-center justify-between rounded-2xl border p-4 text-start transition ${language === 'ar' ? 'border-[var(--knoux-primary)] bg-[var(--knoux-primary)]/10' : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]'}`}><div><p className="text-[14px] font-black text-[var(--knoux-text)]">العربية</p><p className="mt-1 text-[11px] text-[var(--knoux-text-muted)]">مساحة عمل من اليمين إلى اليسار</p></div>{language === 'ar' && <Check className="h-5 w-5 text-[var(--knoux-primary-bright)]" />}</button>
            </div>
          </article>

          <article className="knoux-glass-panel p-6">
            <div className="flex items-center gap-3 rtl:flex-row-reverse"><div className="knoux-icon-plate"><Accessibility className="h-[21px] w-[21px]" /></div><div><h2 className="text-[19px] font-black text-[var(--knoux-text)]">{t('Accessibility foundation', 'أساس إمكانية الوصول')}</h2><p className="mt-1 text-[12px] text-[var(--knoux-text-muted)]">{t('The workspace supports visible focus, reduced motion, scalable text, and status labels beyond color.', 'تدعم مساحة العمل التركيز المرئي وتقليل الحركة وتكبير النص وحالات لا تعتمد على اللون وحده.')}</p></div></div>
          </article>
        </div>

        <article className="knoux-glass-panel p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-[var(--knoux-glass-border-strong)] bg-[var(--knoux-surface-elevated)]">
                {!logoFailed ? <img src={getOfficialKnouxLogo(theme)} onError={() => setLogoFailed(true)} alt="KNOUX ONE" className="h-full w-full object-cover" /> : <span className="text-xl font-black text-[var(--knoux-primary-bright)]">K</span>}
              </div>
              <div><p className="text-[11px] font-bold uppercase tracking-[.1em] text-[var(--knoux-primary-bright)]">A Knoux Product</p><h2 className="mt-1 text-[24px] font-black tracking-[-.035em] text-[var(--knoux-text)]">KNOUX ONE</h2><p className="mt-1 text-[12px] font-semibold text-[var(--knoux-text-muted)]">Windows Intelligence & Developer Suite</p></div>
            </div>
            <Info className="h-5 w-5 text-[var(--knoux-text-muted)]" />
          </div>

          <p className="mt-6 text-[13px] font-medium leading-7 text-[var(--knoux-text-secondary)]">{t('A professional Windows workspace that organizes system care, security, recovery, applications, automation, developer tools, diagnostics, and hardware inspection into 19 focused areas with 190 registered services.', 'مساحة عمل احترافية لويندوز تنظم العناية بالنظام والأمان والاستعادة والبرامج والأتمتة وأدوات المطور والتشخيص وفحص المكونات داخل 19 مجالًا مركزًا يضم 190 خدمة مسجلة.')}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[#070A12] p-4"><p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-violet-300">{t('Official night logo', 'الشعار الليلي الرسمي')}</p><img src={OFFICIAL_KNOUX_ASSETS.nightLogo} alt="KNOUX ONE Night" className="mx-auto mt-4 h-20 w-20 rounded-full object-cover" /></div>
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[#F5F7FC] p-4"><p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#7545e8]">{t('Official day logo', 'الشعار النهاري الرسمي')}</p><img src={OFFICIAL_KNOUX_ASSETS.dayLogo} alt="KNOUX ONE Day" className="mx-auto mt-4 h-20 w-20 rounded-full object-cover" /></div>
          </div>

          <div className="mt-6 space-y-3 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
            <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse"><span className="text-[var(--knoux-text-muted)]">{t('Founder & architect', 'المؤسس والمهندس')}</span><span className="font-extrabold text-[var(--knoux-text)]">Eng. Sadek Elgazar — Knoux</span></div>
            <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse"><span className="text-[var(--knoux-text-muted)]">{t('Location', 'الموقع')}</span><span className="font-extrabold text-[var(--knoux-text)]">Abu Dhabi, UAE</span></div>
            <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse"><span className="text-[var(--knoux-text-muted)]">{t('Product structure', 'هيكل المنتج')}</span><span className="font-extrabold text-[var(--knoux-text)]">19 Workspaces • 190 Services</span></div>
            <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse"><span className="text-[var(--knoux-text-muted)]">{t('Tagline', 'الشعار النصي')}</span><span className="font-extrabold text-[var(--knoux-primary-bright)]">Build • Protect • Optimize</span></div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={() => setCurrentRoute('brand-gallery')} className="knoux-card-action knoux-card-action--primary"><ImageIcon className="h-4 w-4" />{t('Open brand gallery', 'فتح معرض الهوية')}</button>
            <a href={OFFICIAL_KNOUX_ASSETS.website} target="_blank" rel="noreferrer" className="knoux-card-action"><Globe className="h-4 w-4" />knoux.store<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" /></a>
          </div>
        </article>
      </section>

      <section className="knoux-glass-panel flex items-start gap-3 p-5 rtl:flex-row-reverse">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--knoux-success)]" />
        <div><h3 className="text-[13px] font-extrabold text-[var(--knoux-text)]">{t('Product status is represented honestly', 'حالة المنتج معروضة بصدق')}</h3><p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t('This page does not claim an enterprise license, cloud connection, or completed native service unless the corresponding implementation is verified.', 'لا تدعي هذه الصفحة وجود ترخيص مؤسسي أو اتصال سحابي أو خدمة محلية مكتملة ما لم يكن التنفيذ المقابل موثقًا.')}</p></div>
      </section>
    </div>
  );
};
