export interface HardwareItem {
  name: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  status: string;
}

export interface DiskItem {
  deviceId: string;
  model: string;
  mediaType: string;
  interfaceType: string;
  serialNumber: string;
  sizeBytes?: number | null;
  status: string;
}

export interface GpuItem {
  name: string;
  driverVersion: string;
  adapterRamBytes?: number | null;
  status: string;
}

export interface SystemDiscoveryData {
  computerName: string;
  manufacturer: string;
  computerModel: string;
  systemType: string;
  osProductName: string;
  osEdition: string;
  osVersion: string;
  buildNumber: string;
  architecture: string;
  installDate: string;
  lastBootTime: string;
  totalRamGb?: number | null;
  availableRamGb?: number | null;
  cpuModel: string;
  cpuCores?: number | null;
  cpuLogicalProcessors?: number | null;
  activeUser: string;
  secureBootEnabled?: boolean | null;
  tpmAvailable?: boolean | null;
  tpmReady?: boolean | null;
  bios: HardwareItem[];
  baseboards: HardwareItem[];
  disks: DiskItem[];
  gpus: GpuItem[];
  batteries: HardwareItem[];
  evidenceSource: string;
  measuredAt: string;
}

export interface InstallQueueItem {
  queueId: string;
  packageId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'interrupted' | string;
  attempts: number;
  queuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  exitCode?: number | null;
  requiresRestart: boolean;
  lastError?: string | null;
}
