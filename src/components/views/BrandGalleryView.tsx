/**
 * KNOUX ONE — Official Visual Reference Gallery & Brand Asset Showcase
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { OFFICIAL_LOGOS, VISUAL_GALLERY_ASSETS, GalleryAsset } from '../../data/brandAssets';
import { 
  Image as ImageIcon, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  X, 
  Sparkles, 
  Check, 
  Copy, 
  Sun, 
  Moon, 
  Layers 
} from 'lucide-react';

export const BrandGalleryView: React.FC = () => {
  const { theme, t } = useKnoux();
  const [selectedAsset, setSelectedAsset] = useState<GalleryAsset | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>('all');

  const currentLogo = theme === 'dark' ? OFFICIAL_LOGOS.night : OFFICIAL_LOGOS.day;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const filteredAssets = VISUAL_GALLERY_ASSETS.filter(item => {
    if (filterModule === 'all') return true;
    return item.moduleId === filterModule;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--knoux-border)] pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded-md bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-primary)] text-xs font-mono mb-1.5">
            <ImageIcon className="w-3.5 h-3.5" />
            <span>OFFICIAL BRANDING • LOGOS & 19 VISUAL REFERENCES</span>
          </div>
          <h1 className="knoux-hero-title">
            {t('Official Visual Gallery & Identity', 'معرض المراجع البصرية والهوية الرسمية')}
          </h1>
          <p className="knoux-body mt-1">
            {t(
              'Explore official KNOUX ONE high-resolution branding assets, night/day logos, and 19 visual reference screenshots.',
              'استعرض الشعارات الرسمية بالنمطين الفاتح والداكن وجميع المراجع البصرية الـ 19 للتطبيق.'
            )}
          </p>
        </div>
      </div>

      {/* Official Logos Section */}
      <div className="space-y-4">
        <h2 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
          <Sparkles className="w-4 h-4 text-[var(--knoux-primary)]" />
          <span>{t('4.1 & 4.2 Official Identity Logos (Night & Day)', '4.1 و 4.2 الشعارات الرسمية للنظام (الداكن والفاتح)')}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Night Logo Card */}
          <div className="p-5 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4 relative group">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center space-x-1 rtl:space-x-reverse text-xs px-2 py-0.5 rounded bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-primary)] font-mono font-bold">
                  <Moon className="w-3 h-3" />
                  <span>DARK MODE LOGO (4.1)</span>
                </span>
                <h3 className="font-bold text-base text-[var(--knoux-text)] mt-1.5">{OFFICIAL_LOGOS.night.nameEn}</h3>
              </div>
              <button
                onClick={() => handleCopy(OFFICIAL_LOGOS.night.remoteUrl)}
                className="knoux-button-secondary text-xs"
              >
                {copiedUrl === OFFICIAL_LOGOS.night.remoteUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === OFFICIAL_LOGOS.night.remoteUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            {/* Logo Image Box */}
            <div className="p-6 rounded-xl bg-[#08031A] border border-[var(--knoux-border)] flex items-center justify-center min-h-[160px] overflow-hidden">
              <img
                src={OFFICIAL_LOGOS.night.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.night.remoteUrl; }}
                alt="Knoux One Night Logo"
                className="max-h-28 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Usage Specs */}
            <div className="space-y-1.5">
              <span className="text-sm font-mono text-[var(--knoux-primary)] block font-bold">{t('Designated Usage:', 'الاستخدامات المخصصة:')}</span>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_LOGOS.night.usage.map((use, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-text-secondary)] font-mono">
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Day Logo Card */}
          <div className="p-5 rounded-2xl knoux-depth-3 border border-[var(--knoux-glass-border)] space-y-4 relative group">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center space-x-1 rtl:space-x-reverse text-xs px-2 py-0.5 rounded bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-warning)] font-mono font-bold">
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>LIGHT MODE LOGO (4.2)</span>
                </span>
                <h3 className="font-bold text-base text-[var(--knoux-text)] mt-1.5">{OFFICIAL_LOGOS.day.nameEn}</h3>
              </div>
              <button
                onClick={() => handleCopy(OFFICIAL_LOGOS.day.remoteUrl)}
                className="knoux-button-secondary text-xs"
              >
                {copiedUrl === OFFICIAL_LOGOS.day.remoteUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === OFFICIAL_LOGOS.day.remoteUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            {/* Logo Image Box */}
            <div className="p-6 rounded-xl bg-[#F5F7FC] border border-[var(--knoux-border)] flex items-center justify-center min-h-[160px] overflow-hidden">
              <img
                src={OFFICIAL_LOGOS.day.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.day.remoteUrl; }}
                alt="Knoux One Day Logo"
                className="max-h-28 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Usage Specs */}
            <div className="space-y-1.5">
              <span className="text-sm font-mono text-[var(--knoux-primary)] block font-bold">{t('Designated Usage:', 'الاستخدامات المخصصة:')}</span>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_LOGOS.day.usage.map((use, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-md bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)] text-[var(--knoux-text-secondary)] font-mono">
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Reference Gallery Section */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="knoux-section-title flex items-center space-x-2 rtl:space-x-reverse">
            <Layers className="w-4 h-4 text-[var(--knoux-accent-blue)]" />
            <span>{t('4.3 Official Visual Reference Gallery (19 References)', '4.3 المعرض البصري المرجعي الشامل (19 صورة)')}</span>
          </h2>

          <div className="text-xs font-mono text-[var(--knoux-primary)]">
            Total Images: <strong className="text-[var(--knoux-text)]">{VISUAL_GALLERY_ASSETS.length}</strong> High-Res References
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className="p-3.5 rounded-2xl knoux-card cursor-pointer group flex flex-col justify-between space-y-3"
            >
              {/* Image Preview Window */}
              <div className="relative rounded-xl overflow-hidden bg-[var(--knoux-surface-muted)] aspect-video border border-[var(--knoux-border)] flex items-center justify-center">
                <img
                  src={asset.localPath}
                  onError={(e) => { (e.target as HTMLImageElement).src = asset.remoteUrl; }}
                  alt={asset.titleEn}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  <span className="p-2 rounded-full bg-[var(--knoux-primary)] text-white shadow-lg">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </div>
                <div className="absolute top-2 left-2 rtl:right-2 rtl:left-auto px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-white text-xs font-mono border border-white/20">
                  {asset.id.toUpperCase()}
                </div>
              </div>

              {/* Text Info */}
              <div className="space-y-1">
                <span className="text-xs text-[var(--knoux-primary)] font-mono block font-bold">
                  {t(asset.moduleNameEn, asset.moduleNameAr)}
                </span>
                <h3 className="text-xs font-bold text-[var(--knoux-text)] line-clamp-1 group-hover:text-[var(--knoux-primary)] transition-colors">
                  {t(asset.titleEn, asset.titleAr)}
                </h3>
                <p className="text-sm text-[var(--knoux-text-muted)] line-clamp-2 leading-relaxed">
                  {t(asset.descriptionEn, asset.descriptionAr)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-5xl w-full knoux-depth-5 border border-[var(--knoux-glass-border-strong)] rounded-2xl overflow-hidden shadow-2xl space-y-4 p-6 relative">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 rtl:left-4 rtl:right-auto p-2 rounded-xl bg-[var(--knoux-surface-muted)] hover:bg-[var(--knoux-surface-elevated)] border border-[var(--knoux-border)] text-[var(--knoux-text)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-12 rtl:pl-12 rtl:pr-0">
              <span className="text-xs text-[var(--knoux-primary)] font-mono font-bold">{selectedAsset.id.toUpperCase()} • {t(selectedAsset.moduleNameEn, selectedAsset.moduleNameAr)}</span>
              <h2 className="text-lg font-extrabold text-[var(--knoux-text)]">{t(selectedAsset.titleEn, selectedAsset.titleAr)}</h2>
              <p className="text-xs text-[var(--knoux-text-muted)]">{t(selectedAsset.descriptionEn, selectedAsset.descriptionAr)}</p>
            </div>

            {/* High Res Image */}
            <div className="rounded-xl overflow-hidden bg-black/60 border border-[var(--knoux-border)] max-h-[60vh] flex items-center justify-center">
              <img
                src={selectedAsset.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = selectedAsset.remoteUrl; }}
                alt={selectedAsset.titleEn}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono">
              <span className="text-[var(--knoux-text-muted)]">URL: <code className="text-[var(--knoux-primary)]">{selectedAsset.remoteUrl}</code></span>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <button
                  onClick={() => handleCopy(selectedAsset.remoteUrl)}
                  className="knoux-button-secondary text-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUrl === selectedAsset.remoteUrl ? 'Copied Link' : 'Copy Direct Link'}</span>
                </button>
                <a
                  href={selectedAsset.remoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="knoux-button-primary text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Resolution</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

