import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  StorageAnalysisResult,
  StorageDriveInventory,
  StorageRedactionProfile,
  StorageReportExportResult,
  StorageReportFormat,
  StorageSnapshotSummary,
  StorageSpaceCheckResult,
} from './storageContracts';

export interface StorageScanOptions {
  rootPath: string;
  topLimit?: number;
  oldDays?: number;
  maxFiles?: number;
  /** Absolute paths whose subtrees are skipped. Reported back so a smaller result is explainable. */
  excludes?: string[];
}

function scanRequest(options: StorageScanOptions) {
  return {
    rootPath: options.rootPath,
    topLimit: options.topLimit ?? 100,
    oldDays: options.oldDays ?? 180,
    maxFiles: options.maxFiles ?? 1_000_000,
    excludes: options.excludes ?? [],
  };
}

export const storageClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  scan(options: StorageScanOptions): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s01', 'm04.storage.scan', {
      request: scanRequest(options),
    });
  },

  largestFiles(options: StorageScanOptions): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s02', 'm04.files.largest', {
      request: scanRequest(options),
    });
  },

  largestFolders(options: StorageScanOptions): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s03', 'm04.folders.largest', {
      request: scanRequest(options),
    });
  },

  typeDistribution(options: StorageScanOptions): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s04', 'm04.types.distribution', {
      request: scanRequest(options),
    });
  },

  oldFiles(options: StorageScanOptions): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s05', 'm04.files.old', {
      request: scanRequest(options),
    });
  },

  downloads(): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s06', 'm04.downloads.analyze');
  },

  appData(): Promise<OperationResult<StorageAnalysisResult>> {
    return NativeClient.executeCapability<StorageAnalysisResult>('m04_s07', 'm04.appdata.analyze');
  },

  drives(): Promise<OperationResult<StorageDriveInventory>> {
    return NativeClient.executeCapability<StorageDriveInventory>('m04_s08', 'm04.drives.external');
  },

  spaceCheck(thresholdPercent: number): Promise<OperationResult<StorageSpaceCheckResult>> {
    return NativeClient.executeCapability<StorageSpaceCheckResult>('m04_s09', 'm04.space.check', {
      request: { thresholdPercent },
    });
  },

  exportReport(
    scanId: string,
    fileName?: string,
    format: StorageReportFormat = 'all',
    redaction: StorageRedactionProfile = 'none',
  ): Promise<OperationResult<StorageReportExportResult>> {
    return NativeClient.executeCapability<StorageReportExportResult>('m04_s10', 'm04.report.export', {
      request: { scanId, fileName, format, redaction },
    });
  },

  /** Persisted scans that can still be exported, so a report survives an app restart. */
  reportHistory(): Promise<OperationResult<StorageSnapshotSummary[]>> {
    return NativeClient.executeCapability<StorageSnapshotSummary[]>('m04_s10', 'm04.report.history');
  },

  cancel(targetOperationId: string): Promise<OperationResult<{ targetOperationId: string; cancellationRequested: boolean }>> {
    return NativeClient.executeCapability('m04_s01', 'm04.scan.cancel', { targetOperationId });
  },
};
