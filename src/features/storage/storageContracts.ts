/** The three states a row's age can honestly be based on. These are not interchangeable. */
export type StorageAgeBasis = 'LAST_ACCESS' | 'LAST_WRITE_FALLBACK' | 'UNKNOWN';

export type StorageAgePolicyState =
  | 'last_access_updates_enabled'
  | 'last_access_updates_disabled'
  | 'system_managed'
  | 'unknown';

export interface StorageAgePolicy {
  /** Where the measurement came from: `fsutil`, `registry`, or `unknown`. */
  source: 'fsutil' | 'registry' | 'unknown' | string;
  /** The value Windows reported, kept verbatim as evidence. */
  rawValue: string;
  state: StorageAgePolicyState;
  /** True only when access time can be treated as a real "last used" signal. */
  lastAccessReliableForFiles: boolean;
  noteEn: string;
  noteAr: string;
}

export interface StorageFileItem {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  accessedAt?: string | null;
  createdAt?: string | null;
  ageBasis: StorageAgeBasis;
  /** True only when the row crossed the age threshold on its own recorded basis. */
  isOld: boolean;
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
  unknownCount?: number;
  agePolicy: StorageAgePolicy;
  /** This service is analysis only. It never deletes, moves, or quarantines. */
  readOnly: boolean;
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
  agePolicy: StorageAgePolicy;
  excludedPaths: string[];
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

/** Formats this build can produce. PDF is deliberately not among them. */
export type StorageReportFormat = 'json' | 'csv' | 'html' | 'all';

export type StorageRedactionProfile = 'none' | 'user_profile';

export interface StorageReportArtifact {
  artifactId: string;
  format: string;
  path: string;
  byteCount: number;
  sha256: string;
  blake3: string;
  /** False when the written bytes do not match the declared format's own signature. */
  signatureValid: boolean;
}

export interface StorageUnsupportedFormat {
  format: string;
  reasonEn: string;
  reasonAr: string;
}

export interface StorageReportExportResult {
  scanId: string;
  /** The formats actually written, joined with `+`. */
  format: string;
  path: string;
  byteCount: number;
  jsonEvidencePath: string;
  artifacts: StorageReportArtifact[];
  redactionProfile: StorageRedactionProfile;
  sourceOperationId?: string | null;
  formatsSupported: string[];
  /** Formats a user may ask for that this build cannot honestly produce, with reasons. */
  formatsUnsupported: StorageUnsupportedFormat[];
  warnings: string[];
}

export interface StorageSnapshotSummary {
  snapshotId: string;
  rootPath: string;
  capturedAt: string;
  totalFiles: number;
  totalBytes: number;
  oldFileCount: number;
}

export interface StorageProgress {
  operationId: string;
  phase: 'scanning' | 'scanning_access_times' | 'scan_complete' | 'cancelled';
  filesProcessed: number;
  directoriesProcessed: number;
  bytesProcessed: number;
  currentPath?: string;
}
