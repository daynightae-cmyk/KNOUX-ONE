import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type { InstallQueueItem, SystemDiscoveryData } from './setupContracts';

export const setupClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  discover(): Promise<OperationResult<SystemDiscoveryData>> {
    return NativeClient.executeCapability<SystemDiscoveryData>('m01_s01', 'm01.system.discover');
  },

  verifyWinget(): Promise<OperationResult<string>> {
    return NativeClient.executeCapability<string>('m01_s02', 'm01.winget.verify');
  },

  install(packageId: string): Promise<OperationResult<string>> {
    return NativeClient.executeCapability<string>('m01_s05', 'm01.winget.install', { packageId });
  },

  queue(): Promise<InstallQueueItem[]> {
    return NativeClient.invokeHandler<InstallQueueItem[]>('m01.winget.queue.list');
  },

  resumeQueue(): Promise<OperationResult<InstallQueueItem[]>> {
    return NativeClient.executeCapability<InstallQueueItem[]>('m01_s05', 'm01.winget.queue.resume');
  },
};
