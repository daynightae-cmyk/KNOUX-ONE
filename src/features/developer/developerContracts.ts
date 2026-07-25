/** KNOUX ONE — Module 15 Developer Studio Contracts */
export type DeveloperTab = 'overview' | 'path' | 'runtimes' | 'git' | 'repositories' | 'ports' | 'projects' | 'caches' | 'http' | 'report';

export interface ToolchainItem {
  id: string;
  name: string;
  category: 'compiler' | 'runtime' | 'vcs' | 'container' | 'package_manager' | 'runtime_manager' | 'editor' | string;
  installed: boolean;
  version?: string;
  path?: string;
  status: 'healthy' | 'outdated' | 'missing' | 'misconfigured';
}

export interface EnvironmentDiscovery {
  tools: ToolchainItem[];
  computerName: string;
  userName: string;
  shell: string;
  architecture: string;
  discoveredAt: string;
}

export interface PathEntry {
  id: string;
  path: string;
  scope: 'system' | 'user';
  exists: boolean;
  isDuplicate: boolean;
  normalizedPath: string;
}

export interface PathAudit {
  entries: PathEntry[];
  duplicateCount: number;
  missingCount: number;
  userEntryCount: number;
  systemEntryCount: number;
}

export interface RuntimeManager {
  id: string;
  name: string;
  installed: boolean;
  version?: string;
  path?: string;
}

export interface RuntimeInspection {
  managers: RuntimeManager[];
  nodePrefix?: string;
  pythonHome?: string;
  rustupHome?: string;
  cargoHome?: string;
  dotnetRoot?: string;
}

export interface GitAudit {
  installed: boolean;
  version?: string;
  executablePath?: string;
  userName?: string;
  userEmail?: string;
  defaultBranch?: string;
  autocrlf?: string;
  credentialHelper?: string;
  signingKeyConfigured: boolean;
  commitSigningEnabled: boolean;
  findings: string[];
}

export interface RepositoryInfo {
  path: string;
  name: string;
  branch: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  remote?: string;
  lastCommit?: string;
  status: 'clean' | 'dirty' | string;
}

export interface RepositoryScanResult {
  repositories: RepositoryInfo[];
  scannedRoots: string[];
  warnings: string[];
}

export interface ActivePortProcess {
  pid: number;
  processName: string;
  port: number;
  protocol: 'TCP' | 'UDP';
  state: string;
  localAddress: string;
  commandLine?: string;
  protected: boolean;
}

export interface PortManageResult {
  processes: ActivePortProcess[];
  terminatedPid?: number;
}

export interface ProjectHealthItem {
  path: string;
  name: string;
  ecosystem: string;
  manifest: string;
  lockfiles: string[];
  status: 'healthy' | 'review' | string;
  findings: string[];
}

export interface ProjectAuditResult {
  projects: ProjectHealthItem[];
  warnings: string[];
}

export interface CacheEntry {
  id: string;
  name: string;
  path: string;
  category: string;
  sizeBytes: number;
  exists: boolean;
  safeToClean: boolean;
}

export interface CacheManageResult {
  entries: CacheEntry[];
  reclaimedBytes: number;
  cleanedPaths: string[];
  warnings: string[];
}

export interface HttpLabRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutSeconds: number;
}

export interface HttpLabResponse {
  statusCode: number;
  reason: string;
  durationMs: number;
  contentType?: string;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
}

export interface DeveloperReportResult {
  reportId: string;
  path: string;
  format: 'json' | 'md' | string;
  createdAt: string;
}

export interface DeveloperStudioError {
  code: string;
  message: string;
}
