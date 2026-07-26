export interface StartupItem {
  id: string;
  name: string;
  command: string;
  executablePath?: string;
  sourceKind: string;
  sourcePath: string;
  scope: string;
  publisher: string;
  signatureStatus: string;
  protected: boolean;
  mutable: boolean;
  enabled: boolean;
  impactScore: number;
  impactLabel: string;
  impactBasis: string[];
}

export interface ScheduledTaskItem {
  id: string;
  taskName: string;
  taskPath: string;
  state: string;
  enabled: boolean;
  author: string;
  action: string;
  trigger: string;
  protected: boolean;
}

export interface WindowsServiceItem {
  id: string;
  name: string;
  displayName: string;
  state: string;
  startMode: string;
  pathName: string;
  publisher: string;
  signatureStatus: string;
  protected: boolean;
  recommendation: string;
}

export interface BootMetric {
  measuredAt: string;
  bootDurationMs?: number;
  mainPathBootMs?: number;
  bootPostBootMs?: number;
  source: string;
}

export interface ImpactSummary {
  items: StartupItem[];
  bootHistory: BootMetric[];
  averageBootMs?: number;
  highAttentionCount: number;
  scoringNoticeEn: string;
  scoringNoticeAr: string;
  measuredAt: string;
}

export interface RecommendationItem {
  itemId: string;
  itemName: string;
  severity: string;
  recommendationEn: string;
  recommendationAr: string;
  reasons: string[];
  automaticChangeAllowed: boolean;
}

export interface RecommendationReport {
  recommendations: RecommendationItem[];
  protectedCount: number;
  mutableCount: number;
  measuredAt: string;
}

export interface ChangeRecord {
  id: string;
  itemId: string;
  itemName: string;
  kind: string;
  sourceKind: string;
  sourcePath: string;
  valueName?: string;
  originalCommand: string;
  backupPath?: string;
  delayedTaskName?: string;
  createdAt: string;
  restoredAt?: string;
}

export interface StartupProfile {
  id: string;
  name: string;
  enabledItemIds: string[];
  createdAt: string;
  appliedAt?: string;
}

export interface MutationResult {
  item?: StartupItem;
  change?: ChangeRecord;
  activeChanges: ChangeRecord[];
  message: string;
}

export interface ProfileResult {
  profiles: StartupProfile[];
  activeChanges: ChangeRecord[];
  appliedProfileId?: string;
  message: string;
}

export type StartupChangeRequest = {
  action: 'disable';
  itemId: string;
  confirmation: string;
};

export type DelayRequest =
  | { action: 'list' }
  | { action: 'create'; itemId: string; delaySeconds: 30 | 60 | 90; confirmation: string }
  | { action: 'remove'; changeId: string; confirmation: string };

export type ProfileRequest =
  | { action: 'list' }
  | { action: 'create'; name: string; enabledItemIds: string[] }
  | { action: 'apply'; profileId: string; confirmation: string }
  | { action: 'delete'; profileId: string; confirmation: string };

export type RestoreRequest =
  | { action: 'list' }
  | { action: 'restore'; changeId: string; confirmation: string };
