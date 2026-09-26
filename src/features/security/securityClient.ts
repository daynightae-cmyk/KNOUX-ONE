import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  DefenderStatus,
  FirewallStatus,
  SecureBootTpmStatus,
  SmartScreenStatus,
  SourceReport,
  UacStatus,
} from './securityContracts';

/**
 * Clients for the M10 security status services.
 *
 * There is deliberately no `startScan()` here. M10-S02/S03/S04 (quick, full and custom
 * Defender scans) stay `planned` in the catalog because a scan has a real cost and a
 * real side effect on the machine, and shipping a button for one before any scan has
 * actually run on a user's device would be a claim nobody has verified.
 */
export const securityClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  defenderStatus(): Promise<OperationResult<DefenderStatus>> {
    return NativeClient.executeCapability<DefenderStatus>('m10_s01', 'm10.defender.status');
  },

  firewallStatus(): Promise<OperationResult<FirewallStatus>> {
    return NativeClient.executeCapability<FirewallStatus>('m10_s05', 'm10.firewall.status');
  },

  uacStatus(): Promise<OperationResult<UacStatus>> {
    return NativeClient.executeCapability<UacStatus>('m10_s06', 'm10.uac.status');
  },

  smartScreenStatus(): Promise<OperationResult<SmartScreenStatus>> {
    return NativeClient.executeCapability<SmartScreenStatus>('m10_s07', 'm10.smartscreen.status');
  },

  secureBootTpmStatus(): Promise<OperationResult<SecureBootTpmStatus>> {
    return NativeClient.executeCapability<SecureBootTpmStatus>('m10_s08', 'm10.secureboot.tpm');
  },
};

export const sourceWarnings = (sources: SourceReport[], t: (en: string, ar: string) => string): string[] =>
  sources.filter(item => !item.available).map(item => t(`${item.name}: ${item.detail}`, `${item.name}: ${item.detail}`));
