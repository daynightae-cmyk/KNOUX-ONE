import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { Info, Image as ImageIcon, Globe, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { OFFICIAL_KNOUX_ASSETS, getOfficialKnouxLogo } from '../../data/officialBrand';

export const AboutView: React.FC = () => {
  const { t, theme, setCurrentRoute } = useKnoux();
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="mb-8">
        <h1 className="text-[28px] font-black tracking-[-.04em] text-[var(--knoux-text)]">
          {t('About KNOUX ONE', 'عن كنوكس ون')}
        </h1>
        <p className="mt-2 text-[14px] font-semibold text-[var(--knoux-text-muted)]">
          {t('Product identity and architecture', 'هوية المنتج ومعماريته')}
        </p>
      </header>

      <article className="knoux-glass-panel p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 rtl:flex-row-reverse">
            <div className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-[var(--knoux-glass-border-strong)] bg-[var(--knoux-surface-elevated)]">
              {!logoFailed ? <img src={getOfficialKnouxLogo(theme)} onError={() => setLogoFailed(true)} alt="KNOUX ONE" className="h-full w-full object-cover" /> : <span className="text-xl font-black text-[var(--knoux-primary-bright)]">K</span>}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[var(--knoux-primary-bright)]">A Knoux Product</p>
              <h2 className="mt-1 text-[24px] font-black tracking-[-.035em] text-[var(--knoux-text)]">KNOUX ONE</h2>
              <p className="mt-1 text-[12px] font-semibold text-[var(--knoux-text-muted)]">Windows Intelligence & Developer Suite</p>
            </div>
          </div>
          <Info className="h-5 w-5 text-[var(--knoux-text-muted)]" />
        </div>
        <p className="mt-6 text-[13px] font-medium leading-7 text-[var(--knoux-text-secondary)]">
          {t('A professional Windows workspace that organizes system care, security, recovery, applications, automation, developer tools, diagnostics, and hardware inspection into 19 focused areas with 190 registered services.', 'مساحة عمل احترافية لويندوز تنظم العناية بالنظام والأمان والاستعادة والبرامج والأتمتة وأدوات المطور والتشخيص وفحص المكونات داخل 19 مجالًا مركزًا يضم 190 خدمة مسجلة.')}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--knoux-border)] bg-[#070A12] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-violet-300">{t('Official night logo', 'الشعار الليلي الرسمي')}</p>
            <img src={OFFICIAL_KNOUX_ASSETS.nightLogo} alt="KNOUX ONE Night" className="mx-auto mt-4 h-20 w-20 rounded-full object-cover" />
          </div>
          <div className="rounded-2xl border border-[var(--knoux-border)] bg-[#F5F7FC] p-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[#7545e8]">{t('Official day logo', 'الشعار النهاري الرسمي')}</p>
            <img src={OFFICIAL_KNOUX_ASSETS.dayLogo} alt="KNOUX ONE Day" className="mx-auto mt-4 h-20 w-20 rounded-full object-cover" />
          </div>
        </div>
        <div className="mt-6 space-y-3 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
          <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse">
            <span className="text-[var(--knoux-text-muted)]">{t('Founder & architect', 'المؤسس والمهندس')}</span>
            <span className="font-extrabold text-[var(--knoux-text)]">Eng. Sadek Elgazar — Knoux</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse">
            <span className="text-[var(--knoux-text-muted)]">{t('Location', 'الموقع')}</span>
            <span className="font-extrabold text-[var(--knoux-text)]">Abu Dhabi, UAE</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse">
            <span className="text-[var(--knoux-text-muted)]">{t('Product structure', 'هيكل المنتج')}</span>
            <span className="font-extrabold text-[var(--knoux-text)]">19 Workspaces • 190 Services</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-[12px] rtl:flex-row-reverse">
            <span className="text-[var(--knoux-text-muted)]">{t('Tagline', 'الشعار النصي')}</span>
            <span className="font-extrabold text-[var(--knoux-primary-bright)]">Build • Protect • Optimize</span>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => setCurrentRoute('brand-gallery')} className="knoux-card-action knoux-card-action--primary">
            <ImageIcon className="h-4 w-4" />{t('Open brand gallery', 'فتح معرض الهوية')}
          </button>
          <a href={OFFICIAL_KNOUX_ASSETS.website} target="_blank" rel="noreferrer" className="knoux-card-action">
            <Globe className="h-4 w-4" />knoux.store<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </a>
        </div>
      </article>
      
      <section className="knoux-glass-panel flex items-start gap-3 p-5 rtl:flex-row-reverse">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--knoux-success)]" />
        <div>
          <h3 className="text-[13px] font-extrabold text-[var(--knoux-text)]">{t('Product status is represented honestly', 'حالة المنتج معروضة بصدق')}</h3>
          <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">
            {t('This page does not claim an enterprise license, cloud connection, or completed native service unless the corresponding implementation is verified.', 'لا تدعي هذه الصفحة وجود ترخيص مؤسسي أو اتصال سحابي أو خدمة محلية مكتملة ما لم يكن التنفيذ المقابل موثقًا.')}
          </p>
        </div>
      </section>
    </div>
  );
};
