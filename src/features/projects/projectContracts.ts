/**
 * KNOUX ONE — Module 16 Code & Project Workspace Contracts
 */

export interface RepositoryItem {
  id: string;
  name: string;
  path: string;
  type: 'node' | 'rust' | 'python' | 'go' | 'dotnet' | 'unknown';
  branch: string;
  hasUncommittedChanges: boolean;
  uncommittedFilesCount: number;
  aheadCommitCount: number;
  behindCommitCount: number;
  lastCommitMessage?: string;
  lastCommitTime?: string;
}

export interface DependencyAuditIssue {
  id: string;
  packageName: string;
  installedVersion: string;
  patchedVersion: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  vulnerabilityTitle: string;
  ecosystem: 'npm' | 'cargo' | 'pip' | 'nuget';
}

export interface BuildCacheItem {
  id: string;
  projectName: string;
  path: string;
  cacheType: 'node_modules' | 'target' | 'dist' | '.next' | '__pycache__';
  sizeBytes: number;
}
