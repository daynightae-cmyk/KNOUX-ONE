export interface StorageFileItem {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  accessedAt?: string | null;
  ageBasis?: 'last_access' | 'modified_fallback' | string;
  extension: string;
  category: string;
}

export interface StorageFolderItem {
  path: string;
  sizeBytes: number;
  fileCount: number;
}

export interface StorageTypeItem {
  category: string;
  extension: string;
  sizeBytes: number;
  fileCount: number;
}

export interface StorageOldFilesSummary {
  thresholdDays: number;
  fileCount: number;
  sizeBytes: number;
  largestFiles: StorageFileItem[];
  accessTimeSupported?: boolean;
  fallbackFileCount?: number;
}

export interface StorageAnalysisResult {
  scanId: string;
  rootPath: string;
  totalFiles: number;
  totalDirectories: number;
  totalBytes: number;
  inaccessibleItems: number;
  truncated: boolean;
  cancelled: boolean;
  largestFiles: StorageFileItem[];
  largestFolders: StorageFolderItem[];
  typeDistribution: StorageTypeItem[];
  oldFiles: StorageOldFilesSummary;
  scannedAt: string;
  warnings: string[];
}

export interface PhysicalStorageDevice {
  friendlyName: string;
  serialNumber: string;
  mediaType: string;
  busType: string;
  healthStatus: string;
  sizeBytes?: number | null;
}

export interface StorageDriveInfo {
  rootPath: string;
  driveType: string;
  totalBytes: number;
  freeBytes: number;
  availableBytes: number;
  usedBytes: number;
  freePercent: number;
  isExternal: boolean;
  isRemote: boolean;
  volumeLabel?: string;
  fileSystem?: string;
}

export interface StorageDriveInventory {
  drives: StorageDriveInfo[];
  devices?: PhysicalStorageDevice[];
  measuredAt: string;
  warnings: string[];
}

export interface StorageSpaceAlert {
  rootPath: string;
  freePercent: number;
  freeBytes: number;
  thresholdPercent: number;
  belowThreshold: boolean;
}

export interface StorageSpaceCheckResult {
  alerts: StorageSpaceAlert[];
  checkedAt: string;
  backgroundMonitoringEnabled: boolean;
  monitorIntervalMinutes?: number;
  warnings: string[];
}

export interface StorageReportExportResult {
  scanId: string;
  format: 'json' | 'pdf+json';
  path: string;
  byteCount: number;
  jsonEvidencePath?: string;
}

export interface StorageProgress {
  operationId: string;
  phase: 'scanning' | 'scanning_access_times' | 'scan_complete' | 'cancelled';
  filesProcessed: number;
  directoriesProcessed: number;
  bytesProcessed: number;
  currentPath?: string;
}
