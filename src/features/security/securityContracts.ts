/**
 * Typed contracts for the M10 security status services.
 *
 * Every one of these is a read-only inspection. The payloads carry
 * `changedAnySetting: false` and `scanStarted: false` as fields rather than leaving
 * "read only" in prose, and every provider that did not answer is reported in `sources`
 * so a silent provider cannot be mistaken for a healthy one.
 */

export interface SourceReport {
  name: string;
  available: boolean;
  detail: string;
}

export interface DefenderScanHistory {
  quickScanAgeDays?: number | null;
  quickScanEndTime: string;
  fullScanAgeDays?: number | null;
  fullScanEndTime: string;
}

export interface DefenderStatus {
  computerState: string;
  antivirusEnabled?: boolean | null;
  antispywareEnabled?: boolean | null;
  realTimeProtectionEnabled?: boolean | null;
  behaviorMonitorEnabled?: boolean | null;
  ioavProtectionEnabled?: boolean | null;
  onAccessProtectionEnabled?: boolean | null;
  tamperProtectionSource: string;
  isTamperProtected?: boolean | null;
  amRunningMode: string;
  antivirusSignatureVersion: string;
  antivirusSignatureLastUpdated: string;
  engineVersion: string;
  engineSignatureVersion: string;
  platformVersion: string;
  exclusionPathCount: number;
  exclusionPaths: string[];
  exclusionExtensionCount: number;
  exclusionProcessCount: number;
  history: DefenderScanHistory;
  sources: SourceReport[];
  changedAnySetting: boolean;
  scanStarted: boolean;
  measuredAt: string;
}

export interface FirewallProfileState {
  name: string;
  enabled?: boolean | null;
  defaultInboundAction: string;
  defaultOutboundAction: string;
  allowInboundRules?: boolean | null;
  allowLocalFirewallRules?: boolean | null;
  logFileName: string;
  logAllowed?: boolean | null;
  logBlocked?: boolean | null;
  logMaxSizeKb?: number | null;
  notifyOnListen?: boolean | null;
}

export interface FirewallRuleCount {
  direction: string;
  action: string;
  enabled: string;
  count: number;
}

export interface FirewallStatus {
  profiles: FirewallProfileState[];
  ruleCounts: FirewallRuleCount[];
  ruleCountTotal: number;
  profilesDisabled: number;
  inboundBlockedByDefaultProfiles: number;
  sources: SourceReport[];
  changedAnyRule: boolean;
  measuredAt: string;
}

export interface UacMachineValue {
  name: string;
  present: boolean;
  value: string;
  meaningEn: string;
  meaningAr: string;
}

export interface UacStatus {
  userAccountControlEnabled?: boolean | null;
  governingScope: string;
  machineValues: UacMachineValue[];
  perUserEnableLua?: boolean | null;
  perUserOverridePresent: boolean;
  secureDesktopDefault?: string | null;
  adminConsentBehavior?: string | null;
  sources: SourceReport[];
  changedAnyValue: boolean;
  elevationPerformed: boolean;
  measuredAt: string;
}

export interface SmartScreenSource {
  origin: string;
  valueName: string;
  present: boolean;
  value: string;
  meaningEn: string;
  meaningAr: string;
}

export interface SmartScreenStatus {
  sources: SmartScreenSource[];
  settingsRead: number;
  settingsMissing: number;
  effectiveEnforcement: string;
  changedAnyValue: boolean;
  measuredAt: string;
}

export interface TpmDetail {
  name: string;
  present?: boolean | null;
  ready?: boolean | null;
  enabled?: boolean | null;
  activated?: boolean | null;
  owned?: boolean | null;
  specVersion: string;
  manufacturer: string;
  manufacturerVersion: string;
  managedPhysicalPresenceVersion: string;
}

export interface SecureBootTpmStatus {
  secureBootState: 'on' | 'off' | 'unavailable' | 'unknown' | string;
  secureBootConfirmed?: boolean | null;
  secureBootDetail: string;
  biosMode: string;
  tpm: TpmDetail[];
  sources: SourceReport[];
  changedAnySetting: boolean;
  measuredAt: string;
}
