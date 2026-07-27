import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type { RepairReport, RepairRequest } from './repairContracts';

export const repairClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  sfc: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s01', 'm07.sfc.manage', { request }),

  dismCheckHealth: (): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s02', 'm07.dism.check_health'),

  dismScanHealth: (): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s03', 'm07.dism.scan_health'),

  dismRestoreHealth: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s04', 'm07.dism.restore_health', { request }),

  windowsUpdate: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s05', 'm07.update.manage', { request }),

  caches: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s06', 'm07.cache.manage', { request }),

  wmi: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s07', 'm07.wmi.manage', { request }),

  installer: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s08', 'm07.installer.manage', { request }),

  vss: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s09', 'm07.vss.manage', { request }),

  store: (request: RepairRequest): Promise<OperationResult<RepairReport>> =>
    NativeClient.executeCapability('m07_s10', 'm07.store.manage', { request }),
};
