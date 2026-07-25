import { useCallback, useMemo, useState } from 'react';
import { NativeClient } from '../../services/nativeClient';
import type {
  ActivePortProcess,
  CacheEntry,
  CacheManageResult,
  DeveloperReportResult,
  DeveloperStudioError,
  DeveloperTab,
  EnvironmentDiscovery,
  GitAudit,
  HttpLabRequest,
  HttpLabResponse,
  PathAudit,
  PortManageResult,
  ProjectAuditResult,
  ProjectHealthItem,
  RepositoryInfo,
  RepositoryScanResult,
  RuntimeInspection,
} from './developerContracts';

const DEFAULT_HTTP_REQUEST: HttpLabRequest = {
  method: 'GET',
  url: 'https://api.github.com',
  headers: { Accept: 'application/json' },
  timeoutSeconds: 30,
};

export function useDeveloperStore() {
  const runtime = useMemo(() => NativeClient.getRuntimeState(), []);
  const [activeTab, setActiveTab] = useState<DeveloperTab>('overview');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<DeveloperStudioError | null>(null);
  const [environment, setEnvironment] = useState<EnvironmentDiscovery | null>(null);
  const [pathAudit, setPathAudit] = useState<PathAudit | null>(null);
  const [runtimeInspection, setRuntimeInspection] = useState<RuntimeInspection | null>(null);
  const [gitAudit, setGitAudit] = useState<GitAudit | null>(null);
  const [repositories, setRepositories] = useState<RepositoryInfo[]>([]);
  const [repositoryRoots, setRepositoryRoots] = useState<string[]>([]);
  const [activePorts, setActivePorts] = useState<ActivePortProcess[]>([]);
  const [projects, setProjects] = useState<ProjectHealthItem[]>([]);
  const [projectRoots, setProjectRoots] = useState<string[]>([]);
  const [caches, setCaches] = useState<CacheEntry[]>([]);
  const [httpRequest, setHttpRequest] = useState<HttpLabRequest>(DEFAULT_HTTP_REQUEST);
  const [httpResponse, setHttpResponse] = useState<HttpLabResponse | null>(null);
  const [lastReport, setLastReport] = useState<DeveloperReportResult | null>(null);

  const execute = useCallback(async <T,>(capabilityId: string, handlerId: string, parameters: Record<string, unknown> = {}) => {
    setError(null);
    if (!runtime.available) {
      const unavailable = {
        code: 'desktop_runtime_unavailable',
        message: runtime.reasonEn ?? 'Open KNOUX ONE Desktop to inspect this Windows device.',
      };
      setError(unavailable);
      throw new Error(unavailable.message);
    }
    const result = await NativeClient.executeCapability<T>(capabilityId, handlerId, parameters);
    if (result.status !== 'completed' && result.status !== 'completed_with_warnings') {
      const failure = { code: result.errorCode ?? 'native_operation_failed', message: result.summaryEn };
      setError(failure);
      throw new Error(failure.message);
    }
    if (!result.data) throw new Error('Native operation returned no data.');
    if (result.warnings.length > 0) setError({ code: 'completed_with_warnings', message: result.warnings.join('\n') });
    return result.data;
  }, [runtime]);

  const discoverEnvironment = useCallback(async () => {
    setLoadingAction('environment');
    try {
      const data = await execute<EnvironmentDiscovery>('m15_s01', 'm15.environment.discover');
      setEnvironment(data);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const auditPath = useCallback(async () => {
    setLoadingAction('path');
    try {
      const data = await execute<PathAudit>('m15_s02', 'm15.path.audit');
      setPathAudit(data);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const inspectRuntimes = useCallback(async () => {
    setLoadingAction('runtimes');
    try {
      const data = await execute<RuntimeInspection>('m15_s03', 'm15.runtime.inspect');
      setRuntimeInspection(data);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const auditGit = useCallback(async () => {
    setLoadingAction('git');
    try {
      const data = await execute<GitAudit>('m15_s04', 'm15.git.audit');
      setGitAudit(data);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const scanRepositories = useCallback(async () => {
    if (repositoryRoots.length === 0) {
      setError({ code: 'repository_root_required', message: 'Add at least one repository search root.' });
      return;
    }
    setLoadingAction('repositories');
    try {
      const data = await execute<RepositoryScanResult>('m15_s05', 'm15.repositories.scan', {
        request: { roots: repositoryRoots, maxDepth: 7 },
      });
      setRepositories(data.repositories);
    } finally {
      setLoadingAction(null);
    }
  }, [execute, repositoryRoots]);

  const inspectPorts = useCallback(async () => {
    setLoadingAction('ports');
    try {
      const data = await execute<PortManageResult>('m15_s06', 'm15.ports.manage', {
        request: { action: 'inspect' },
      });
      setActivePorts(data.processes);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const terminateProcess = useCallback(async (pid: number, confirmation: string) => {
    setLoadingAction(`terminate:${pid}`);
    try {
      const data = await execute<PortManageResult>('m15_s06', 'm15.ports.manage', {
        request: { action: 'terminate', pid, confirmation },
      });
      setActivePorts(data.processes);
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  const auditProjects = useCallback(async () => {
    if (projectRoots.length === 0) {
      setError({ code: 'project_root_required', message: 'Add at least one project search root.' });
      return;
    }
    setLoadingAction('projects');
    try {
      const data = await execute<ProjectAuditResult>('m15_s07', 'm15.projects.audit', {
        request: { roots: projectRoots, maxDepth: 7 },
      });
      setProjects(data.projects);
    } finally {
      setLoadingAction(null);
    }
  }, [execute, projectRoots]);

  const inspectCaches = useCallback(async () => {
    setLoadingAction('caches');
    try {
      const roots = Array.from(new Set([...projectRoots, ...repositoryRoots]));
      const data = await execute<CacheManageResult>('m15_s08', 'm15.caches.manage', {
        request: { action: 'inspect', projectRoots: roots },
      });
      setCaches(data.entries);
      return data;
    } finally {
      setLoadingAction(null);
    }
  }, [execute, projectRoots, repositoryRoots]);

  const cleanCaches = useCallback(async (paths: string[], confirmation: string) => {
    setLoadingAction('clean-caches');
    try {
      await execute<CacheManageResult>('m15_s08', 'm15.caches.manage', {
        request: { action: 'clean', paths, confirmation },
      });
      await inspectCaches();
    } finally {
      setLoadingAction(null);
    }
  }, [execute, inspectCaches]);

  const executeHttpRequest = useCallback(async () => {
    setLoadingAction('http');
    setHttpResponse(null);
    try {
      const data = await execute<HttpLabResponse>('m15_s09', 'm15.http.execute', {
        request: httpRequest,
      });
      setHttpResponse(data);
    } finally {
      setLoadingAction(null);
    }
  }, [execute, httpRequest]);

  const exportReport = useCallback(async (format: 'json' | 'markdown') => {
    setLoadingAction('report');
    try {
      const data = await execute<DeveloperReportResult>('m15_s10', 'm15.report.export', {
        request: {
          title: 'KNOUX ONE Developer Environment Report',
          format,
          sections: {
            environment,
            pathAudit,
            runtimeInspection,
            gitAudit,
            repositories,
            activePorts,
            projects,
            caches,
            generatedFrom: 'KNOUX ONE Developer Studio',
          },
        },
      });
      setLastReport(data);
    } finally {
      setLoadingAction(null);
    }
  }, [activePorts, caches, environment, execute, gitAudit, pathAudit, projects, repositories, runtimeInspection]);

  const refreshDiagnostics = useCallback(async () => {
    setLoadingAction('full-audit');
    setError(null);
    try {
      const [environmentData, pathData, runtimeData, gitData, portsData] = await Promise.all([
        execute<EnvironmentDiscovery>('m15_s01', 'm15.environment.discover'),
        execute<PathAudit>('m15_s02', 'm15.path.audit'),
        execute<RuntimeInspection>('m15_s03', 'm15.runtime.inspect'),
        execute<GitAudit>('m15_s04', 'm15.git.audit'),
        execute<PortManageResult>('m15_s06', 'm15.ports.manage', { request: { action: 'inspect' } }),
      ]);
      setEnvironment(environmentData);
      setPathAudit(pathData);
      setRuntimeInspection(runtimeData);
      setGitAudit(gitData);
      setActivePorts(portsData.processes);
    } finally {
      setLoadingAction(null);
    }
  }, [execute]);

  return {
    runtime,
    activeTab,
    setActiveTab,
    loadingAction,
    isLoading: loadingAction !== null,
    error,
    setError,
    environment,
    toolchains: environment?.tools ?? [],
    pathAudit,
    runtimeInspection,
    gitAudit,
    repositories,
    repositoryRoots,
    setRepositoryRoots,
    activePorts,
    projects,
    projectRoots,
    setProjectRoots,
    caches,
    httpRequest,
    setHttpRequest,
    httpResponse,
    lastReport,
    refreshDiagnostics,
    discoverEnvironment,
    auditPath,
    inspectRuntimes,
    auditGit,
    scanRepositories,
    inspectPorts,
    terminateProcess,
    auditProjects,
    inspectCaches,
    cleanCaches,
    executeHttpRequest,
    exportReport,
  };
}
