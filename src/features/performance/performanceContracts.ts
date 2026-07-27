export interface CpuCoreSample {
  name: string;
  utilizationPercent: number;
}

export interface CpuSnapshot {
  model: string;
  logicalProcessors: number;
  currentMhz: number;
  maxMhz: number;
  totalPercent: number;
  cores: CpuCoreSample[];
  measuredAt: string;
}

export interface MemorySnapshot {
  totalPhysicalBytes: number;
  availablePhysicalBytes: number;
  usedPhysicalBytes: number;
  committedBytes: number;
  commitLimitBytes: number;
  cacheBytes: number;
  loadPercent: number;
  measuredAt: string;
}

export interface DiskSample {
  name: string;
  readBytesPerSec: number;
  writeBytesPerSec: number;
  transfersPerSec: number;
  activeTimePercent: number;
  queueLength: number;
}

export interface DiskActivitySnapshot {
  disks: DiskSample[];
  measuredAt: string;
}

export interface NetworkAdapterSample {
  name: string;
  bytesReceivedPerSec: number;
  bytesSentPerSec: number;
  bytesTotalPerSec: number;
}

export interface ProcessConnectionSample {
  pid: number;
  processName: string;
  connectionCount: number;
}

export interface NetworkActivitySnapshot {
  adapters: NetworkAdapterSample[];
  processConnections: ProcessConnectionSample[];
  bandwidthNoticeEn: string;
  bandwidthNoticeAr: string;
  measuredAt: string;
}

export interface ProcessItem {
  pid: number;
  parentPid?: number;
  name: string;
  executablePath?: string;
  commandLine?: string;
  workingSetBytes: number;
  privateMemoryBytes: number;
  cpuSeconds: number;
  threadCount: number;
  handleCount: number;
  priority: string;
  pathVerified: boolean;
  protected: boolean;
}

export interface ProcessExplorerSnapshot {
  processes: ProcessItem[];
  totalProcesses: number;
  truncated: boolean;
  measuredAt: string;
}

export interface HeavyProcessItem {
  pid: number;
  name: string;
  cpuPercent: number;
  workingSetBytes: number;
  privateMemoryBytes: number;
  threadCount: number;
  protected: boolean;
  reasons: string[];
}

export interface HeavyProcessReport {
  processes: HeavyProcessItem[];
  cpuAttentionPercent: number;
  memoryAttentionBytes: number;
  sampleIntervalMs: number;
  leakNoticeEn: string;
  leakNoticeAr: string;
  measuredAt: string;
}

export interface PriorityChange {
  id: string;
  pid: number;
  processName: string;
  previousPriority: string;
  newPriority: string;
  createdAt: string;
  restoredAt?: string;
}

export interface PriorityResult {
  activeChanges: PriorityChange[];
  process?: ProcessItem;
  message: string;
}

export type PriorityRequest =
  | { action: 'list' }
  | { action: 'set'; pid: number; priority: 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High'; confirmation: string }
  | { action: 'restore'; changeId: string; confirmation: string };

export interface PowerPlan {
  guid: string;
  name: string;
  active: boolean;
}

export interface PowerPlanSnapshot {
  activeGuid: string;
  plans: PowerPlan[];
}

export interface PowerPlanChange {
  id: string;
  previousGuid: string;
  selectedGuid: string;
  createdAt: string;
  restoredAt?: string;
}

export interface PowerPlanResult {
  snapshot: PowerPlanSnapshot;
  activeChanges: PowerPlanChange[];
  message: string;
}

export type PowerPlanRequest =
  | { action: 'list' }
  | { action: 'set'; guid: string; confirmation: string }
  | { action: 'restore'; changeId: string; confirmation: string };

export interface PerformanceProfile {
  id: string;
  name: string;
  powerSchemeGuid: string;
  cpuAttentionPercent: number;
  memoryAttentionPercent: number;
  createdAt: string;
  appliedAt?: string;
}

export interface ProfileResult {
  profiles: PerformanceProfile[];
  activeProfileId?: string;
  power: PowerPlanSnapshot;
  message: string;
}

export type ProfileRequest =
  | { action: 'list' }
  | {
      action: 'create';
      name: string;
      powerSchemeGuid: string;
      cpuAttentionPercent: number;
      memoryAttentionPercent: number;
    }
  | { action: 'apply'; profileId: string; confirmation: string }
  | { action: 'delete'; profileId: string; confirmation: string };

export interface BenchmarkReport {
  cpuHashIterations: number;
  cpuHashesPerSec: number;
  diskTestBytes: number;
  diskWriteMbps: number;
  diskReadMbps: number;
  temporaryFileRemoved: boolean;
  reportPath: string;
  measuredAt: string;
  noticeEn: string;
  noticeAr: string;
}
