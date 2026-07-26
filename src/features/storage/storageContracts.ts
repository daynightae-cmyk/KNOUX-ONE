export interface StorageFileItem {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
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
}

export interface StorageDriveInventory {
  drives: StorageDriveInfo[];
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
  warnings: string[];
}

export interface StorageReportExportResult {
  scanId: string;
  format: 'json';
  path: string;
  byteCount: number;
}

export interface StorageProgress {
  operationId: string;
  phase: 'scanning' | 'scan_complete' | 'cancelled';
  filesProcessed: number;
  directoriesProcessed: number;
  bytesProcessed: number;
  currentPath?: string;
}
