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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-purple-900/40 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 rtl:space-x-reverse px-2.5 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 text-xs font-mono mb-1">
            <ImageIcon className="w-3.5 h-3.5 text-[#8226EE]" />
            <span>OFFICIAL BRANDING • LOGOS & 19 VISUAL REFERENCES</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">
            {t('Official Visual Gallery & Identity', 'معرض المراجع البصرية والهوية الرسمية')}
          </h1>
          <p className="text-xs text-gray-300 mt-1">
            {t(
              'Explore official KNOUX ONE high-resolution branding assets, night/day logos, and 19 visual reference screenshots.',
              'استعرض الشعارات الرسمية بالنمطين الفاتح والداكن وجميع المراجع البصرية الـ 19 للتطبيق.'
            )}
          </p>
        </div>
      </div>

      {/* Official Logos Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
          <Sparkles className="w-4 h-4 text-[#8226EE]" />
          <span>{t('4.1 & 4.2 Official Identity Logos (Night & Day)', '4.1 و 4.2 الشعارات الرسمية للنظام (الداكن والفاتح)')}</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Night Logo Card */}
          <div className="p-5 rounded-2xl bg-[#08031A] border border-purple-900/50 space-y-4 relative group">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center space-x-1 rtl:space-x-reverse text-[10px] px-2 py-0.5 rounded bg-purple-950 border border-purple-800 text-purple-300 font-mono">
                  <Moon className="w-3 h-3 text-purple-400" />
                  <span>DARK MODE LOGO (4.1)</span>
                </span>
                <h3 className="font-bold text-base text-white mt-1">{OFFICIAL_LOGOS.night.nameEn}</h3>
              </div>
              <button
                onClick={() => handleCopy(OFFICIAL_LOGOS.night.remoteUrl)}
                className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 text-xs font-mono flex items-center space-x-1 rtl:space-x-reverse"
              >
                {copiedUrl === OFFICIAL_LOGOS.night.remoteUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === OFFICIAL_LOGOS.night.remoteUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            {/* Logo Image Box */}
            <div className="p-6 rounded-xl bg-purple-950/20 border border-purple-900/30 flex items-center justify-center min-h-[160px] overflow-hidden">
              <img
                src={OFFICIAL_LOGOS.night.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.night.remoteUrl; }}
                alt="Knoux One Night Logo"
                className="max-h-28 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Usage Specs */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-purple-300 block font-bold">{t('Designated Usage:', 'الاستخدامات المخصصة:')}</span>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_LOGOS.night.usage.map((use, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/40 text-gray-300 font-mono">
                    {use}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Day Logo Card */}
          <div className="p-5 rounded-2xl bg-slate-900/40 border border-purple-900/50 space-y-4 relative group">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center space-x-1 rtl:space-x-reverse text-[10px] px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60 text-amber-300 font-mono">
                  <Sun className="w-3 h-3 text-amber-400" />
                  <span>LIGHT MODE LOGO (4.2)</span>
                </span>
                <h3 className="font-bold text-base text-white mt-1">{OFFICIAL_LOGOS.day.nameEn}</h3>
              </div>
              <button
                onClick={() => handleCopy(OFFICIAL_LOGOS.day.remoteUrl)}
                className="p-1.5 rounded-lg bg-purple-950/80 hover:bg-purple-900 border border-purple-800 text-purple-300 text-xs font-mono flex items-center space-x-1 rtl:space-x-reverse"
              >
                {copiedUrl === OFFICIAL_LOGOS.day.remoteUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedUrl === OFFICIAL_LOGOS.day.remoteUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            {/* Logo Image Box */}
            <div className="p-6 rounded-xl bg-slate-200 flex items-center justify-center min-h-[160px] overflow-hidden">
              <img
                src={OFFICIAL_LOGOS.day.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = OFFICIAL_LOGOS.day.remoteUrl; }}
                alt="Knoux One Day Logo"
                className="max-h-28 object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Usage Specs */}
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-purple-300 block font-bold">{t('Designated Usage:', 'الاستخدامات المخصصة:')}</span>
              <div className="flex flex-wrap gap-1.5">
                {OFFICIAL_LOGOS.day.usage.map((use, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-purple-950/60 border border-purple-800/40 text-gray-300 font-mono">
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
          <h2 className="text-sm font-bold text-white font-mono flex items-center space-x-2 rtl:space-x-reverse">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span>{t('4.3 Official Visual Reference Gallery (19 References)', '4.3 المعرض البصري المرجعي الشامل (19 صورة)')}</span>
          </h2>

          <div className="text-xs font-mono text-purple-300">
            Total Images: <strong className="text-white">{VISUAL_GALLERY_ASSETS.length}</strong> High-Res References
          </div>
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map(asset => (
            <div
              key={asset.id}
              onClick={() => setSelectedAsset(asset)}
              className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-900/40 hover:border-[#8226EE]/60 transition-all duration-200 cursor-pointer group flex flex-col justify-between space-y-3"
            >
              {/* Image Preview Window */}
              <div className="relative rounded-xl overflow-hidden bg-purple-950/40 aspect-video border border-purple-900/30 flex items-center justify-center">
                <img
                  src={asset.localPath}
                  onError={(e) => { (e.target as HTMLImageElement).src = asset.remoteUrl; }}
                  alt={asset.titleEn}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-purple-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                  <span className="p-2 rounded-full bg-[#8226EE] text-white shadow-lg">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </div>
                <div className="absolute top-2 left-2 rtl:right-2 rtl:left-auto px-2 py-0.5 rounded bg-black/70 backdrop-blur-md text-white text-[10px] font-mono border border-purple-800/50">
                  {asset.id.toUpperCase()}
                </div>
              </div>

              {/* Text Info */}
              <div className="space-y-1">
                <span className="text-[10px] text-[#8226EE] font-mono block font-bold">
                  {t(asset.moduleNameEn, asset.moduleNameAr)}
                </span>
                <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">
                  {t(asset.titleEn, asset.titleAr)}
                </h3>
                <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                  {t(asset.descriptionEn, asset.descriptionAr)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-5xl w-full bg-[#0D042B] border border-purple-800 rounded-2xl overflow-hidden shadow-2xl space-y-4 p-6 relative">
            <button
              onClick={() => setSelectedAsset(null)}
              className="absolute top-4 right-4 rtl:left-4 rtl:right-auto p-2 rounded-xl bg-purple-950 hover:bg-purple-900 border border-purple-800 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 pr-12 rtl:pl-12 rtl:pr-0">
              <span className="text-xs text-[#8226EE] font-mono font-bold">{selectedAsset.id.toUpperCase()} • {t(selectedAsset.moduleNameEn, selectedAsset.moduleNameAr)}</span>
              <h2 className="text-lg font-extrabold text-white">{t(selectedAsset.titleEn, selectedAsset.titleAr)}</h2>
              <p className="text-xs text-gray-300">{t(selectedAsset.descriptionEn, selectedAsset.descriptionAr)}</p>
            </div>

            {/* High Res Image */}
            <div className="rounded-xl overflow-hidden bg-black/60 border border-purple-900/50 max-h-[60vh] flex items-center justify-center">
              <img
                src={selectedAsset.localPath}
                onError={(e) => { (e.target as HTMLImageElement).src = selectedAsset.remoteUrl; }}
                alt={selectedAsset.titleEn}
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-mono">
              <span className="text-gray-400">URL: <code className="text-purple-300">{selectedAsset.remoteUrl}</code></span>
              <div className="flex items-center space-x-2 rtl:space-x-reverse">
                <button
                  onClick={() => handleCopy(selectedAsset.remoteUrl)}
                  className="px-3 py-1.5 rounded-lg bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-200 flex items-center space-x-1.5 rtl:space-x-reverse"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedUrl === selectedAsset.remoteUrl ? 'Copied Link' : 'Copy Direct Link'}</span>
                </button>
                <a
                  href={selectedAsset.remoteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#8226EE] hover:bg-purple-600 text-white font-bold flex items-center space-x-1.5 rtl:space-x-reverse"
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
