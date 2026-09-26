import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  AdvertisingIdStatus,
  ClipboardPrivacy,
  HostsFileReport,
  PermissionDashboard,
} from './privacyContracts';

/**
 * Clients for the M09 privacy services.
 *
 * Reading the clipboard is itself a privacy act, so `inspectCurrentClipboard` defaults to
 * false: without an explicit opt-in the content is not even described.
 */
export const privacyClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  permissionDashboard(): Promise<OperationResult<PermissionDashboard>> {
    return NativeClient.executeCapability<PermissionDashboard>('m09_s01', 'm09.permission.dashboard');
  },

  cameraPermission(): Promise<OperationResult<PermissionDashboard>> {
    return NativeClient.executeCapability<PermissionDashboard>('m09_s02', 'm09.permission.camera');
  },

  microphonePermission(): Promise<OperationResult<PermissionDashboard>> {
    return NativeClient.executeCapability<PermissionDashboard>('m09_s03', 'm09.permission.microphone');
  },

  locationPermission(): Promise<OperationResult<PermissionDashboard>> {
    return NativeClient.executeCapability<PermissionDashboard>('m09_s04', 'm09.permission.location');
  },

  advertisingId(): Promise<OperationResult<AdvertisingIdStatus>> {
    return NativeClient.executeCapability<AdvertisingIdStatus>('m09_s05', 'm09.advertising.id');
  },

  clipboardPrivacy(
    options: { inspectCurrentClipboard?: boolean; confirmation?: string } = {},
  ): Promise<OperationResult<ClipboardPrivacy>> {
    return NativeClient.executeCapability<ClipboardPrivacy>('m09_s06', 'm09.clipboard.privacy', {
      request: {
        inspectCurrentClipboard: options.inspectCurrentClipboard ?? false,
        confirmation: options.confirmation ?? '',
      },
    });
  },

  hostsFile(): Promise<OperationResult<HostsFileReport>> {
    return NativeClient.executeCapability<HostsFileReport>('m09_s09', 'm09.hosts.inspect');
  },
};
