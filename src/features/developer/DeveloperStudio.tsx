import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Box,
  Braces,
  CheckCircle2,
  CircleDot,
  Code2,
  Database,
  Download,
  ExternalLink,
  FileCode2,
  FolderGit2,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  ListTree,
  Network,
  Play,
  Plus,
  RefreshCw,
  Route,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useDeveloperStore } from './developerStore';
import type { DeveloperTab, ToolchainItem } from './developerContracts';
import { useTranslation } from '../../i18n';

const TAB_DEFINITIONS: Array<{
  id: DeveloperTab;
  icon: React.ElementType;
  en: string;
  ar: string;
}> = [
  { id: 'overview', icon: Gauge, en: 'Command Center', ar: 'مركز القيادة' },
  { id: 'path', icon: Route, en: 'PATH Lab', ar: 'مختبر PATH' },
  { id: 'runtimes', icon: Box, en: 'Runtimes', ar: 'بيئات التشغيل' },
  { id: 'git', icon: GitBranch, en: 'Git Audit', ar: 'تدقيق Git' },
  { id: 'repositories', icon: FolderGit2, en: 'Repositories', ar: 'المستودعات' },
  { id: 'ports', icon: Network, en: 'Ports & Processes', ar: 'المنافذ والعمليات' },
  { id: 'projects', icon: FileCode2, en: 'Project Health', ar: 'صحة المشروعات' },
  { id: 'caches', icon: HardDrive, en: 'Cache Control', ar: 'إدارة الكاش' },
  { id: 'http', icon: Globe2, en: 'HTTP Lab', ar: 'مختبر HTTP' },
  { id: 'report', icon: Download, en: 'Reports', ar: 'التقارير' },
];

export function DeveloperStudio() {
  const { t } = useTranslation();
  const store = useDeveloperStore();
  const installedCount = store.toolchains.filter((tool: ToolchainItem) => tool.installed).length;
  const healthyCount = store.toolchains.filter((tool: ToolchainItem) => tool.status === 'healthy').length;
  const pathIssues = (store.pathAudit?.duplicateCount ?? 0) + (store.pathAudit?.missingCount ?? 0);
  const projectIssues = store.projects.reduce((total: number, project: any) => total + project.findings.length, 0);

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(139,92,246,.22),transparent_31%),radial-gradient(circle_at_68%_86%,rgba(37,99,235,.16),transparent_34%)]" />
        <div className="pointer-events-none absolute -end-20 -top-24 h-72 w-72 rounded-full border border-purple-400/10 bg-purple-500/5 blur-2xl" />
        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-4xl">
            <div className="knoux-eyebrow text-purple-400">
              <Code2 className="h-4 w-4" />
              {t('Module 15 — KNOUX Developer Studio', 'الوحدة 15 — استوديو المطورين من KNOUX')}
            </div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.4rem)] font-black tracking-tight text-[var(--knoux-text)]">
              {t('One workspace for the entire Windows development machine.', 'مساحة عمل واحدة لإدارة جهاز التطوير بالكامل.')}
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--knoux-subtext)]">
              {t(
                'Discover real toolchains, audit PATH and Git, inspect repositories and project manifests, manage listening ports, measure developer caches, test HTTP APIs, and export evidence-backed reports without fabricated host data.',
                'اكتشف أدوات التطوير الحقيقية، ودقق PATH وGit، وافحص المستودعات وملفات المشروعات، وأدر المنافذ والكاش، واختبر واجهات HTTP، وصدّر تقارير موثقة دون بيانات جهاز وهمية.',
              )}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusPill icon={ShieldCheck} text={t('Local-first', 'محلي أولًا')} tone="emerald" />
              <StatusPill icon={TerminalSquare} text={t('Native Windows evidence', 'أدلة ويندوز محلية')} tone="blue" />
              <StatusPill icon={ShieldAlert} text={t('Confirmed destructive actions', 'تأكيد العمليات الحساسة')} tone="amber" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void store.refreshDiagnostics()}
            disabled={store.isLoading || !store.runtime.available}
            className="knoux-btn-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 px-6 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <RefreshCw className={`h-5 w-5 ${store.loadingAction === 'full-audit' ? 'animate-spin' : ''}`} />
            {t('Run workstation audit', 'تشغيل تدقيق محطة التطوير')}
          </button>
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-3 border-t border-[var(--knoux-glass-border)] pt-5 lg:grid-cols-5">
          <Metric label={t('Installed tools', 'الأدوات المثبتة')} value={`${installedCount}/${store.toolchains.length || '—'}`} tone="emerald" />
          <Metric label={t('Healthy probes', 'الفحوصات السليمة')} value={healthyCount || '—'} tone="blue" />
          <Metric label={t('PATH findings', 'ملاحظات PATH')} value={store.pathAudit ? pathIssues : '—'} tone={pathIssues > 0 ? 'amber' : 'emerald'} />
          <Metric label={t('Listening endpoints', 'المنافذ النشطة')} value={store.activePorts.length || '—'} tone="purple" />
          <Metric label={t('Project findings', 'ملاحظات المشروعات')} value={store.projects.length ? projectIssues : '—'} tone={projectIssues > 0 ? 'amber' : 'default'} />
        </div>
      </section>

      {!store.runtime.available && (
        <Notice
          tone="amber"
          title={t('Desktop runtime required', 'يلزم تشغيل نسخة سطح المكتب')}
          message={t(
            store.runtime.reasonEn ?? 'Open KNOUX ONE Desktop to inspect this Windows device.',
            store.runtime.reasonAr ?? 'افتح تطبيق KNOUX ONE Desktop لفحص جهاز ويندوز الحقيقي.',
          )}
        />
      )}

      {store.error && (
        <Notice tone={store.error.code === 'completed_with_warnings' ? 'amber' : 'rose'} title={store.error.code} message={store.error.message} />
      )}

      <nav className="knoux-glass-panel flex gap-1 overflow-x-auto p-2 scrollbar-none">
        {TAB_DEFINITIONS.map(({ id, icon: Icon, en, ar }) => (
          <button
            key={id}
            type="button"
            onClick={() => store.setActiveTab(id)}
            className={`inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-xs font-black transition ${
              store.activeTab === id
                ? 'bg-gradient-to-r from-purple-600/90 to-blue-600/90 text-white shadow-lg shadow-purple-500/15'
                : 'text-[var(--knoux-subtext)] hover:bg-[var(--knoux-bg-soft)] hover:text-[var(--knoux-text)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {t(en, ar)}
          </button>
        ))}
      </nav>

      {store.activeTab === 'overview' && <Overview store={store} t={t} />}
      {store.activeTab === 'path' && <PathWorkspace store={store} t={t} />}
      {store.activeTab === 'runtimes' && <RuntimeWorkspace store={store} t={t} />}
      {store.activeTab === 'git' && <GitWorkspace store={store} t={t} />}
      {store.activeTab === 'repositories' && <RepositoryWorkspace store={store} t={t} />}
      {store.activeTab === 'ports' && <PortsWorkspace store={store} t={t} />}
      {store.activeTab === 'projects' && <ProjectsWorkspace store={store} t={t} />}
      {store.activeTab === 'caches' && <CachesWorkspace store={store} t={t} />}
      {store.activeTab === 'http' && <HttpWorkspace store={store} t={t} />}
      {store.activeTab === 'report' && <ReportWorkspace store={store} t={t} />}
    </div>
  );
}

function Overview({ store, t }: any) {
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of store.toolchains) counts.set(tool.category, (counts.get(tool.category) ?? 0) + 1);
    return Array.from(counts.entries());
  }, [store.toolchains]);

  if (!store.environment) {
    return <EmptyState icon={ServerCog} title={t('No workstation audit yet', 'لم يتم تدقيق محطة التطوير بعد')} description={t('Run the native audit to populate this workspace with real versions, paths, ports, and configuration evidence.', 'شغّل التدقيق المحلي لعرض الإصدارات والمسارات والمنافذ وإعدادات الجهاز الحقيقية.')} actionLabel={t('Run audit', 'تشغيل التدقيق')} onAction={() => void store.refreshDiagnostics()} disabled={!store.runtime.available || store.isLoading} />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
      <section className="knoux-glass-panel p-5">
        <WorkspaceHeading icon={ListTree} title={t('Toolchain matrix', 'مصفوفة أدوات التطوير')} description={t('Resolved from executable paths and real version commands.', 'مستخرجة من المسارات التنفيذية وأوامر الإصدارات الفعلية.')} actionLabel={t('Refresh tools', 'تحديث الأدوات')} loading={store.loadingAction === 'environment'} onAction={() => void store.discoverEnvironment()} />
        <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {store.toolchains.map((tool: ToolchainItem) => <ToolCard key={tool.id} tool={tool} t={t} />)}
        </div>
      </section>

      <div className="space-y-5">
        <section className="knoux-glass-panel p-5">
          <h3 className="text-sm font-black text-[var(--knoux-text)]">{t('Host identity', 'هوية الجهاز')}</h3>
          <KeyValue label={t('Computer', 'الجهاز')} value={store.environment.computerName} />
          <KeyValue label={t('User', 'المستخدم')} value={store.environment.userName} />
          <KeyValue label={t('Architecture', 'المعمارية')} value={store.environment.architecture} />
          <KeyValue label={t('Shell', 'الصدفة')} value={store.environment.shell} mono />
        </section>
        <section className="knoux-glass-panel p-5">
          <h3 className="text-sm font-black text-[var(--knoux-text)]">{t('Tool categories', 'تصنيفات الأدوات')}</h3>
          <div className="mt-4 space-y-3">
            {categories.map(([category, count]) => (
              <div key={category} className="flex items-center justify-between rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] px-3 py-2 text-xs">
                <span className="font-semibold text-[var(--knoux-subtext)]">{category.replaceAll('_', ' ')}</span>
                <strong className="text-purple-300">{count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function PathWorkspace({ store, t }: any) {
  return (
    <section className="knoux-glass-panel overflow-hidden">
      <div className="p-5">
        <WorkspaceHeading icon={Route} title={t('PATH diagnostics laboratory', 'مختبر تشخيص PATH')} description={t('Reads user and machine PATH independently, expands variables, verifies folders, and identifies normalized duplicates without editing the registry.', 'يقرأ PATH للمستخدم والنظام بشكل مستقل، ويفك المتغيرات، ويتحقق من المجلدات، ويكتشف التكرار دون تعديل السجل.')} actionLabel={t('Audit PATH', 'تدقيق PATH')} loading={store.loadingAction === 'path'} onAction={() => void store.auditPath()} />
      </div>
      {!store.pathAudit ? <InlineEmpty text={t('PATH has not been audited.', 'لم يتم تدقيق PATH بعد.')} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 border-y border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-4 md:grid-cols-4">
            <Metric label={t('User entries', 'مسارات المستخدم')} value={store.pathAudit.userEntryCount} tone="blue" />
            <Metric label={t('System entries', 'مسارات النظام')} value={store.pathAudit.systemEntryCount} tone="purple" />
            <Metric label={t('Duplicates', 'المكررة')} value={store.pathAudit.duplicateCount} tone={store.pathAudit.duplicateCount ? 'amber' : 'emerald'} />
            <Metric label={t('Missing', 'غير الموجودة')} value={store.pathAudit.missingCount} tone={store.pathAudit.missingCount ? 'rose' : 'emerald'} />
          </div>
          <div className="divide-y divide-[var(--knoux-border)]">
            {store.pathAudit.entries.map((entry: any) => (
              <div key={entry.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${entry.scope === 'system' ? 'bg-purple-500/15 text-purple-300' : 'bg-blue-500/15 text-blue-300'}`}>{entry.scope}</span>
                    {entry.exists ? <StatusPill icon={CheckCircle2} text={t('Exists', 'موجود')} tone="emerald" /> : <StatusPill icon={XCircle} text={t('Missing', 'غير موجود')} tone="rose" />}
                    {entry.isDuplicate && <StatusPill icon={AlertTriangle} text={t('Duplicate', 'مكرر')} tone="amber" />}
                  </div>
                  <p className="mt-2 break-all font-mono text-xs text-[var(--knoux-text)]" dir="ltr">{entry.path}</p>
                </div>
                <code className="max-w-md truncate text-[10px] text-[var(--knoux-subtext)]" dir="ltr">{entry.normalizedPath}</code>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RuntimeWorkspace({ store, t }: any) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.7fr)]">
      <section className="knoux-glass-panel p-5">
        <WorkspaceHeading icon={Box} title={t('Runtime and version managers', 'مديرو الإصدارات وبيئات التشغيل')} description={t('Detects NVM, FNM, Volta, pyenv-win, Rustup, and developer home variables.', 'يكتشف NVM وFNM وVolta وpyenv-win وRustup ومتغيرات مجلدات التطوير.')} actionLabel={t('Inspect runtimes', 'فحص البيئات')} loading={store.loadingAction === 'runtimes'} onAction={() => void store.inspectRuntimes()} />
        {!store.runtimeInspection ? <InlineEmpty text={t('Runtime managers have not been inspected.', 'لم يتم فحص مديري الإصدارات بعد.')} /> : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {store.runtimeInspection.managers.map((manager: any) => <ToolCard key={manager.id} tool={{ ...manager, category: 'runtime_manager', status: manager.installed ? 'healthy' : 'missing' }} t={t} />)}
          </div>
        )}
      </section>
      <section className="knoux-glass-panel p-5">
        <h3 className="text-sm font-black text-[var(--knoux-text)]">{t('Resolved developer homes', 'مجلدات التطوير المكتشفة')}</h3>
        <KeyValue label="npm prefix" value={store.runtimeInspection?.nodePrefix} mono />
        <KeyValue label="PYTHONHOME" value={store.runtimeInspection?.pythonHome} mono />
        <KeyValue label="RUSTUP_HOME" value={store.runtimeInspection?.rustupHome} mono />
        <KeyValue label="CARGO_HOME" value={store.runtimeInspection?.cargoHome} mono />
        <KeyValue label="DOTNET_ROOT" value={store.runtimeInspection?.dotnetRoot} mono />
      </section>
    </div>
  );
}

function GitWorkspace({ store, t }: any) {
  const git = store.gitAudit;
  return (
    <section className="knoux-glass-panel p-5">
      <WorkspaceHeading icon={GitBranch} title={t('Global Git configuration audit', 'تدقيق إعدادات Git العامة')} description={t('Reads selected non-secret settings only. Tokens, passwords, and credential payloads are never collected.', 'يقرأ إعدادات غير سرية محددة فقط، ولا يجمع الرموز أو كلمات المرور أو بيانات الاعتماد.')} actionLabel={t('Audit Git', 'تدقيق Git')} loading={store.loadingAction === 'git'} onAction={() => void store.auditGit()} />
      {!git ? <InlineEmpty text={t('Git has not been audited.', 'لم يتم تدقيق Git بعد.')} /> : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.7fr)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCard label={t('Version', 'الإصدار')} value={git.version} tone={git.installed ? 'emerald' : 'rose'} />
            <InfoCard label={t('Default branch', 'الفرع الافتراضي')} value={git.defaultBranch} />
            <InfoCard label="user.name" value={git.userName} />
            <InfoCard label="user.email" value={git.userEmail} />
            <InfoCard label="core.autocrlf" value={git.autocrlf} />
            <InfoCard label={t('Credential helper', 'مساعد بيانات الاعتماد')} value={git.credentialHelper} />
            <InfoCard label={t('Signing key', 'مفتاح التوقيع')} value={git.signingKeyConfigured ? t('Configured', 'مضبوط') : t('Not configured', 'غير مضبوط')} />
            <InfoCard label={t('Commit signing', 'توقيع الالتزامات')} value={git.commitSigningEnabled ? t('Enabled', 'مفعل') : t('Disabled', 'غير مفعل')} />
          </div>
          <Findings findings={git.findings} emptyText={t('No Git configuration findings.', 'لا توجد ملاحظات في إعدادات Git.')} />
        </div>
      )}
    </section>
  );
}

function RepositoryWorkspace({ store, t }: any) {
  return (
    <div className="space-y-5">
      <RootEditor title={t('Repository search roots', 'جذور البحث عن المستودعات')} roots={store.repositoryRoots} setRoots={store.setRepositoryRoots} placeholder="C:\\Projects" t={t} />
      <section className="knoux-glass-panel p-5">
        <WorkspaceHeading icon={FolderGit2} title={t('Repository intelligence', 'ذكاء المستودعات')} description={t('Finds local Git repositories and reads branch, dirty state, upstream divergence, redacted remote, and latest commit.', 'يكتشف مستودعات Git ويقرأ الفرع والتغييرات والانحراف عن upstream والرابط المنقح وآخر التزام.')} actionLabel={t('Scan repositories', 'فحص المستودعات')} loading={store.loadingAction === 'repositories'} onAction={() => void store.scanRepositories()} />
        {store.repositories.length === 0 ? <InlineEmpty text={t('No repository scan results.', 'لا توجد نتائج لفحص المستودعات.')} /> : (
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {store.repositories.map((repo: any) => (
              <article key={repo.path} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-[var(--knoux-text)]">{repo.name}</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr" title={repo.path}>{repo.path}</p>
                  </div>
                  <StatusPill icon={repo.dirty ? AlertTriangle : CheckCircle2} text={repo.status} tone={repo.dirty ? 'amber' : 'emerald'} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="knoux-chip"><GitBranch className="h-3 w-3" />{repo.branch || 'detached'}</span>
                  <span className="knoux-chip">↑ {repo.ahead}</span><span className="knoux-chip">↓ {repo.behind}</span>
                </div>
                {repo.remote && <p className="mt-3 truncate font-mono text-[11px] text-blue-300" dir="ltr">{repo.remote}</p>}
                {repo.lastCommit && <p className="mt-2 line-clamp-2 text-xs text-[var(--knoux-subtext)]">{repo.lastCommit}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PortsWorkspace({ store, t }: any) {
  const [query, setQuery] = useState('');
  const filtered = store.activePorts.filter((process: any) => `${process.port} ${process.processName} ${process.pid}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <section className="knoux-glass-panel overflow-hidden">
      <div className="p-5">
        <WorkspaceHeading icon={Network} title={t('Listening ports and process control', 'المنافذ النشطة والتحكم في العمليات')} description={t('Reads TCP and UDP listeners from Windows. Termination requires an exact typed confirmation and blocks protected processes.', 'يقرأ منافذ TCP وUDP من ويندوز، ويتطلب إنهاء العملية تأكيدًا كتابيًا دقيقًا مع منع عمليات النظام المحمية.')} actionLabel={t('Refresh ports', 'تحديث المنافذ')} loading={store.loadingAction === 'ports'} onAction={() => void store.inspectPorts()} />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Filter by port, process, or PID…', 'تصفية بالمنفذ أو العملية أو PID…')} className="knoux-input mt-4 w-full text-xs" />
      </div>
      {filtered.length === 0 ? <InlineEmpty text={t('No listening endpoints loaded.', 'لم يتم تحميل منافذ نشطة.')} /> : (
        <div className="divide-y divide-[var(--knoux-border)]">
          {filtered.map((process: any) => (
            <div key={`${process.protocol}:${process.port}:${process.pid}`} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-500/10 font-mono text-sm font-black text-blue-300">:{process.port}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--knoux-text)]">{process.processName || t('Unknown process', 'عملية غير معروفة')}</strong><span className="knoux-chip">PID {process.pid}</span><span className="knoux-chip">{process.protocol}</span>{process.protected && <StatusPill icon={ShieldCheck} text={t('Protected', 'محمية')} tone="purple" />}</div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr">{process.localAddress} · {process.state}</p>
                  {process.commandLine && <p className="mt-1 max-w-4xl truncate font-mono text-[10px] text-[var(--knoux-subtext)]" dir="ltr" title={process.commandLine}>{process.commandLine}</p>}
                </div>
              </div>
              <button type="button" disabled={process.protected || store.loadingAction === `terminate:${process.pid}`} onClick={() => { const confirmation = window.prompt(`Type STOP ${process.pid} to terminate this process.`); if (confirmation) void store.terminateProcess(process.pid, confirmation); }} className="knoux-btn-secondary inline-flex items-center gap-2 border-rose-500/25 text-xs text-rose-300 disabled:opacity-35"><Trash2 className="h-4 w-4" />{t('Terminate', 'إنهاء')}</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ProjectsWorkspace({ store, t }: any) {
  return (
    <div className="space-y-5">
      <RootEditor title={t('Project search roots', 'جذور البحث عن المشروعات')} roots={store.projectRoots} setRoots={store.setProjectRoots} placeholder="C:\\Development" t={t} />
      <section className="knoux-glass-panel p-5">
        <WorkspaceHeading icon={FileCode2} title={t('Multi-ecosystem project health', 'صحة المشروعات متعددة البيئات')} description={t('Discovers Node, Rust, Python, Go, Java, and .NET manifests with lockfile and build-cache evidence.', 'يكتشف مشروعات Node وRust وPython وGo وJava و.NET مع أدلة ملفات القفل والكاش.')} actionLabel={t('Audit projects', 'تدقيق المشروعات')} loading={store.loadingAction === 'projects'} onAction={() => void store.auditProjects()} />
        {store.projects.length === 0 ? <InlineEmpty text={t('No project audit results.', 'لا توجد نتائج لتدقيق المشروعات.')} /> : (
          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            {store.projects.map((project: any) => (
              <article key={`${project.path}:${project.ecosystem}`} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-black text-[var(--knoux-text)]">{project.name}</h3><p className="mt-1 truncate font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr">{project.path}</p></div><StatusPill icon={project.status === 'healthy' ? CheckCircle2 : AlertTriangle} text={project.ecosystem} tone={project.status === 'healthy' ? 'emerald' : 'amber'} /></div>
                <p className="mt-3 truncate font-mono text-[10px] text-blue-300" dir="ltr">{project.manifest}</p>
                <div className="mt-3 flex flex-wrap gap-2">{project.lockfiles.map((lockfile: string) => <span key={lockfile} className="knoux-chip">{lockfile}</span>)}</div>
                {project.findings.length > 0 && <ul className="mt-3 space-y-1 text-xs text-amber-200/85">{project.findings.map((finding: string) => <li key={finding}>• {finding}</li>)}</ul>}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CachesWorkspace({ store, t }: any) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectedPaths = store.caches.filter((cache: any) => selected.has(cache.path) && cache.safeToClean).map((cache: any) => cache.path);
  const selectedBytes = store.caches.filter((cache: any) => selected.has(cache.path)).reduce((total: number, cache: any) => total + cache.sizeBytes, 0);
  return (
    <section className="knoux-glass-panel overflow-hidden">
      <div className="p-5">
        <WorkspaceHeading icon={HardDrive} title={t('Developer cache control', 'التحكم في كاش المطور')} description={t('Measures recognized package-manager and build caches. Cleaning is restricted to allowlisted cache patterns and requires typing CLEAN.', 'يقيس كاش مديري الحزم والبناء المعترف به، ويقيد التنظيف على أنماط مسموحة ويتطلب كتابة CLEAN.')} actionLabel={t('Measure caches', 'قياس الكاش')} loading={store.loadingAction === 'caches'} onAction={() => void store.inspectCaches()} />
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[var(--knoux-text)]">{selectedPaths.length} {t('selected caches', 'عناصر كاش محددة')}</strong><p className="mt-1 font-mono text-xs text-amber-300">{formatBytes(selectedBytes)}</p></div><button type="button" disabled={selectedPaths.length === 0 || store.loadingAction === 'clean-caches'} onClick={() => { const confirmation = window.prompt('Type CLEAN to remove the selected recognized cache directories.'); if (confirmation) void store.cleanCaches(selectedPaths, confirmation); }} className="knoux-btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-rose-600 text-xs disabled:opacity-40"><Trash2 className="h-4 w-4" />{t('Clean selected', 'تنظيف المحدد')}</button></div>
      </div>
      {store.caches.length === 0 ? <InlineEmpty text={t('No cache measurements loaded.', 'لم يتم تحميل قياسات الكاش.')} /> : (
        <div className="divide-y divide-[var(--knoux-border)]">
          {store.caches.map((cache: any) => (
            <label key={cache.path} className="flex cursor-pointer items-center gap-3 p-4 hover:bg-[var(--knoux-bg-soft)]"><input type="checkbox" disabled={!cache.exists || !cache.safeToClean} checked={selected.has(cache.path)} onChange={() => setSelected((previous) => { const next = new Set(previous); next.has(cache.path) ? next.delete(cache.path) : next.add(cache.path); return next; })} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-[var(--knoux-text)]">{cache.name}</strong><span className="knoux-chip">{cache.category}</span>{cache.safeToClean ? <StatusPill icon={ShieldCheck} text={t('Allowlisted', 'مسموح')} tone="emerald" /> : <StatusPill icon={ShieldAlert} text={t('Blocked', 'محظور')} tone="rose" />}</div><p className="mt-1 truncate font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr">{cache.path}</p></div><strong className="font-mono text-sm text-purple-300">{cache.exists ? formatBytes(cache.sizeBytes) : '—'}</strong></label>
          ))}
        </div>
      )}
    </section>
  );
}

function HttpWorkspace({ store, t }: any) {
  const [headerText, setHeaderText] = useState('Accept: application/json');
  const parseHeaders = () => Object.fromEntries(headerText.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const index = line.indexOf(':'); return index === -1 ? [line, ''] : [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(340px,.8fr)_minmax(0,1.4fr)]">
      <section className="knoux-glass-panel p-5">
        <WorkspaceHeading icon={Globe2} title={t('Local HTTP laboratory', 'مختبر HTTP المحلي')} description={t('Executes explicit HTTP/HTTPS requests with timeout controls and a 512 KB response preview limit.', 'ينفذ طلبات HTTP وHTTPS صريحة مع مهلة وحد أقصى لمعاينة الاستجابة 512 كيلوبايت.')} />
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><select value={store.httpRequest.method} onChange={event => store.setHttpRequest((previous: any) => ({ ...previous, method: event.target.value }))} className="knoux-select text-xs">{['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].map(method => <option key={method}>{method}</option>)}</select><input value={store.httpRequest.url} onChange={event => store.setHttpRequest((previous: any) => ({ ...previous, url: event.target.value }))} className="knoux-input font-mono text-xs" dir="ltr" /></div>
          <label className="block"><span className="mb-2 block text-xs font-black text-[var(--knoux-text)]">{t('Headers — one per line', 'الترويسات — واحدة في كل سطر')}</span><textarea value={headerText} onChange={event => setHeaderText(event.target.value)} onBlur={() => store.setHttpRequest((previous: any) => ({ ...previous, headers: parseHeaders() }))} rows={5} className="knoux-input w-full resize-y font-mono text-xs" dir="ltr" /></label>
          <label className="block"><span className="mb-2 block text-xs font-black text-[var(--knoux-text)]">{t('Request body', 'محتوى الطلب')}</span><textarea value={store.httpRequest.body ?? ''} onChange={event => store.setHttpRequest((previous: any) => ({ ...previous, body: event.target.value || undefined }))} rows={8} className="knoux-input w-full resize-y font-mono text-xs" dir="ltr" /></label>
          <div className="flex items-center gap-3"><label className="text-xs text-[var(--knoux-subtext)]">{t('Timeout', 'المهلة')} <input type="number" min={1} max={120} value={store.httpRequest.timeoutSeconds} onChange={event => store.setHttpRequest((previous: any) => ({ ...previous, timeoutSeconds: Number(event.target.value) }))} className="knoux-input ms-2 w-20 text-xs" /> s</label><button type="button" onClick={() => { store.setHttpRequest((previous: any) => ({ ...previous, headers: parseHeaders() })); void store.executeHttpRequest(); }} disabled={store.loadingAction === 'http' || !store.runtime.available} className="knoux-btn-primary ms-auto inline-flex items-center gap-2 text-xs disabled:opacity-40"><Play className="h-4 w-4" />{t('Send request', 'إرسال الطلب')}</button></div>
        </div>
      </section>
      <section className="knoux-glass-panel min-w-0 overflow-hidden p-5">
        <h3 className="flex items-center gap-2 text-sm font-black text-[var(--knoux-text)]"><Braces className="h-4 w-4 text-blue-300" />{t('Response inspector', 'عارض الاستجابة')}</h3>
        {!store.httpResponse ? <InlineEmpty text={t('No HTTP response yet.', 'لا توجد استجابة HTTP بعد.')} /> : <div className="mt-5 space-y-4"><div className="flex flex-wrap gap-2"><StatusPill icon={CircleDot} text={`${store.httpResponse.statusCode} ${store.httpResponse.reason}`} tone={store.httpResponse.statusCode < 400 ? 'emerald' : 'rose'} /><span className="knoux-chip">{store.httpResponse.durationMs} ms</span>{store.httpResponse.contentType && <span className="knoux-chip">{store.httpResponse.contentType}</span>}{store.httpResponse.truncated && <StatusPill icon={AlertTriangle} text={t('Truncated', 'مختصرة')} tone="amber" />}</div><details className="rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-3"><summary className="cursor-pointer text-xs font-black text-[var(--knoux-text)]">{t('Response headers', 'ترويسات الاستجابة')}</summary><pre className="mt-3 overflow-auto whitespace-pre-wrap text-[11px] text-[var(--knoux-subtext)]" dir="ltr">{JSON.stringify(store.httpResponse.headers, null, 2)}</pre></details><pre className="max-h-[520px] overflow-auto rounded-2xl border border-[var(--knoux-border)] bg-black/35 p-4 text-xs leading-6 text-emerald-200" dir="ltr">{store.httpResponse.body}</pre></div>}
      </section>
    </div>
  );
}

function ReportWorkspace({ store, t }: any) {
  return (
    <section className="knoux-glass-panel p-6">
      <div className="mx-auto max-w-3xl text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-purple-500/25 bg-purple-500/10 text-purple-300"><Download className="h-8 w-8" /></div><h2 className="mt-5 text-2xl font-black text-[var(--knoux-text)]">{t('Evidence-backed developer report', 'تقرير مطور مدعوم بالأدلة')}</h2><p className="mt-3 text-sm leading-7 text-[var(--knoux-subtext)]">{t('Exports the currently loaded workstation evidence to the protected KNOUX application-data directory. Secrets are not included.', 'يصدر أدلة محطة التطوير المحملة حاليًا إلى مجلد بيانات KNOUX المحمي دون تضمين الأسرار.')}</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => void store.exportReport('json')} disabled={!store.runtime.available || store.loadingAction === 'report'} className="knoux-btn-primary inline-flex items-center gap-2 px-6"><Database className="h-4 w-4" />JSON</button><button type="button" onClick={() => void store.exportReport('markdown')} disabled={!store.runtime.available || store.loadingAction === 'report'} className="knoux-btn-secondary inline-flex items-center gap-2 px-6"><FileCode2 className="h-4 w-4" />Markdown</button></div>{store.lastReport && <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-start"><strong className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />{t('Report exported', 'تم تصدير التقرير')}</strong><p className="mt-2 break-all font-mono text-xs text-emerald-100/80" dir="ltr">{store.lastReport.path}</p></div>}</div>
    </section>
  );
}

function RootEditor({ title, roots, setRoots, placeholder, t }: any) {
  const [value, setValue] = useState('');
  const add = () => { const normalized = value.trim(); if (!normalized) return; setRoots((previous: string[]) => previous.includes(normalized) ? previous : [...previous, normalized]); setValue(''); };
  return <section className="knoux-glass-panel p-4"><h3 className="text-sm font-black text-[var(--knoux-text)]">{title}</h3><div className="mt-3 flex gap-2"><input value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') add(); }} placeholder={placeholder} className="knoux-input min-w-0 flex-1 font-mono text-xs" dir="ltr" /><button type="button" onClick={add} className="knoux-btn-primary inline-flex items-center gap-2 px-4 text-xs"><Plus className="h-4 w-4" />{t('Add', 'إضافة')}</button></div><div className="mt-3 flex flex-wrap gap-2">{roots.map((root: string) => <span key={root} className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] px-3 py-2 font-mono text-[11px] text-[var(--knoux-text)]" dir="ltr"><span className="truncate">{root}</span><button type="button" onClick={() => setRoots((previous: string[]) => previous.filter(item => item !== root))} className="text-rose-300"><X className="h-3 w-3" /></button></span>)}</div></section>;
}

function WorkspaceHeading({ icon: Icon, title, description, actionLabel, loading, onAction }: any) {
  return <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="flex items-center gap-2 text-base font-black text-[var(--knoux-text)]"><Icon className="h-5 w-5 text-purple-300" />{title}</h2><p className="mt-2 max-w-3xl text-xs leading-6 text-[var(--knoux-subtext)]">{description}</p></div>{onAction && <button type="button" onClick={onAction} disabled={loading} className="knoux-btn-secondary inline-flex shrink-0 items-center gap-2 text-xs disabled:opacity-45"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{actionLabel}</button>}</div>;
}

function ToolCard({ tool, t }: { key?: React.Key; tool: ToolchainItem; t: (en: string, ar: string) => string }) {
  const healthy = tool.status === 'healthy';
  return <article className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] p-4"><div className="flex items-start gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${healthy ? 'bg-emerald-500/10 text-emerald-300' : tool.installed ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>{healthy ? <CheckCircle2 className="h-5 w-5" /> : tool.installed ? <AlertTriangle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h3 className="truncate text-sm font-black text-[var(--knoux-text)]">{tool.name}</h3><span className="text-[10px] font-black uppercase text-[var(--knoux-subtext)]">{tool.category.replaceAll('_', ' ')}</span></div><p className="mt-1 truncate font-mono text-xs text-[var(--knoux-subtext)]" dir="ltr">{tool.installed ? tool.version || t('Version unavailable', 'الإصدار غير متاح') : t('Not installed', 'غير مثبت')}</p>{tool.path && <p className="mt-2 truncate font-mono text-[10px] text-blue-300/80" dir="ltr" title={tool.path}>{tool.path}</p>}</div></div></article>;
}

function Findings({ findings, emptyText }: { findings: string[]; emptyText: string }) {
  return <section className={`rounded-2xl border p-4 ${findings.length ? 'border-amber-500/20 bg-amber-500/5' : 'border-emerald-500/20 bg-emerald-500/5'}`}><h3 className="flex items-center gap-2 text-sm font-black text-[var(--knoux-text)]">{findings.length ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : <CheckCircle2 className="h-4 w-4 text-emerald-300" />}{findings.length ? `${findings.length} findings` : emptyText}</h3>{findings.length > 0 && <ul className="mt-3 space-y-2 text-xs leading-6 text-amber-100/80">{findings.map(finding => <li key={finding}>• {finding}</li>)}</ul>}</section>;
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction, disabled }: any) {
  return <section className="knoux-glass-panel p-12 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-purple-500/20 bg-purple-500/10 text-purple-300"><Icon className="h-8 w-8" /></div><h2 className="mt-5 text-xl font-black text-[var(--knoux-text)]">{title}</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--knoux-subtext)]">{description}</p><button type="button" onClick={onAction} disabled={disabled} className="knoux-btn-primary mt-6 px-6 disabled:opacity-45">{actionLabel}</button></section>;
}

function InlineEmpty({ text }: { text: string }) { return <div className="m-5 rounded-2xl border border-dashed border-[var(--knoux-border)] p-10 text-center text-sm text-[var(--knoux-subtext)]">{text}</div>; }
function InfoCard({ label, value, tone = 'default' }: { label: string; value?: React.ReactNode; tone?: string }) { const tones: Record<string, string> = { default: 'text-[var(--knoux-text)]', emerald: 'text-emerald-300', rose: 'text-rose-300' }; return <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-4"><span className="text-xs font-semibold text-[var(--knoux-subtext)]">{label}</span><p className={`mt-2 break-all text-sm font-black ${tones[tone] ?? tones.default}`}>{value || '—'}</p></div>; }
function KeyValue({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) { return <div className="mt-3 flex items-start justify-between gap-4 border-b border-[var(--knoux-border)] pb-3 last:border-0"><span className="text-xs text-[var(--knoux-subtext)]">{label}</span><strong className={`max-w-[65%] break-all text-end text-xs text-[var(--knoux-text)] ${mono ? 'font-mono' : ''}`}>{value || '—'}</strong></div>; }
function Metric({ label, value, tone = 'default' }: { label: string; value: React.ReactNode; tone?: string }) { const tones: Record<string, string> = { default: 'text-[var(--knoux-text)]', emerald: 'text-emerald-300', blue: 'text-blue-300', purple: 'text-purple-300', amber: 'text-amber-300', rose: 'text-rose-300' }; return <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-4"><span className="text-[11px] font-semibold text-[var(--knoux-subtext)]">{label}</span><p className={`mt-1 text-xl font-black ${tones[tone] ?? tones.default}`}>{value}</p></div>; }
function StatusPill({ icon: Icon, text, tone = 'default' }: { icon: React.ElementType; text: string; tone?: string }) { const tones: Record<string, string> = { default: 'bg-slate-500/15 text-slate-300', emerald: 'bg-emerald-500/15 text-emerald-300', blue: 'bg-blue-500/15 text-blue-300', purple: 'bg-purple-500/15 text-purple-300', amber: 'bg-amber-500/15 text-amber-300', rose: 'bg-rose-500/15 text-rose-300' }; return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${tones[tone] ?? tones.default}`}><Icon className="h-3 w-3" />{text}</span>; }
function Notice({ tone, title, message }: { tone: 'amber' | 'rose'; title: string; message: string }) { return <section className={`rounded-2xl border p-4 ${tone === 'amber' ? 'border-amber-500/25 bg-amber-500/10 text-amber-100' : 'border-rose-500/25 bg-rose-500/10 text-rose-100'}`}><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">{title}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-6 opacity-80">{message}</p></div></div></section>; }
function formatBytes(bytes: number) { if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'; const units = ['B','KB','MB','GB','TB']; const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))); return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`; }
