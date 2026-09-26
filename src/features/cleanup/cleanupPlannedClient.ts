import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type { CleanupProfileResult, DeliveryCacheReport, DeliveryCacheScope, RecycleBinReport } from './cleanupPlannedContracts';

/**
 * Clients for the M02 planned services that now have a real native command.
 *
 * The Delivery Optimization and Recycle Bin clients have no destructive option at all:
 * the native command offers none, so the UI cannot invent one.
 */
export const cleanupPlannedClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  deliveryCache(
    scope: DeliveryCacheScope,
    includeFiles: boolean,
    maxItems?: number,
  ): Promise<OperationResult<DeliveryCacheReport>> {
    return NativeClient.executeCapability<DeliveryCacheReport>('m02_s06', 'm02.cache.delivery', {
      request: { scope, includeFiles, maxItems },
    });
  },

  recycleBinReview(includeDetails: boolean, maxItems?: number): Promise<OperationResult<RecycleBinReport>> {
    return NativeClient.executeCapability<RecycleBinReport>('m02_s08', 'm02.recycle.review', {
      request: { includeDetails, maxItems },
    });
  },

  /**
   * `dryRun` defaults to true here on purpose. Applying a profile requires the caller
   * to pass the literal token the measurement returned, so the destructive path can
   * never be reached by a single stray call.
   */
  cleanupSchedule(input: {
    profileName: string;
    targets: string[];
    dryRun?: boolean;
    apply?: boolean;
    confirmation?: string;
    intervalDays?: number | null;
    maxItemsPerCategory?: number;
  }): Promise<OperationResult<CleanupProfileResult>> {
    return NativeClient.executeCapability<CleanupProfileResult>('m02_s10', 'm02.cleanup.schedule', {
      request: {
        profileName: input.profileName,
        targets: input.targets,
        dryRun: input.dryRun ?? true,
        apply: input.apply ?? false,
        confirmation: input.confirmation ?? '',
        intervalDays: input.intervalDays ?? null,
        maxItemsPerCategory: input.maxItemsPerCategory ?? 5000,
      },
    });
  },
};
