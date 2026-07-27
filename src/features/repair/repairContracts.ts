export type RepairAction =
  | 'verify'
  | 'repair'
  | 'inspect'
  | 'scan'
  | 'reset'
  | 'restore'
  | 'rebuild'
  | 'salvage';

export interface RepairRequest {
  action: RepairAction;
  confirmation?: string;
  targetId?: string;
}

export interface CommandEvidence {
  program: string;
  arguments: string[];
  exitCode?: number;
  success: boolean;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RepairArtifact {
  path: string;
  sizeBytes: number;
  status: string;
}

export interface UpdateBackup {
  id: string;
  softwareDistributionBackup?: string;
  catroot2Backup?: string;
  createdAt: string;
  restoredAt?: string;
}

export interface RepairReport {
  service: string;
  action: string;
  elevated: boolean;
  requiresRestart: boolean;
  commands: CommandEvidence[];
  artifacts: RepairArtifact[];
  updateBackups: UpdateBackup[];
  notes: string[];
  evidencePath?: string;
  measuredAt: string;
}
