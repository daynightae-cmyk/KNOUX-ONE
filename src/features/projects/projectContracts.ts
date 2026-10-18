/**
 * KNOUX ONE — Module 16 Code & Project Workspace Contracts
 *
 * These types mirror the native contracts in src-tauri/src/projects/contracts.rs exactly.
 * Every field below is produced by a measured local inspection; nothing is mocked.
 */

export interface ProjectRecord {
  id: string;
  canonicalPath: string;
  name: string;
  ecosystems: string[];
  frameworks: string[];
  manifests: string[];
  packageManager?: string | null;
  gitRepository: boolean;
  branch?: string | null;
  fileCount: number;
  sourceFileCount: number;
  manifestCount: number;
  sizeBytes: number;
  buildArtifactBytes: number;
  lastModified: string;
  confidence: number;
  warnings: string[];
}

export interface ProjectDiscoverResult {
  projects: ProjectRecord[];
  scannedRoots: string[];
  skippedProtectedRoots: string[];
  warnings: string[];
}

export type HealthSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info' | string;

export interface HealthFinding {
  code: string;
  severity: HealthSeverity;
  title: string;
  evidencePath?: string | null;
  line?: number | null;
  redactedPreview?: string | null;
  weight: number;
}

export interface ProjectHealthResult {
  healthScore: number;
  scoreFormula: string;
  findings: HealthFinding[];
  checkedFiles: number;
  warnings: string[];
}

export interface DependencyItem {
  name: string;
  version: string;
  depType: string;
  isPinned: boolean;
  sourceManifest: string;
}

export interface DependencyAuditResult {
  ecosystems: string[];
  manifests: string[];
  lockfiles: string[];
  lockfileStatus: string;
  dependencies: DependencyItem[];
  unpinnedCount: number;
  riskFindings: string[];
  auditCommands: string[];
  warnings: string[];
}

export interface ProjectTask {
  id: string;
  label: string;
  program: string;
  args: string[];
  preview: string;
  risk: string;
  requiresConfirmation: boolean;
}

export interface CommandRun {
  taskId: string;
  commandPreview: string;
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface CommandManageResult {
  tasks: ProjectTask[];
  run?: CommandRun | null;
  warnings: string[];
}

export interface EnvironmentKeyFinding {
  key: string;
  presentInRuntimeFile: boolean;
  presentInTemplate: boolean;
  emptyValue: boolean;
  duplicateCount: number;
}

export interface EnvironmentAuditResult {
  runtimeFiles: string[];
  templateFiles: string[];
  keys: EnvironmentKeyFinding[];
  missingKeys: string[];
  obsoleteKeys: string[];
  malformedLines: string[];
  runtimeVersions: string[];
  warnings: string[];
}

export interface SourceMetric {
  language: string;
  files: number;
  bytes: number;
}

export interface SourceFileMetric {
  path: string;
  sizeBytes: number;
}

export interface SourceAnalyzeResult {
  fileCount: number;
  sourceFileCount: number;
  testFileCount: number;
  configFileCount: number;
  todoCount: number;
  mergeConflictCount: number;
  languages: SourceMetric[];
  largestFiles: SourceFileMetric[];
  warnings: string[];
}

export interface CacheTarget {
  id: string;
  path: string;
  relativePath: string;
  category: string;
  sizeBytes: number;
  safeToClean: boolean;
}

export interface CacheManageResult {
  targets: CacheTarget[];
  reclaimedBytes: number;
  cleanedPaths: string[];
  warnings: string[];
}

export interface GitWorkspaceResult {
  repositoryRoot?: string | null;
  branch: string;
  detached: boolean;
  isClean: boolean;
  staged: string[];
  modified: string[];
  untracked: string[];
  conflicted: string[];
  ahead: number;
  behind: number;
  remote?: string | null;
  warnings: string[];
}

export interface RuntimeProcess {
  pid: number;
  processName: string;
  executablePath?: string | null;
  commandLine?: string | null;
  ports: number[];
  projectMatchEvidence: string;
  protected: boolean;
}

export interface RuntimeManageResult {
  processes: RuntimeProcess[];
  terminatedPid?: number | null;
  warnings: string[];
}

export type ReportFormat = 'json' | 'markdown' | 'html' | 'csv';

export interface ReportsExportResult {
  reportId: string;
  reportPath: string;
  format: string;
  sizeBytes: number;
  createdAt: string;
  warnings: string[];
}

export type ProjectTab =
  | 'overview'
  | 'health'
  | 'dependencies'
  | 'tasks'
  | 'environment'
  | 'source'
  | 'cache'
  | 'git'
  | 'runtime'
  | 'reports';

export interface ProjectStoreError {
  code: string;
  message: string;
}
