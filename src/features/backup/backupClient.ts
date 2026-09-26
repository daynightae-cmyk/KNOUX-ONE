import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  BackupRun,
  BookmarkBackup,
  EnvironmentExport,
  RegistryBackup,
  RestoreInventory,
  SettingsExport,
} from './backupContracts';

/**
 * Clients for the M11 backup services.
 *
 * None of these deletes or overwrites anything. Each run writes into its own timestamped
 * folder under the destination, so a failed run cannot destroy the last known-good copy.
 */
export const backupClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  exportSettings(options: {
    destinationDirectory?: string;
    includeContents?: boolean;
  }): Promise<OperationResult<SettingsExport>> {
    return NativeClient.executeCapability<SettingsExport>('m11_s03', 'm11.settings.export', {
      request: {
        destinationDirectory: options.destinationDirectory ?? null,
        includeContents: options.includeContents ?? true,
      },
    });
  },

  exportEnvironment(destinationDirectory?: string): Promise<OperationResult<EnvironmentExport>> {
    return NativeClient.executeCapability<EnvironmentExport>('m11_s05', 'm11.environment.export', {
      destinationDirectory: destinationDirectory ?? null,
    });
  },

  backupBookmarks(destinationDirectory?: string): Promise<OperationResult<BookmarkBackup>> {
    return NativeClient.executeCapability<BookmarkBackup>('m11_s06', 'm11.bookmarks.backup', {
      destinationDirectory: destinationDirectory ?? null,
    });
  },

  /**
   * Registry export. There is deliberately no way to pass a key: the allowlist lives in
   * the Rust source, so a caller cannot widen what this service reads.
   */
  backupRegistryKeys(destinationDirectory?: string): Promise<OperationResult<RegistryBackup>> {
    return NativeClient.executeCapability<RegistryBackup>('m11_s07', 'm11.registry.backup', {
      destinationDirectory: destinationDirectory ?? null,
    });
  },

  /** Re-hashes every backup run on disk and compares against what each run recorded. */
  restoreInventory(backupRoot?: string): Promise<OperationResult<RestoreInventory>> {
    return NativeClient.executeCapability<RestoreInventory>('m11_s09', 'm11.restore.inventory', {
      backupRoot: backupRoot ?? null,
    });
  },
};

export const runSummary = (run: BackupRun): string =>
  `${run.runId} · ${run.filesWritten} verified / ${run.filesFailed} unverified`;
