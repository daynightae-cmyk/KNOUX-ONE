/**
 * KNOUX ONE — Module 15 Developer Studio Component
 */
import React from 'react';
import {
  Code2,
  Terminal,
  GitBranch,
  Cpu,
  Network,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Zap,
  Trash2
} from 'lucide-react';
import { useDeveloperStore } from './developerStore';
import { useTranslation } from '../../i18n';

export function DeveloperStudio() {
  const { t } = useTranslation();
  const store = useDeveloperStore();

  const installedCount = store.toolchains.filter(t => t.installed).length;

  return (
    <div className="knoux-page-container space-y-6">
      {/* Header Banner */}
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.15),transparent_70%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="knoux-eyebrow text-purple-400">
              <Code2 className="h-4 w-4" />
              {t('Module 15 — Developer Environment Studio', 'الوحدة 15 — استوديو بيئة التطوير والبرمجة')}
            </div>
            <h1 className="mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-black text-[var(--knoux-text)]">
              {t('Full-Stack Toolchain & Runtime Hub', 'مركز أعداء ومحركات التطوير والبرمجة')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--knoux-subtext)]">
              {t(
                'Audit runtimes (Node.js, Python, Rust, Go, .NET), PATH environment variables, global Git parameters, listening dev ports, and process resource utilization.',
                'استكشاف وتدقيق بيئات التشغيل، متغيرات بيئة النظام PATH، إعدادات Git، المنافذ النشطة للبرامج، وإدارة العمليات.'
              )}
            </p>
          </div>

          <button
            onClick={store.refreshDiagnostics}
            disabled={store.isLoading}
            className="knoux-btn-primary inline-flex items-center gap-2 text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-lg shadow-purple-500/20"
          >
            <RotateCcw className={`h-4 w-4 ${store.isLoading ? 'animate-spin' : ''}`} />
            {t('Audit Environment', 'تدقيق البيئة')}
          </button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--knoux-glass-border)] pt-5 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Installed Toolchains', 'الأدوات المثبتة')}</span>
            <p className="mt-1 text-xl font-bold text-emerald-400">{installedCount} / {store.toolchains.length}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Active Dev Ports', 'المنافذ النشطة')}</span>
            <p className="mt-1 text-xl font-bold text-blue-400">{store.activePorts.length}</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('Git Status', 'حالة أداة Git')}</span>
            <p className="mt-1 text-xl font-bold text-purple-400">v2.43.0</p>
          </div>
          <div className="rounded-xl bg-[var(--knoux-bg-soft)] p-3.5 border border-[var(--knoux-border)]">
            <span className="text-xs font-medium text-[var(--knoux-subtext)]">{t('PATH Environment', 'متغيرات PATH')}</span>
            <p className="mt-1 text-xl font-bold text-indigo-400">{t('Clean', 'نظيفة')}</p>
          </div>
        </div>
      </section>

      {/* Sub Tabs */}
      <div className="flex border-b border-[var(--knoux-border)] overflow-x-auto gap-2 scrollbar-none pb-1">
        <button
          onClick={() => store.setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'overview'
              ? 'border-purple-500 text-purple-400 bg-purple-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Code2 className="h-4 w-4" />
          {t('Toolchain Matrix', 'مصفوفة أدوات التطوير')}
        </button>

        <button
          onClick={() => store.setActiveTab('ports')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${
            store.activeTab === 'ports'
              ? 'border-purple-500 text-purple-400 bg-purple-500/10'
              : 'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'
          }`}
        >
          <Network className="h-4 w-4" />
          {t('Active Listening Ports', 'المنافذ البرمجية النشطة')}
        </button>
      </div>

      {/* Overview Matrix View */}
      {store.activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {store.toolchains.map((item) => (
            <div key={item.id} className="knoux-card p-4 border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${item.installed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                  {item.installed ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--knoux-text)]">{item.name}</h4>
                  <p className="text-xs font-mono text-[var(--knoux-subtext)] mt-0.5">
                    {item.installed ? item.version : t('Not Installed', 'غير مثبت')}
                  </p>
                </div>
              </div>

              {item.path && (
                <div className="text-end font-mono text-[11px] text-[var(--knoux-subtext)] truncate max-w-[180px]">
                  {item.path}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ports View */}
      {store.activeTab === 'ports' && (
        <div className="knoux-card border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] rounded-xl overflow-hidden divide-y divide-[var(--knoux-border)]">
          {store.activePorts.map((p) => (
            <div key={p.port} className="p-4 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-blue-400 text-sm">:{p.port}</span>
                <span className="ms-3 font-bold text-[var(--knoux-text)]">{p.processName}</span>
                <span className="ms-2 font-mono text-[var(--knoux-subtext)]">PID {p.pid}</span>
              </div>

              <button
                onClick={() => store.killProcessByPort(p.port)}
                className="knoux-btn-secondary py-1 px-3 text-xs text-rose-400 border-rose-500/30 hover:bg-rose-500/10 flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('Kill Process', 'إنهاء العملية')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
