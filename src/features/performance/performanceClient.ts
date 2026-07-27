import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  BenchmarkReport,
  CpuSnapshot,
  DiskActivitySnapshot,
  HeavyProcessReport,
  MemorySnapshot,
  NetworkActivitySnapshot,
  PowerPlanRequest,
  PowerPlanResult,
  PriorityRequest,
  PriorityResult,
  ProcessExplorerSnapshot,
  ProfileRequest,
  ProfileResult,
} from './performanceContracts';

export const performanceClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  cpu: (): Promise<OperationResult<CpuSnapshot>> =>
    NativeClient.executeCapability('m06_s01', 'm06.cpu.monitor'),

  memory: (): Promise<OperationResult<MemorySnapshot>> =>
    NativeClient.executeCapability('m06_s02', 'm06.memory.monitor'),

  disk: (): Promise<OperationResult<DiskActivitySnapshot>> =>
    NativeClient.executeCapability('m06_s03', 'm06.disk.activity'),

  network: (): Promise<OperationResult<NetworkActivitySnapshot>> =>
    NativeClient.executeCapability('m06_s04', 'm06.network.activity'),

  processes: (limit = 200): Promise<OperationResult<ProcessExplorerSnapshot>> =>
    NativeClient.executeCapability('m06_s05', 'm06.process.explorer', { limit }),

  heavyProcesses: (): Promise<OperationResult<HeavyProcessReport>> =>
    NativeClient.executeCapability('m06_s06', 'm06.process.heavy'),

  priority: (request: PriorityRequest): Promise<OperationResult<PriorityResult>> =>
    NativeClient.executeCapability('m06_s07', 'm06.priority.manage', { request }),

  powerPlans: (request: PowerPlanRequest): Promise<OperationResult<PowerPlanResult>> =>
    NativeClient.executeCapability('m06_s08', 'm06.power.manage', { request }),

  profiles: (request: ProfileRequest): Promise<OperationResult<ProfileResult>> =>
    NativeClient.executeCapability('m06_s09', 'm06.profiles.manage', { request }),

  benchmark: (): Promise<OperationResult<BenchmarkReport>> =>
    NativeClient.executeCapability('m06_s10', 'm06.benchmark.report'),
};
