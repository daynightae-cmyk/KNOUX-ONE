export interface CleanupFileEvidence {
  path: string;
  rootPath: string;
  sizeBytes: number;
  modifiedAt: string;
  modifiedUnixMs: number;
  safeToClean: boolean;
}

export interface CleanupCategorySummary {
  id: string;
  nameEn: string;
  nameAr: string;
  fileCount: number;
  sizeBytes: number;
  requiresAdmin: boolean;
  scanOnly: boolean;
  truncated: boolean;
  items: CleanupFileEvidence[];
}

export interface CleanupScanResult {
  scanId: string;
  categories: CleanupCategorySummary[];
  totalFiles: number;
  totalBytes: number;
  cancelled: boolean;
  scannedAt: string;
  warnings: string[];
}

export interface CleanupFailureItem {
  path: string;
  reason: string;
}

export interface CleanupExecuteResult {
  scanId: string;
  deletedFiles: number;
  deletedBytes: number;
  skippedFiles: number;
  failedFiles: CleanupFailureItem[];
  cancelled: boolean;
  warnings: string[];
}

export interface CleanupProgress {
  operationId: string;
  phase: 'scanning' | 'scan_complete' | 'cleaning' | 'cleanup_complete' | 'cancelled';
  category?: string;
  filesProcessed: number;
  bytesProcessed: number;
  currentPath?: string;
}

export interface CleanupHistoryEntry {
  operationId: string;
  operationType: 'scan' | 'clean';
  status: string;
  startedAt: string;
  completedAt: string;
  fileCount: number;
  byteCount: number;
  warnings: string[];
}

export interface CleanupHistoryResult {
  entries: CleanupHistoryEntry[];
}
