export type NetworkAction =
  | 'inspect'
  | 'test'
  | 'trace'
  | 'benchmark'
  | 'flush'
  | 'renew'
  | 'reset'
  | 'export';

export interface NetworkRequest {
  action: NetworkAction;
  target?: string;
  count?: number;
  timeoutMs?: number;
  maxHops?: number;
  confirmation?: string;
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

export interface NetworkArtifact {
  path: string;
  kind: string;
  exists: boolean;
  sizeBytes: number;
}

export interface NetworkReport {
  service: string;
  action: string;
  elevated: boolean;
  requiresRestart: boolean;
  target?: string;
  details: unknown;
  commands: CommandEvidence[];
  artifacts: NetworkArtifact[];
  notes: string[];
  evidencePath?: string;
  measuredAt: string;
}
