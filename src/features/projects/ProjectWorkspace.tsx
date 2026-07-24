/**
 * KNOUX ONE — Module 16 Code & Project Workspace Component
 */
import React from 'react';
import {
  FolderGit2,
  GitBranch,
  ShieldCheck,
  Trash2,
  Database,
  Send,
  Plus,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { useProjectStore } from './projectStore';
import { formatBytes } from '../duplicates/duplicateFormatters';
import { useTranslation } from '../../i18n';

export function ProjectWorkspace() {
  const { t } = useTranslation();
  const store = useProjectStore();

  const totalCacheBytes = store.buildCaches.reduce((acc, c) => acc + c.sizeBytes, 0);

  return (
    <div className="knoux-page-container space-y-6">
      {/* Header Banner */}
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15),transparent_70%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="knoux-eyebrow text-indigo-400">
              <FolderGit2 className="h-4 w-4" />
              {t('Module 16 — Code & Project Workspace', 'الوحدة 16 — مسار المشاريع والأكواد البرمجية')}
            </div>
            <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-black text-[var(--knoux-text)]">
              {t('Git Repository & Dependency Intelligence', 'إدارة المستودعات، التبعيات، والبناء')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--knoux-subtext)]">
              {t(
                'Manage Git repositories, project creation templates, security vulnerability audits, build cache cleanup (node_modules & target), data format converters, and HTTP API test workbench.',
                'إدارة مستودعات Git، قوالب إنشاء المشاريع، تدقيق الثغرات الأمنية للترخيص، تنظيف مخبأ البناء الضخم، وأدوات المطورين.'
              )}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--knoux-glass-border)] pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Active Repositories', 'المستودعات النشطة')}</span>
            <p className="mt-1 text-xl font-bold text-[var(--knoux-text)]">{store.repositories.length}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Build Cache Size', 'حجم كاش البناء')}</span>
            <p className="mt-1 text-xl font-bold text-indigo-400">{formatBytes(totalCacheBytes)}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Vulnerability Audit', 'فحص الثغرات')}</span>
            <p className="mt-1 text-xl font-bold text-emerald-400">{t('Clean', 'سليم')}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('API Workbench', 'منصة الاختبار')}</span>
            <p className="mt-1 text-xl font-bold text-purple-400">{t('Ready', 'جاهزة')}</p>
          </div>
        </div>
      </section>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-[var(--knoux-border)] overflow-x-auto gap-2 scrollbar-none pb-1">
        <button
          onClick={() => store.setActiveTab('repos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'repos'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <FolderGit2 className="h-4 w-4" />
          {t('Git Repositories', 'مستودعات Git')}
        </button>

        <button
          onClick={() => store.setActiveTab('caches')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'caches'
              ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Trash2 className="h-4 w-4" />
          {t('Build Cache Cleaner', 'تنظيف كاش البناء')}
        </button>
      </div>

      {/* Repos View */}
      {store.activeTab === 'repos' && (
        <div className="space-y-4">
          {store.repositories.map((repo) => (
            <div key={repo.id} className="knoux-card p-5 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base text-[var(--knoux-text)]">{repo.name}</span>
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {repo.branch}
                  </span>
                </div>
                <div className="text-xs font-mono text-[var(--knoux-subtext)] mt-1">{repo.path}</div>
                {repo.lastCommitMessage && (
                  <p className="text-xs text-[var(--knoux-subtext)] italic mt-2">
                    "{repo.lastCommitMessage}"
                  </p>
                )}
              </div>

              <div className="text-end">
                <span className="text-xs font-bold text-emerald-400">{t('Synchronized', 'محدث')}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Build Cache View */}
      {store.activeTab === 'caches' && (
        <div className="knoux-card border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl overflow-hidden divide-y divide-[var(--knoux-border)]">
          {store.buildCaches.map((cache) => (
            <div key={cache.id} className="p-4 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[var(--knoux-text)]">{cache.projectName}</span>
                <span className="ms-2 font-mono text-purple-400">({cache.cacheType})</span>
                <div className="text-[11px] font-mono text-[var(--knoux-subtext)] mt-0.5">{cache.path}</div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-[var(--knoux-text)] text-sm">{formatBytes(cache.sizeBytes)}</span>
                <button
                  onClick={() => store.cleanBuildCache(cache.id)}
                  className="knoux-btn-secondary py-1 px-3 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('Clean Cache', 'تنظيف الكاش')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
