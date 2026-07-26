/** KNOUX ONE — Module 16 Project Engineering contracts. */
export interface ProjectRecord { id:string; canonicalPath:string; name:string; ecosystems:string[]; frameworks:string[]; manifests:string[]; packageManager?:string; gitRepository:boolean; branch?:string; fileCount:number; sourceFileCount:number; manifestCount:number; sizeBytes:number; buildArtifactBytes:number; lastModified:string; confidence:number; warnings:string[]; }
export interface ProjectDiscoverResult { projects:ProjectRecord[]; scannedRoots:string[]; skippedProtectedRoots:string[]; warnings:string[]; }
export interface HealthFinding { code:string; severity:'info'|'low'|'medium'|'high'|string; title:string; evidencePath?:string; line?:number; redactedPreview?:string; weight:number; }
export interface ProjectHealthResult { healthScore:number; scoreFormula:string; findings:HealthFinding[]; checkedFiles:number; warnings:string[]; }
export interface DependencyItem { name:string; version:string; depType:string; isPinned:boolean; sourceManifest:string; }
export interface DependencyAuditResult { ecosystems:string[]; manifests:string[]; lockfiles:string[]; lockfileStatus:'verified'|'missing'|'conflict'|string; dependencies:DependencyItem[]; unpinnedCount:number; riskFindings:string[]; auditCommands:string[]; warnings:string[]; }
export interface ProjectTask { id:string; label:string; program:string; args:string[]; preview:string; risk:'safe'|'moderate'|'high'|string; requiresConfirmation:boolean; }
export interface CommandRun { taskId:string; commandPreview:string; success:boolean; exitCode:number; stdout:string; stderr:string; durationMs:number; }
export interface CommandManageResult { tasks:ProjectTask[]; run?:CommandRun; warnings:string[]; }
export interface EnvironmentKeyFinding { key:string; presentInRuntimeFile:boolean; presentInTemplate:boolean; emptyValue:boolean; duplicateCount:number; }
export interface EnvironmentAuditResult { runtimeFiles:string[]; templateFiles:string[]; keys:EnvironmentKeyFinding[]; missingKeys:string[]; obsoleteKeys:string[]; malformedLines:string[]; runtimeVersions:string[]; warnings:string[]; }
export interface SourceMetric { language:string; files:number; bytes:number }
export interface SourceFileMetric { path:string; sizeBytes:number }
export interface SourceAnalyzeResult { fileCount:number; sourceFileCount:number; testFileCount:number; configFileCount:number; todoCount:number; mergeConflictCount:number; languages:SourceMetric[]; largestFiles:SourceFileMetric[]; warnings:string[]; }
export interface CacheTarget { id:string; path:string; relativePath:string; category:string; sizeBytes:number; safeToClean:boolean; }
export interface CacheManageResult { targets:CacheTarget[]; reclaimedBytes:number; cleanedPaths:string[]; warnings:string[]; }
export interface GitWorkspaceResult { repositoryRoot?:string; branch:string; detached:boolean; isClean:boolean; staged:string[]; modified:string[]; untracked:string[]; conflicted:string[]; ahead:number; behind:number; remote?:string; warnings:string[]; }
export interface RuntimeProcess { pid:number; processName:string; executablePath?:string; commandLine?:string; ports:number[]; projectMatchEvidence:string; protected:boolean; }
export interface RuntimeManageResult { processes:RuntimeProcess[]; terminatedPid?:number; warnings:string[]; }
export type ReportFormat='json'|'markdown'|'html'|'csv';
export interface ReportsExportResult { reportId:string; reportPath:string; format:ReportFormat|string; sizeBytes:number; createdAt:string; warnings:string[]; }
export type ProjectTab='overview'|'health'|'dependencies'|'commands'|'environment'|'sourceMap'|'cache'|'git'|'runtime'|'reports';
export interface ProjectStoreError { code:string; message:string }
