import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  CleanupExecuteResult,
  CleanupHistoryResult,
  CleanupScanResult,
} from './cleanupContracts';

export const cleanupClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  scan(categories: string[]): Promise<OperationResult<CleanupScanResult>> {
    return NativeClient.executeCapability<CleanupScanResult>('m02_s01', 'm02.cleanup.scan', {
      request: {
        categories,
        maxItemsPerCategory: 5_000,
      },
    });
  },

  execute(scanId: string, categories: string[], confirmation: string): Promise<OperationResult<CleanupExecuteResult>> {
    return NativeClient.executeCapability<CleanupExecuteResult>('m02_s01', 'm02.cleanup.execute', {
      request: { scanId, categories, confirmation },
    });
  },

  cancel(targetOperationId: string): Promise<OperationResult<{ targetOperationId: string; cancellationRequested: boolean }>> {
    return NativeClient.executeCapability('m02_s01', 'm02.cleanup.cancel', { targetOperationId });
  },

  history(): Promise<OperationResult<CleanupHistoryResult>> {
    return NativeClient.executeCapability<CleanupHistoryResult>('m02_s01', 'm02.cleanup.history');
  },
};
