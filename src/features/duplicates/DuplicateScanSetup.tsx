/**
 * KNOUX ONE — Module 03 Scan Setup Panel
 */
import React, { useState } from 'react';
import {
  FolderPlus,
  FolderMinus,
  Settings,
  Sparkles,
  Zap,
  Image,
  Video,
  FileText,
  Archive,
  FolderTree,
  Shield,
  Play
} from 'lucide-react';
import { useTranslation } from '../../i18n';
import { DuplicateScanMode } from './duplicateContracts';

export function DuplicateScanSetup({ store }: { store: any }) {
  const { t } = useTranslation();
  const [newFolderPath, setNewFolderPath] = useState('');

  const addFolder = () => {
    if (!newFolderPath.trim()) return;
    store.setScanConfig((prev: any) => ({
      ...prev,
      targetPaths: [...prev.targetPaths, newFolderPath.trim()],
    }));
    setNewFolderPath('');
  };

  const removeFolder = (index: number) => {
    store.setScanConfig((prev: any) => ({
      ...prev,
      targetPaths: prev.targetPaths.filter((_: any, i: number) => i !== index),
    }));
  };

  const scanModes: { mode: DuplicateScanMode; icon: any; titleEn: string; titleAr: string; descEn: string; descAr: string }[] = [
    {
      mode: 'exact_blake3',
      icon: Zap,
      titleEn: 'Exact BLAKE3 Cryptographic Scan',
      titleAr: 'الفحص الرقمي المطلق BLAKE3',
      descEn: 'Byte-for-byte matching using multi-threaded cryptographic hash comparison.',
      descAr: 'مطابقة تامة للملفات بالبصمة الرقمية الفائقة بأمان عالي.'
    },
    {
      mode: 'fast_partial',
      icon: Sparkles,
      titleEn: 'Fast Partial-Hash Acceleration',
      titleAr: 'فحص البصمة الجزئية السريعة',
      descEn: 'High-speed size grouping and initial head-block scan for multi-TB drives.',
      descAr: 'تسريع كاسح للأقراص الضخمة عبر فحص الأحجام ورؤوس الملفات.'
    },
    {
      mode: 'similar_images',
      icon: Image,
      titleEn: 'Perceptual Similar Image Match',
      titleAr: 'مطابقة الصور المتشابهة بصرياً',
      descEn: 'Detects resized, compressed, or slightly edited image duplicates.',
      descAr: 'اكتشاف الصور المتشابهة حتى في حال تغيير الأبعاد أو الضغط.'
    },
    {
      mode: 'video_streams',
      icon: Video,
      titleEn: 'Duplicate Video Stream Analyzer',
      titleAr: 'محلل مقاطع الفيديو المكررة',
      descEn: 'Compares video stream duration, resolution, and audio/video track fingerprints.',
      descAr: 'تحليل دقيق لملفات الفيديو والأبعاد والمقاطع المكررة.'
    },
    {
      mode: 'documents',
      icon: FileText,
      titleEn: 'Duplicate Document Matching',
      titleAr: 'فحص المستندات والملفات المكررة',
      descEn: 'Matches identical PDF, Word, Excel, and text document copies.',
      descAr: 'اكتشاف نسخ المستندات والملفات النصية المكررة.'
    },
    {
      mode: 'archives',
      icon: Archive,
      titleEn: 'Duplicate Archive Inspector',
      titleAr: 'فحص الملفات المضغوطة المكررة',
      descEn: 'Compares inner structures of ZIP, RAR, 7Z, and TAR archives.',
      descAr: 'مقارنة محتويات وأجزاء الملفات المضغوطة المكررة.'
    },
    {
      mode: 'folder_structures',
      icon: FolderTree,
      titleEn: 'Duplicate Folder Hierarchy Scanner',
      titleAr: 'فحص المجلدات المتطابقة بالكامل',
      descEn: 'Detects entire redundant folder trees across directory locations.',
      descAr: 'اكتشاف مجلدات كاملة مكررة بكافة مساراتها.'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Target Directories Panel */}
      <div className="xl:col-span-1 space-y-6">
        <div className="knoux-card p-6 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl">
          <h3 className="text-base font-bold text-[var(--knoux-text)] flex items-center gap-2">
            <FolderPlus className="h-5 w-5 text-blue-400" />
            {t('Target Folder Paths', 'مسارات المجلدات المستهدفة')}
          </h3>
          <p className="mt-1 text-xs text-[var(--knoux-subtext)]">
            {t('Select local drives or custom folders for deep duplicate analysis.', 'اختر الأقراص المحلية أو المجلدات للفحص العميق.')}
          </p>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={newFolderPath}
              onChange={e => setNewFolderPath(e.target.value)}
              placeholder="e.g. C:\Users\User\Pictures"
              className="knoux-input flex-1 text-xs"
            />
            <button onClick={addFolder} className="knoux-btn-primary px-3 text-xs flex items-center gap-1">
              <FolderPlus className="h-3.5 w-3.5" />
              {t('Add', 'إضافة')}
            </button>
          </div>

          <div className="mt-4 space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {store.scanConfig.targetPaths.map((pathStr: string, idx: number) => (
              <div key={idx} className="flex items-center justify-between rounded-lg bg-[var(--knoux-bg-soft)] p-2.5 text-xs border border-[var(--knoux-border)]">
                <span className="font-mono text-[var(--knoux-text)] truncate max-w-[200px]">{pathStr}</span>
                <button
                  onClick={() => removeFolder(idx)}
                  className="text-rose-400 hover:text-rose-300 p-1"
                  title={t('Remove', 'إزالة')}
                >
                  <FolderMinus className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="knoux-card p-6 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl">
          <h3 className="text-base font-bold text-[var(--knoux-text)] flex items-center gap-2">
            <Settings className="h-5 w-5 text-purple-400" />
            {t('Scan Constraints & Exclusions', 'محددات واستثناءات الفحص')}
          </h3>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[var(--knoux-subtext)] block mb-1">
                {t('Minimum File Size Filter', 'الحد الأدنى لحجم الملف')}
              </label>
              <select
                value={store.scanConfig.minSizeBytes}
                onChange={e => store.setScanConfig((prev: any) => ({ ...prev, minSizeBytes: Number(e.target.value) }))}
                className="knoux-select text-xs w-full"
              >
                <option value={0}>{t('All Files (0 KB+)', 'جميع الملفات (أكبر من 0 كيلوبايت)')}</option>
                <option value={1024}>{t('Files > 1 KB', 'أكبر من 1 كيلوبايت')}</option>
                <option value={1048576}>{t('Files > 1 MB', 'أكبر من 1 ميجابايت')}</option>
                <option value={10485760}>{t('Files > 10 MB', 'أكبر من 10 ميجابايت')}</option>
                <option value={104857600}>{t('Files > 100 MB', 'أكبر من 100 ميجابايت')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="subfolders"
                checked={store.scanConfig.includeSubfolders}
                onChange={e => store.setScanConfig((prev: any) => ({ ...prev, includeSubfolders: e.target.checked }))}
                className="rounded border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] text-blue-500"
              />
              <label htmlFor="subfolders" className="text-xs text-[var(--knoux-text)] cursor-pointer">
                {t('Recursively scan nested subfolders', 'فحص جميع المجلدات الفرعية بعمق')}
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Scan Mode Selection */}
      <div className="xl:col-span-2 space-y-4">
        <h3 className="text-base font-bold text-[var(--knoux-text)] flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          {t('Select Dedicated Scan Engine Mode', 'اختر نمط محرك الفحص المتخصص')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scanModes.map((item) => {
            const IconComp = item.icon;
            const isSelected = store.scanConfig.scanMode === item.mode;
            return (
              <div
                key={item.mode}
                onClick={() => store.setScanConfig((prev: any) => ({ ...prev, scanMode: item.mode }))}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                    : 'border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] hover:border-[var(--knoux-border-hover)]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-[var(--knoux-bg-soft)] text-blue-400'}`}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-[var(--knoux-text)]">
                      {t(item.titleEn, item.titleAr)}
                    </h4>
                    <p className="mt-1 text-xs text-[var(--knoux-subtext)] leading-snug">
                      {t(item.descEn, item.descAr)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={store.startScan}
            disabled={store.isScanning}
            className="knoux-btn-primary bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold px-8 py-3 rounded-xl shadow-xl shadow-blue-500/25 flex items-center gap-2 text-sm"
          >
            <Play className="h-5 w-5" />
            {t('Launch Selected Duplicate Scanner', 'بدء فحص المحرك المختار')}
          </button>
        </div>
      </div>
    </div>
  );
}
