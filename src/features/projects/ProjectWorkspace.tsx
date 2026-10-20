/**
 * KNOUX ONE — Module 16: Code & Project Workspace
 *
 * Every section runs a real native measurement over the selected project root and
 * renders the returned evidence. Workspace-only commands (discovery, health, task
 * runner, Git status, runtime inspection, report export) are not owned by a
 * catalog service and are logged under the m16_unexposed marker, mirroring the
 * native envelope.
 */

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Braces,
  Database,
  FileSearch,
  FolderGit2,
  FolderOpen,
  GitBranch,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Trash2,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { NativeClient } from '../../services/nativeClient';
import { formatBytes } from '../duplicates/duplicateFormatters';
import { useProjectStore } from './projectStore';
import type { ProjectTab, ReportFormat } from './projectContracts';

const WORKSPACE_SERVICE = 'm16_unexposed';

function formatTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const Chip: React.FC<{ label: string; value: string; tone?: 'default' | 'warn' | 'danger' | 'ok' }> = ({ label, value, tone = 'default' }) => {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : tone === 'ok'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-200';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClass}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
};

const Table: React.FC<{ columns: string[]; rows: string[][]; empty: string }> = ({ columns, rows, empty }) => {
  if (!rows.length) return <p className="text-sm text-slate-400">{empty}</p>;
  const visible = rows.slice(0, 10);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-300">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            {columns.map(column => (
              <th key={column} className="px-2 py-2 font-medium whitespace-nowrap">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index} className="border-b border-white/5 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-[320px] truncate px-2 py-2" title={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visible.length && <p className="mt-2 text-xs text-slate-500">+{rows.length - visible.length}</p>}
    </div>
  );
};

const RunButton: React.FC<{ busy: boolean; disabled?: boolean; onClick: () => void; label?: string }> = ({ busy, disabled, onClick, label }) => {
  const { t } = useKnoux();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {busy ? t('Working…', 'جارٍ العمل…') : label ?? t('Run measurement', 'تشغيل القياس')}
    </button>
  );
};

export const ProjectWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm16');
  const store = useProjectStore();
  const [rootInput, setRootInput] = useState('');
  const [scannedRoots, setScannedRoots] = useState<string[]>([]);
  const [skippedRoots, setSkippedRoots] = useState<string[]>([]);
  const [cacheConfirm, setCacheConfirm] = useState('');
  const [taskConfirm, setTaskConfirm] = useState<Record<string, string>>({});
  const [runtimeConfirm, setRuntimeConfirm] = useState<Record<number, string>>({});
  const [reportFormat, setReportFormat] = useState<ReportFormat>('json');
  const [reportRedact, setReportRedact] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const unavailable = !store.runtime.available;
  const busy = (action: string) => store.loadingAction === action;
  const projectPath = store.activeProject?.canonicalPath ?? '';

  useEffect(() => {
    setCacheConfirm('');
    setTaskConfirm({});
    setRuntimeConfirm({});
    setSelectedTaskId(null);
  }, [store.activeProject?.id]);

  const log = (serviceId: string, nameEn: string, nameAr: string, data: unknown, extraEn?: string, extraAr?: string) => {
    addLog(
      serviceId,
      t(nameEn, nameAr),
      data ? 'completed' : 'failed',
      data ? extraEn ?? t('Measured from the local project tree.', 'قيس من شجرة المشروع المحلية.') : t('No evidence returned; see the error banner.', 'لم تُرجَع أدلة؛ راجع شريط الخطأ.'),
    );
  };

  const browseRoot = async () => {
    try {
      const picked = await NativeClient.invokeNative<string | null>('m03_pick_folder', {});
      if (picked) setRootInput(picked);
    } catch (cause) {
      store.setError({ code: 'folder_picker_failed', message: cause instanceof Error ? cause.message : String(cause) });
    }
  };

  const discover = async () => {
    const root = rootInput.trim();
    if (!root) return;
    const data = await store.discoverProjects([root]);
    if (data) {
      setScannedRoots(data.scannedRoots);
      setSkippedRoots(data.skippedProtectedRoots);
    }
    log(WORKSPACE_SERVICE, 'Project discovery', 'اكتشاف المشاريع', data, `${t('Projects found', 'مشاريع مكتشفة')}: ${data?.projects.length ?? 0}`);
  };

  const tabs: Array<{ id: ProjectTab; en: string; ar: string; icon: React.ReactNode }> = [
    { id: 'overview', en: 'Overview & health', ar: 'نظرة عامة والصحة', icon: <ShieldCheck className="h-4 w-4" /> },
    { id: 'dependencies', en: 'Dependencies', ar: 'التبعيات', icon: <Boxes className="h-4 w-4" /> },
    { id: 'tasks', en: 'Tasks', ar: 'المهام', icon: <TerminalSquare className="h-4 w-4" /> },
    { id: 'environment', en: 'Environment', ar: 'البيئة', icon: <Braces className="h-4 w-4" /> },
    { id: 'source', en: 'Source', ar: 'المصدر', icon: <FileSearch className="h-4 w-4" /> },
    { id: 'cache', en: 'Cache', ar: 'الكاش', icon: <Trash2 className="h-4 w-4" /> },
    { id: 'git', en: 'Git', ar: 'Git', icon: <GitBranch className="h-4 w-4" /> },
    { id: 'runtime', en: 'Runtime', ar: 'التشغيل', icon: <Database className="h-4 w-4" /> },
    { id: 'reports', en: 'Report', ar: 'التقرير', icon: <FolderOpen className="h-4 w-4" /> },
  ];

  if (!module) return null;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.14),transparent_70%)]" aria-hidden="true" />
        <div className="relative space-y-2">
          <div className="flex items-center gap-3">
            <FolderGit2 className="h-6 w-6 text-indigo-300" />
            <h1 className="text-xl font-bold text-white">{t(module.nameEn, module.nameAr)}</h1>
          </div>
          <p className="max-w-[80ch] text-sm text-slate-300">
            {language === 'ar' ? module.descriptionAr : module.descriptionEn}
          </p>
        </div>
      </section>

      {unavailable && (
        <div className="knoux-glass-panel flex items-center gap-3 border border-amber-500/30 p-4 text-sm text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            {t(
              'Project measurements read the local disk only. Open KNOUX ONE Desktop to inspect projects.',
              'قياسات المشاريع تعمل على القرص المحلي فقط. افتح تطبيق KNOUX ONE لسطح المكتب لفحص المشاريع.',
            )}
          </p>
        </div>
      )}

      {store.error && (
        <div className="knoux-glass-panel flex items-start gap-3 border border-rose-500/30 p-4 text-sm text-rose-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{store.error.code}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs opacity-90">{store.error.message}</p>
          </div>
        </div>
      )}

      <section className="knoux-glass-panel space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={rootInput}
            onChange={event => setRootInput(event.target.value)}
            placeholder={t('Project root folder path', 'مسار مجلد المشاريع الجذر')}
            className="w-full max-w-xl rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => void browseRoot()}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            {t('Browse', 'استعراض')}
          </button>
          <RunButton busy={busy('discover')} disabled={unavailable || !rootInput.trim()} onClick={() => void discover()} label={t('Discover projects', 'اكتشاف المشاريع')} />
        </div>
        {(scannedRoots.length > 0 || skippedRoots.length > 0) && (
          <div className="flex flex-wrap gap-2">
            <Chip label={t('Scanned roots', 'الجذور الممسوحة')} value={String(scannedRoots.length)} />
            <Chip
              label={t('Protected roots skipped', 'جذور محمية تم تجاوزها')}
              value={String(skippedRoots.length)}
              tone={skippedRoots.length ? 'warn' : 'ok'}
            />
          </div>
        )}
      </section>

      {store.projects.length > 0 && (
        <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <div className="knoux-glass-panel max-h-[520px] space-y-2 overflow-y-auto p-4">
            {store.projects.map(project => {
              const active = project.id === store.activeProject?.id;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => store.selectProject(project)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <p className="text-sm font-semibold text-white">{project.name}</p>
                  <p className="mt-1 truncate text-xs text-slate-400" title={project.canonicalPath}>{project.canonicalPath}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.gitRepository && (
                      <span className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-200">
                        git{project.branch ? `:${project.branch}` : ''}
                      </span>
                    )}
                    {project.ecosystems.slice(0, 3).map(ecosystem => (
                      <span key={ecosystem} className="rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] text-slate-200">{ecosystem}</span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {formatBytes(project.sizeBytes)} · {t('files', 'ملفًا')}: {project.fileCount} · {t('confidence', 'الثقة')}: {project.confidence}%
                  </p>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <nav className="knoux-glass-panel flex flex-wrap gap-1 p-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => store.setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    store.activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-100' : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  {tab.icon}
                  {t(tab.en, tab.ar)}
                </button>
              ))}
            </nav>

            {store.activeTab === 'overview' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Project health', 'صحة المشروع')}</h3>
                  <RunButton busy={busy('health')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.auditHealth(projectPath);
                    log(WORKSPACE_SERVICE, 'Project health', 'صحة المشروع', data, data ? `${t('Health score', 'درجة الصحة')}: ${data.healthScore}` : undefined);
                  }} />
                </div>
                {store.healthAudit && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Health score', 'درجة الصحة')} value={String(store.healthAudit.healthScore)} tone={store.healthAudit.healthScore >= 70 ? 'ok' : store.healthAudit.healthScore >= 40 ? 'warn' : 'danger'} />
                      <Chip label={t('Checked files', 'ملفات مفحوصة')} value={String(store.healthAudit.checkedFiles)} />
                      <Chip label={t('Findings', 'الملاحظات')} value={String(store.healthAudit.findings.length)} tone={store.healthAudit.findings.length ? 'warn' : 'ok'} />
                    </div>
                    <p className="text-xs text-slate-500">{store.healthAudit.scoreFormula}</p>
                    <Table
                      columns={[t('Severity', 'الخطورة'), t('Code', 'الرمز'), t('Finding', 'الملاحظة'), t('Path', 'المسار'), t('Line', 'السطر')]}
                      rows={store.healthAudit.findings.map(finding => [
                        finding.severity,
                        finding.code,
                        finding.title,
                        finding.evidencePath ?? '—',
                        finding.line != null ? String(finding.line) : '—',
                      ])}
                      empty={t('No health findings.', 'لا توجد ملاحظات صحية.')}
                    />
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'dependencies' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Dependency audit', 'تدقيق التبعيات')}</h3>
                  <RunButton busy={busy('dependencies')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.auditDependencies(projectPath);
                    log('m16_s05', 'Dependency audit', 'تدقيق التبعيات', data, data ? `${t('Dependencies', 'التبعيات')}: ${data.dependencies.length}` : undefined);
                  }} />
                </div>
                {store.dependencyAudit && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Lockfile status', 'حالة قفل الإصدارات')} value={store.dependencyAudit.lockfileStatus} tone={store.dependencyAudit.lockfileStatus === 'present' ? 'ok' : 'warn'} />
                      <Chip label={t('Unpinned', 'غير مثبتة')} value={String(store.dependencyAudit.unpinnedCount)} tone={store.dependencyAudit.unpinnedCount ? 'warn' : 'ok'} />
                      <Chip label={t('Ecosystems', 'الأنظمة')} value={store.dependencyAudit.ecosystems.join(', ') || '—'} />
                    </div>
                    <Table
                      columns={[t('Name', 'الاسم'), t('Version', 'الإصدار'), t('Type', 'النوع'), t('Pinned', 'مثبتة'), t('Manifest', 'الملف')]}
                      rows={store.dependencyAudit.dependencies.map(dependency => [
                        dependency.name,
                        dependency.version,
                        dependency.depType,
                        dependency.isPinned ? t('yes', 'نعم') : t('no', 'لا'),
                        dependency.sourceManifest,
                      ])}
                      empty={t('No dependencies parsed from manifests.', 'لم تُقرأ تبعيات من ملفات المشروع.')}
                    />
                    {store.dependencyAudit.riskFindings.length > 0 && (
                      <div className="space-y-1">
                        {store.dependencyAudit.riskFindings.map((finding, index) => (
                          <p key={index} className="text-xs text-amber-200">{finding}</p>
                        ))}
                      </div>
                    )}
                    {store.dependencyAudit.auditCommands.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                        <p className="text-[11px] text-slate-400">
                          {t('Commands a human would run (not executed by KNOUX):', 'أوامر يشغلها المستخدم يدويًا (لا ينفذها KNOUX):')}
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {store.dependencyAudit.auditCommands.map((command, index) => (
                            <li key={index} className="font-mono text-[11px] text-slate-300">{command}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'tasks' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Project tasks', 'مهام المشروع')}</h3>
                  <RunButton busy={busy('tasks')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.listTasks(projectPath);
                    log(WORKSPACE_SERVICE, 'Task listing', 'سرد المهام', data, data ? `${t('Tasks', 'المهام')}: ${data.tasks.length}` : undefined);
                  }} />
                </div>
                {store.commandState && (
                  <div className="space-y-3">
                    <Table
                      columns={[t('Task', 'المهمة'), t('Preview', 'المعاينة'), t('Risk', 'الخطورة'), t('Needs confirmation', 'يتطلب تأكيدًا')]}
                      rows={store.commandState.tasks.map(task => [
                        task.label,
                        task.preview,
                        task.risk,
                        task.requiresConfirmation ? t('yes', 'نعم') : t('no', 'لا'),
                      ])}
                      empty={t('No runnable tasks were found in this project.', 'لا توجد مهام قابلة للتشغيل في هذا المشروع.')}
                    />
                    <div className="space-y-2">
                      {store.commandState.tasks.map(task => (
                        <div key={task.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <span className="text-xs text-slate-200">{task.label}</span>
                          <span className="font-mono text-[11px] text-slate-500">{task.preview}</span>
                          {task.requiresConfirmation && (
                            <input
                              value={taskConfirm[task.id] ?? ''}
                              onChange={event => setTaskConfirm(previous => ({ ...previous, [task.id]: event.target.value }))}
                              placeholder={`RUN ${task.id}`}
                              className="w-40 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-white"
                            />
                          )}
                          <button
                            type="button"
                            disabled={unavailable || busy(`task-${task.id}`) || (task.requiresConfirmation && (taskConfirm[task.id] ?? '') !== `RUN ${task.id}`)}
                            onClick={async () => {
                              setSelectedTaskId(task.id);
                              const data = await store.executeTask(projectPath, task.id, task.requiresConfirmation ? taskConfirm[task.id] : undefined);
                              log(
                                WORKSPACE_SERVICE,
                                `Task ${task.label}`,
                                `المهمة ${task.label}`,
                                data,
                                data?.run ? `${t('Exit code', 'رمز الخروج')}: ${data.run.exitCode} · ${data.run.durationMs} ms` : undefined,
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {busy(`task-${task.id}`) ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            {t('Run', 'تشغيل')}
                          </button>
                        </div>
                      ))}
                    </div>
                    {store.commandState.run && selectedTaskId && (
                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-xs text-slate-300">
                        <div className="flex flex-wrap gap-2">
                          <Chip label={t('Exit code', 'رمز الخروج')} value={String(store.commandState.run.exitCode)} tone={store.commandState.run.success ? 'ok' : 'danger'} />
                          <Chip label={t('Duration', 'المدة')} value={`${store.commandState.run.durationMs} ms`} />
                        </div>
                        <p className="mt-2 font-mono text-[11px] text-slate-500">{store.commandState.run.commandPreview}</p>
                        {store.commandState.run.stdout && (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-slate-300">{store.commandState.run.stdout}</pre>
                        )}
                        {store.commandState.run.stderr && (
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-rose-300">{store.commandState.run.stderr}</pre>
                        )}
                      </div>
                    )}
                    {store.commandState.warnings.length > 0 && (
                      <div className="space-y-1">
                        {store.commandState.warnings.map((warning, index) => (
                          <p key={index} className="text-xs text-amber-200">{warning}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'environment' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Environment audit', 'تدقيق البيئة')}</h3>
                  <RunButton busy={busy('environment')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.auditEnvironment(projectPath);
                    log('m16_s06', 'Environment audit', 'تدقيق البيئة', data, data ? `${t('Keys compared', 'مفاتيح مقارنة')}: ${data.keys.length}` : undefined);
                  }} />
                </div>
                {store.environmentAudit && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Runtime files', 'ملفات التشغيل')} value={String(store.environmentAudit.runtimeFiles.length)} />
                      <Chip label={t('Templates', 'القوالب')} value={String(store.environmentAudit.templateFiles.length)} />
                      <Chip label={t('Missing keys', 'مفاتيح مفقودة')} value={String(store.environmentAudit.missingKeys.length)} tone={store.environmentAudit.missingKeys.length ? 'warn' : 'ok'} />
                      <Chip label={t('Obsolete keys', 'مفاتيح قديمة')} value={String(store.environmentAudit.obsoleteKeys.length)} tone={store.environmentAudit.obsoleteKeys.length ? 'warn' : 'ok'} />
                      <Chip label={t('Malformed lines', 'أسطر غير صحيحة')} value={String(store.environmentAudit.malformedLines.length)} tone={store.environmentAudit.malformedLines.length ? 'danger' : 'ok'} />
                    </div>
                    <Table
                      columns={[t('Key', 'المفتاح'), t('In runtime file', 'في ملف التشغيل'), t('In template', 'في القالب'), t('Empty value', 'قيمة فارغة'), t('Duplicates', 'تكرارات')]}
                      rows={store.environmentAudit.keys.map(key => [
                        key.key,
                        key.presentInRuntimeFile ? t('yes', 'نعم') : t('no', 'لا'),
                        key.presentInTemplate ? t('yes', 'نعم') : t('no', 'لا'),
                        key.emptyValue ? t('yes', 'نعم') : t('no', 'لا'),
                        String(key.duplicateCount),
                      ])}
                      empty={t('No environment files were detected.', 'لم تُكتشف ملفات بيئة.')}
                    />
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'source' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Source analysis', 'تحليل المصدر')}</h3>
                  <RunButton busy={busy('source')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.analyzeSource(projectPath);
                    log('m16_s08', 'Source analysis', 'تحليل المصدر', data, data ? `${t('Files', 'ملفات')}: ${data.fileCount}` : undefined);
                  }} />
                </div>
                {store.sourceAnalyze && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Files', 'ملفات')} value={String(store.sourceAnalyze.fileCount)} />
                      <Chip label={t('Source files', 'ملفات مصدر')} value={String(store.sourceAnalyze.sourceFileCount)} />
                      <Chip label={t('Test files', 'ملفات اختبار')} value={String(store.sourceAnalyze.testFileCount)} />
                      <Chip label={t('Config files', 'ملفات إعداد')} value={String(store.sourceAnalyze.configFileCount)} />
                      <Chip label="TODO" value={String(store.sourceAnalyze.todoCount)} tone={store.sourceAnalyze.todoCount ? 'warn' : 'ok'} />
                      <Chip label={t('Merge conflicts', 'تعارضات دمج')} value={String(store.sourceAnalyze.mergeConflictCount)} tone={store.sourceAnalyze.mergeConflictCount ? 'danger' : 'ok'} />
                    </div>
                    <Table
                      columns={[t('Language', 'اللغة'), t('Files', 'ملفات'), t('Bytes', 'بايت')]}
                      rows={store.sourceAnalyze.languages.map(languageRow => [
                        languageRow.language,
                        String(languageRow.files),
                        formatBytes(languageRow.bytes),
                      ])}
                      empty={t('No languages detected.', 'لم تُكتشف لغات.')}
                    />
                    <Table
                      columns={[t('Largest file', 'أكبر ملف'), t('Size', 'الحجم')]}
                      rows={store.sourceAnalyze.largestFiles.map(file => [file.path, formatBytes(file.sizeBytes)])}
                      empty=""
                    />
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'cache' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Build-artifact cache', 'كاش مخلفات البناء')}</h3>
                  <RunButton busy={busy('cache-inspect')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.inspectCache(projectPath);
                    log('m16_s07', 'Cache inspection', 'فحص الكاش', data, data ? `${t('Targets', 'الأهداف')}: ${data.targets.length}` : undefined);
                  }} />
                </div>
                {store.cacheManage && (
                  <div className="space-y-3">
                    <Table
                      columns={[t('Path', 'المسار'), t('Category', 'الفئة'), t('Size', 'الحجم'), t('Safe to clean', 'آمن للتنظيف')]}
                      rows={store.cacheManage.targets.map(target => [
                        target.relativePath,
                        target.category,
                        formatBytes(target.sizeBytes),
                        target.safeToClean ? t('yes', 'نعم') : t('no', 'لا'),
                      ])}
                      empty={t('No cache targets were detected.', 'لم تُكتشف أهداف كاش.')}
                    />
                    {store.cacheManage.cleanedPaths.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        <Chip label={t('Reclaimed', 'المُستعاد')} value={formatBytes(store.cacheManage.reclaimedBytes)} tone="ok" />
                        <Chip label={t('Cleaned paths', 'مسارات منظفة')} value={String(store.cacheManage.cleanedPaths.length)} />
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={cacheConfirm}
                        onChange={event => setCacheConfirm(event.target.value)}
                        placeholder={t('Type CLEAN to confirm', 'اكتب CLEAN للتأكيد')}
                        className="w-48 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs text-white"
                      />
                      <button
                        type="button"
                        disabled={unavailable || busy('cache-clean') || cacheConfirm !== 'CLEAN' || !store.cacheManage.targets.some(target => target.safeToClean)}
                        onClick={async () => {
                          const safePaths = store.cacheManage?.targets.filter(target => target.safeToClean).map(target => target.path) ?? [];
                          const data = await store.cleanCache(projectPath, safePaths, cacheConfirm);
                          log('m16_s07', 'Cache clean', 'تنظيف الكاش', data, data ? `${t('Reclaimed', 'المُستعاد')}: ${formatBytes(data.reclaimedBytes)}` : undefined);
                          setCacheConfirm('');
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy('cache-clean') ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {t('Clean safe targets', 'تنظيف الأهداف الآمنة')}
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'git' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Git workspace', 'مساحة عمل Git')}</h3>
                  <RunButton busy={busy('git')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.checkGitWorkspace(projectPath);
                    log(WORKSPACE_SERVICE, 'Git workspace status', 'حالة مساحة عمل Git', data, data ? `${t('Branch', 'الفرع')}: ${data.branch}` : undefined);
                  }} />
                </div>
                {store.gitWorkspace && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Branch', 'الفرع')} value={store.gitWorkspace.branch} />
                      <Chip label={t('Detached', 'منفصل')} value={store.gitWorkspace.detached ? t('yes', 'نعم') : t('no', 'لا')} tone={store.gitWorkspace.detached ? 'warn' : 'ok'} />
                      <Chip label={t('Clean', 'نظيف')} value={store.gitWorkspace.isClean ? t('yes', 'نعم') : t('no', 'لا')} tone={store.gitWorkspace.isClean ? 'ok' : 'warn'} />
                      <Chip label={t('Ahead', 'متقدم')} value={String(store.gitWorkspace.ahead)} />
                      <Chip label={t('Behind', 'متأخر')} value={String(store.gitWorkspace.behind)} />
                    </div>
                    {store.gitWorkspace.remote && (
                      <p className="font-mono text-[11px] text-slate-400">{store.gitWorkspace.remote}</p>
                    )}
                    <Table
                      columns={[t('State', 'الحالة'), t('Entries', 'العناصر')]}
                      rows={[
                        [t('Staged', 'مجهّز'), store.gitWorkspace.staged.join(', ') || '—'],
                        [t('Modified', 'معدّل'), store.gitWorkspace.modified.join(', ') || '—'],
                        [t('Untracked', 'غير متتبع'), store.gitWorkspace.untracked.join(', ') || '—'],
                        [t('Conflicted', 'متعارض'), store.gitWorkspace.conflicted.join(', ') || '—'],
                      ]}
                      empty=""
                    />
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'runtime' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{t('Runtime processes', 'عمليات التشغيل')}</h3>
                  <RunButton busy={busy('runtime-inspect')} disabled={unavailable || !projectPath} onClick={async () => {
                    const data = await store.inspectRuntime(projectPath);
                    log(WORKSPACE_SERVICE, 'Runtime inspection', 'فحص عمليات التشغيل', data, data ? `${t('Processes', 'العمليات')}: ${data.processes.length}` : undefined);
                  }} />
                </div>
                {store.runtimeState && (
                  <div className="space-y-4">
                    <Table
                      columns={['PID', t('Process', 'العملية'), t('Ports', 'المنافذ'), t('Protected', 'محمية'), t('Evidence', 'الدليل')]}
                      rows={store.runtimeState.processes.map(process => [
                        String(process.pid),
                        process.processName,
                        process.ports.join(', ') || '—',
                        process.protected ? t('yes', 'نعم') : t('no', 'لا'),
                        process.projectMatchEvidence,
                      ])}
                      empty={t('No matching runtime processes were found.', 'لم تُعثر على عمليات تشغيل مطابقة.')}
                    />
                    {store.runtimeState.processes.filter(process => !process.protected).map(process => (
                      <div key={process.pid} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <span className="text-xs text-slate-200">PID {process.pid} · {process.processName}</span>
                        <input
                          value={runtimeConfirm[process.pid] ?? ''}
                          onChange={event => setRuntimeConfirm(previous => ({ ...previous, [process.pid]: event.target.value }))}
                          placeholder={`STOP ${process.pid}`}
                          className="w-40 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1 text-xs text-white"
                        />
                        <button
                          type="button"
                          disabled={unavailable || busy(`runtime-terminate-${process.pid}`) || (runtimeConfirm[process.pid] ?? '') !== `STOP ${process.pid}`}
                          onClick={async () => {
                            const data = await store.terminateRuntime(projectPath, process.pid, runtimeConfirm[process.pid]);
                            log(WORKSPACE_SERVICE, `Terminate PID ${process.pid}`, `إنهاء العملية ${process.pid}`, data, data ? `${t('Terminated PID', 'العملية المنهية')}: ${data.terminatedPid}` : undefined);
                            setRuntimeConfirm(previous => ({ ...previous, [process.pid]: '' }));
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-xs text-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busy(`runtime-terminate-${process.pid}`) ? <RefreshCw className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                          {t('Terminate', 'إنهاء')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {store.activeTab === 'reports' && (
              <section className="knoux-glass-panel space-y-4 p-5">
                <h3 className="text-sm font-semibold text-white">{t('Project report', 'تقرير المشروع')}</h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                  <select
                    value={reportFormat}
                    onChange={event => setReportFormat(event.target.value as ReportFormat)}
                    className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs text-white"
                  >
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="html">HTML</option>
                    <option value="csv">CSV</option>
                  </select>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={reportRedact} onChange={event => setReportRedact(event.target.checked)} />
                    {t('Redact absolute paths', 'تنقيح المسارات المطلقة')}
                  </label>
                  <RunButton busy={busy('report')} disabled={unavailable || !projectPath} label={t('Export report', 'تصدير التقرير')} onClick={async () => {
                    const data = await store.exportReport(projectPath, reportFormat, reportRedact);
                    log(WORKSPACE_SERVICE, 'Project report export', 'تصدير تقرير المشروع', data, data ? `${t('Path', 'المسار')}: ${data.reportPath}` : undefined);
                  }} />
                </div>
                {store.reportsExport && (
                  <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
                    <div className="flex flex-wrap gap-2">
                      <Chip label={t('Format', 'الصيغة')} value={store.reportsExport.format} />
                      <Chip label={t('Size', 'الحجم')} value={formatBytes(store.reportsExport.sizeBytes)} />
                      <Chip label={t('Created', 'الإنشاء')} value={formatTime(store.reportsExport.createdAt)} />
                    </div>
                    <p className="break-all font-mono text-[11px] text-slate-400">{store.reportsExport.reportPath}</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
