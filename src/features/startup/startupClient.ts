import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  BootMetric,
  DelayRequest,
  ImpactSummary,
  MutationResult,
  ProfileRequest,
  ProfileResult,
  RecommendationReport,
  RestoreRequest,
  ScheduledTaskItem,
  StartupChangeRequest,
  StartupItem,
  WindowsServiceItem,
} from './startupContracts';

export const startupClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  registry: (): Promise<OperationResult<StartupItem[]>> =>
    NativeClient.executeCapability('m05_s01', 'm05.registry.inspect'),

  folders: (): Promise<OperationResult<StartupItem[]>> =>
    NativeClient.executeCapability('m05_s02', 'm05.folders.inspect'),

  tasks: (): Promise<OperationResult<ScheduledTaskItem[]>> =>
    NativeClient.executeCapability('m05_s03', 'm05.tasks.inspect'),

  services: (): Promise<OperationResult<WindowsServiceItem[]>> =>
    NativeClient.executeCapability('m05_s04', 'm05.services.inspect'),

  impact: (): Promise<OperationResult<ImpactSummary>> =>
    NativeClient.executeCapability('m05_s05', 'm05.impact.assess'),

  recommendations: (): Promise<OperationResult<RecommendationReport>> =>
    NativeClient.executeCapability('m05_s06', 'm05.recommendations.generate'),

  change: (request: StartupChangeRequest): Promise<OperationResult<MutationResult>> =>
    NativeClient.executeCapability('m05_s09', 'm05.startup.change', { request }),

  delay: (request: DelayRequest): Promise<OperationResult<MutationResult>> =>
    NativeClient.executeCapability('m05_s07', 'm05.delay.manage', { request }),

  profiles: (request: ProfileRequest): Promise<OperationResult<ProfileResult>> =>
    NativeClient.executeCapability('m05_s08', 'm05.profiles.manage', { request }),

  restore: (request: RestoreRequest): Promise<OperationResult<MutationResult>> =>
    NativeClient.executeCapability('m05_s09', 'm05.restore.manage', { request }),

  bootHistory: (limit = 30): Promise<OperationResult<BootMetric[]>> =>
    NativeClient.executeCapability('m05_s10', 'm05.boot.history', { limit }),
};
