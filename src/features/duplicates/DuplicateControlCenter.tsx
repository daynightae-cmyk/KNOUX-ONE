/**
 * KNOUX ONE — Module 03 Duplicate Control Center Main Component
 */
import React from 'react';
import {
  Copy,
  Sliders,
  FolderSearch,
  Layers,
  ShieldAlert,
  History,
  Play,
  RotateCcw,
  CheckCircle2,
  Trash2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useDuplicateStore } from './duplicateStore';
import { DuplicateScanSetup } from './DuplicateScanSetup';
import { DuplicateResultsWorkspace } from './DuplicateResultsWorkspace';
import { DuplicateMediaCompare } from './DuplicateMediaCompare';
import { DuplicateKeeperRules } from './DuplicateKeeperRules';
import { DuplicateQuarantineView } from './DuplicateQuarantineView';
import { DuplicateHistoryView } from './DuplicateHistoryView';
import { useTranslation } from '../../i18n';
import { formatBytes } from './duplicateFormatters';

export function DuplicateControlCenter() {
  const { t } = useTranslation();
  const store = useDuplicateStore();

  const totalWastedBytes = store.duplicateGroups.reduce((acc, g) => acc + g.wastedSizeBytes, 0);
  const totalDuplicateFiles = store.duplicateGroups.reduce((acc, g) => acc + (g.files.length - 1), 0);

  return (
    <div className="knoux-page-container space-y-6">
      {/* Module Banner */}
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="knoux-eyebrow text-blue-400">
              <Copy className="h-4 w-4" />
              {t('Module 03 — Duplicate Control Center', 'الوحدة 03 — مركز التحكم بالملفات المكررة')}
            </div>
            <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-black text-[var(--knoux-text)]">
              {t('Byte-Exact Duplicate & Similarity Engine', 'محرك المكررات والمطابقة بالبصمة الرقمية')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--knoux-subtext)]">
              {t(
                'Detect byte-for-byte identical files with BLAKE3 cryptographic hashing, similar images via perceptual matching, duplicate videos, audio fingerprints, and managed safe quarantine.',
                'اكتشاف الملفات المتطابقة بالبصمة الرقمية الفائقة BLAKE3 ومقارنة الصور والمستندات بآمان عبر المحجر المحلي.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {store.activeTab !== 'setup' && (
              <button
                onClick={() => store.setActiveTab('setup')}
                className="knoux-btn-secondary inline-flex items-center gap-2 text-sm"
              >
                <FolderSearch className="h-4 w-4 text-blue-400" />
                {t('Configure Scan', 'إعداد الفحص')}
              </button>
            )}

            <button
              onClick={store.startScan}
              disabled={store.isScanning}
              className="knoux-btn-primary inline-flex items-center gap-2 text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/20"
            >
              <Play className={`h-4 w-4 ${store.isScanning ? 'animate-spin' : ''}`} />
              {store.isScanning ? t('Scanning Drives...', 'جاري فحص الأقراص...') : t('Run Smart Scan', 'تشغيل الفحص الذكي')}
            </button>
          </div>
        </div>

        {/* Dynamic Metric Bar */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--knoux-glass-border)] pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Duplicate Groups', 'المجموعات المكررة')}</span>
            <p className="mt-1 text-xl font-bold text-[var(--knoux-text)]">{store.duplicateGroups.length}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Redundant Files', 'الملفات المكررة')}</span>
            <p className="mt-1 text-xl font-bold text-amber-400">{totalDuplicateFiles}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Recoverable Space', 'المساحة القابلة للاسترداد')}</span>
            <p className="mt-1 text-xl font-bold text-emerald-400">{formatBytes(totalWastedBytes)}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Quarantined Vault', 'المحجر الآمن')}</span>
            <p className="mt-1 text-xl font-bold text-purple-400">{store.quarantineRecords.length} {t('items', 'عنصر')}</p>
          </div>
        </div>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[var(--knoux-border)] overflow-x-auto gap-2 scrollbar-none pb-1">
        <button
          onClick={() => store.setActiveTab('setup')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'setup'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <FolderSearch className="h-4 w-4" />
          {t('Scan Setup & Rules', 'إعدادات الفحص والقواعد')}
        </button>

        <button
          onClick={() => store.setActiveTab('results')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'results'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Layers className="h-4 w-4" />
          {t('Results Workspace', 'مسار نتائج الفحص')}
          {store.duplicateGroups.length > 0 && (
            <span className="ms-1 px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-300 font-bold">
              {store.duplicateGroups.length}
            </span>
          )}
        </button>

        <button
          onClick={() => store.setActiveTab('compare')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'compare'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Copy className="h-4 w-4" />
          {t('Side-by-Side Visual Compare', 'مقارنة الصور والملفات جنباً لجنب')}
        </button>

        <button
          onClick={() => store.setActiveTab('keeper')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'keeper'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Sliders className="h-4 w-4" />
          {t('Keeper Auto-Rules', 'قواعد الاختيار التلقائي')}
        </button>

        <button
          onClick={() => store.setActiveTab('quarantine')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'quarantine'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          {t('Quarantine Vault', 'المحجر الآمن')}
          {store.quarantineRecords.length > 0 && (
            <span className="ms-1 px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 font-bold">
              {store.quarantineRecords.length}
            </span>
          )}
        </button>

        <button
          onClick={() => store.setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'history'
              ? 'border-blue-500 text-blue-400 bg-blue-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <History className="h-4 w-4" />
          {t('Scan History', 'سجل الفحوصات')}
        </button>
      </div>

      {/* Active Tab View */}
      <div className="mt-4">
        {store.activeTab === 'setup' && <DuplicateScanSetup store={store} />}
        {store.activeTab === 'results' && <DuplicateResultsWorkspace store={store} />}
        {store.activeTab === 'compare' && <DuplicateMediaCompare store={store} />}
        {store.activeTab === 'keeper' && <DuplicateKeeperRules store={store} />}
        {store.activeTab === 'quarantine' && <DuplicateQuarantineView store={store} />}
        {store.activeTab === 'history' && <DuplicateHistoryView store={store} />}
      </div>
    </div>
  );
}
