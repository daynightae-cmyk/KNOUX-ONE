/**
 * KNOUX ONE — Module 15 Developer Studio Contracts
 */

export interface ToolchainItem {
  id: string;
  name: string;
  category: 'compiler' | 'runtime' | 'vcs' | 'container' | 'package_manager' | 'mobile';
  installed: boolean;
  version?: string;
  path?: string;
  recommendedVersion?: string;
  status: 'healthy' | 'outdated' | 'missing' | 'misconfigured';
}

export interface PathEntry {
  id: string;
  path: string;
  scope: 'system' | 'user';
  exists: boolean;
  isDuplicate: boolean;
  isRecommended: boolean;
}

export interface ActivePortProcess {
  pid: number;
  processName: string;
  port: number;
  protocol: 'TCP' | 'UDP';
  state: 'LISTEN' | 'ESTABLISHED' | 'CLOSE_WAIT';
  commandLine?: string;
}

export interface DeveloperHealthIssue {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  fixCapabilityId?: string;
}
