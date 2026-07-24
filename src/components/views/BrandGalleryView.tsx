import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Layers3,
  Moon,
  Sparkles,
  Sun,
  X,
  ZoomIn,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_KNOUX_ASSETS, getOfficialKnouxLogo } from '../../data/officialBrand';
import { GalleryAsset, VISUAL_GALLERY_ASSETS } from '../../data/brandAssets';

interface LogoCardProps {
  mode: 'night' | 'day';
  copiedUrl: string | null;
  onCopy: (url: string) => void;
}

const LogoCard: React.FC<LogoCardProps> = ({ mode, copiedUrl, onCopy }) => {
  const { t } = useKnoux();
  const isNight = mode === 'night';
  const url = isNight ? OFFICIAL_KNOUX_ASSETS.nightLogo : OFFICIAL_KNOUX_ASSETS.dayLogo;
  const Icon = isNight ? Moon : Sun;

  return (
    <article className="knoux-glass-panel overflow-hidden p-5 md:p-6">
      <div
        className="absolute inset-x-0 top-0 h-32 opacity-70"
        style={{
          background: isNight
            ? 'radial-gradient(circle at 50% 0%, rgba(139,92,246,.24), transparent 68%)'
            : 'radial-gradient(circle at 50% 0%, rgba(124,58,237,.15), transparent 68%)',
        }}
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="knoux-eyebrow">
            <Icon className={`h-4 w-4 ${isNight ? '' : 'text-amber-500'}`} />
            {t(isNight ? 'Night identity' : 'Day identity', isNight ? 'الهوية الليلية' : 'الهوية النهارية')}
          </div>
          <h2 className="mt-2 text-[20px] font-black tracking-[-.025em] text-[var(--knoux-text)]">
            {t('Official circular KNOUX ONE logo', 'شعار KNOUX ONE الدائري الرسمي')}
          </h2>
          <p className="mt-2 max-w-md text-[12px] font-medium leading-6 text-[var(--knoux-text-muted)]">
            {t(
              'Used as a true circular product emblem with no square image card or legacy local fallback.',
              'يُستخدم كشعار منتج دائري حقيقي دون بطاقة صورة مربعة أو رجوع إلى ملف محلي قديم.',
            )}
          </p>
        </div>

        <button type="button" onClick={() => onCopy(url)} className="knoux-card-action shrink-0">
          {copiedUrl === url ? <Check className="h-4 w-4 text-[var(--knoux-success)]" /> : <Copy className="h-4 w-4" />}
          <span className="hidden sm:inline">{copiedUrl === url ? t('Copied', 'تم النسخ') : t('Copy URL', 'نسخ الرابط')}</span>
        </button>
      </div>

      <div className={`relative mt-7 rounded-[24px] border border-[var(--knoux-border)] p-7 ${isNight ? 'bg-[#070914]' : 'bg-[#f4f1ff]'}`}>
        <div className="knoux-official-logo-preview">
          <img src={`${url}?knoux_logo=2026-07-24.3`} alt={isNight ? 'KNOUX official night emblem' : 'KNOUX official day emblem'} />
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        <span className="knoux-chip">{t('Circular crop', 'قص دائري')}</span>
        <span className="knoux-chip">{t('Clear safe area', 'مساحة آمنة واضحة')}</span>
        <span className="knoux-chip">{t('Official source', 'المصدر الرسمي')}</span>
        <span className="knoux-chip knoux-chip--accent">{isNight ? 'Dark mode' : 'Light mode'}</span>
      </div>
    </article>
  );
};

export const BrandGalleryView: React.FC = () => {
  const { theme, t } = useKnoux();
  const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return VISUAL_GALLERY_ASSETS;

    return VISUAL_GALLERY_ASSETS.filter(asset =>
      [asset.titleEn, asset.titleAr, asset.moduleNameEn, asset.moduleNameAr, asset.descriptionEn, asset.descriptionAr]
        .some(value => value.toLowerCase().includes(normalized)),
    );
  }, [query]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(null), 1800);
  };

  return (
    <div className="knoux-page-container space-y-7">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[45%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,.16),transparent_68%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="knoux-eyebrow"><Sparkles className="h-4 w-4" />{t('Official identity', 'الهوية الرسمية')}</div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.2rem)] font-black leading-[1.08] tracking-[-.045em] text-[var(--knoux-text)]">
              {t('KNOUX ONE brand and visual references', 'هوية KNOUX ONE والمراجع البصرية')}
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] font-medium leading-7 text-[var(--knoux-text-secondary)]">
              {t('The new official night and day logos are the only identity sources used by this workspace.', 'الشعاران الرسميان الجديدان الليلي والنهاري هما مصدرا الهوية الوحيدان المستخدمان داخل مساحة العمل.')}
            </p>
          </div>

          <div className="knoux-official-logo-preview shrink-0">
            <img src={getOfficialKnouxLogo(theme)} alt="KNOUX ONE" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <LogoCard mode="night" copiedUrl={copiedUrl} onCopy={handleCopy} />
        <LogoCard mode="day" copiedUrl={copiedUrl} onCopy={handleCopy} />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Visual reference library', 'مكتبة المراجع البصرية')}</div>
            <h2 className="mt-2 text-[24px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Product reference collection', 'مجموعة مراجع المنتج')}</h2>
          </div>
          <div className="w-full md:w-[340px]">
            <label className="sr-only" htmlFor="brand-gallery-search">{t('Search visual references', 'البحث في المراجع البصرية')}</label>
            <input
              id="brand-gallery-search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t('Search references…', 'ابحث في المراجع…')}
              className="knoux-search-field px-4"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map(asset => (
            <button
              key={asset.id}
              type="button"
              onClick={() => setSelectedAsset(asset)}
              className="knoux-service-card group overflow-hidden p-3 text-start"
              data-accent="violet"
            >
              <div className="relative aspect-video overflow-hidden rounded-[14px] border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]">
                <img
                  src={asset.localPath}
                  onError={event => { event.currentTarget.src = asset.remoteUrl; }}
                  alt={asset.titleEn}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute end-3 top-3 grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-black/45 text-white backdrop-blur-md"><ZoomIn className="h-4 w-4" /></span>
              </div>
              <div className="p-2 pb-1 pt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--knoux-primary-bright)]">{t(asset.moduleNameEn, asset.moduleNameAr)}</p>
                <h3 className="mt-2 line-clamp-2 text-[15px] font-black leading-6 text-[var(--knoux-text)]">{t(asset.titleEn, asset.titleAr)}</h3>
                <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(asset.descriptionEn, asset.descriptionAr)}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedAsset && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-xl" role="dialog" aria-modal="true">
          <div className="knoux-glass-panel max-h-[90vh] w-full max-w-6xl overflow-hidden p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--knoux-primary-bright)]">{t(selectedAsset.moduleNameEn, selectedAsset.moduleNameAr)}</p>
                <h2 className="mt-1 text-[22px] font-black tracking-[-.025em] text-[var(--knoux-text)]">{t(selectedAsset.titleEn, selectedAsset.titleAr)}</h2>
              </div>
              <button type="button" onClick={() => setSelectedAsset(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-secondary)]"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 flex max-h-[65vh] items-center justify-center overflow-hidden rounded-2xl border border-[var(--knoux-border)] bg-black/45">
              <img src={selectedAsset.localPath} onError={event => { event.currentTarget.src = selectedAsset.remoteUrl; }} alt={selectedAsset.titleEn} className="max-h-[65vh] w-auto object-contain" />
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-3xl text-[12px] font-medium leading-6 text-[var(--knoux-text-muted)]">{t(selectedAsset.descriptionEn, selectedAsset.descriptionAr)}</p>
              <a href={selectedAsset.remoteUrl} target="_blank" rel="noreferrer" className="knoux-card-action knoux-card-action--primary"><ExternalLink className="h-4 w-4" />{t('Open original', 'فتح الأصل')}</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
