/**
 * Typed contracts for the M09 privacy services.
 *
 * S01–S04 share one measurement. `PermissionDashboard.capabilities` is filtered by the
 * command that produced it, so the camera view is a projection of the dashboard rather
 * than a second reading that could disagree with it.
 *
 * Every payload carries a `changed*` field that is `false` unless the caller supplied the
 * exact confirmation token, so "read only" is a fact the response carries rather than a
 * claim in a summary.
 */

export interface SourceReport {
  name: string;
  available: boolean;
  detail: string;
}

export interface AppPermission {
  appKey: string;
  /** `NonPackaged` (desktop or unpackaged) or `Packaged` (Store/MSIX). */
  appKind: string;
  appName: string;
  /** `Allow`, `Deny`, `Prompt`, or empty when the registry holds no decision at this key. */
  value: string;
  /**
   * The states this key can actually be in. Windows frequently records no `Value` at all
   * while still logging real use, so "no decision recorded" and "never asked" are
   * different claims and are not collapsed.
   *
   * - `allowed`
   * - `denied`
   * - `prompt_recorded_and_used`
   * - `prompt_pending`
   * - `used_no_decision_recorded`
   * - `no_decision_and_never_used`
   */
  state:
    | 'allowed'
    | 'denied'
    | 'prompt_recorded_and_used'
    | 'prompt_pending'
    | 'used_no_decision_recorded'
    | 'no_decision_and_never_used'
    | string;
  /** Converted from Windows FILETIME. Empty means never used. */
  lastUsedStart: string;
  lastUsedStop: string;
  everUsed: boolean;
}

export interface CapabilityPermissions {
  capability: string;
  capabilityLabelEn: string;
  capabilityLabelAr: string;
  consentStorePresent: boolean;
  consentStorePath: string;
  allowCount: number;
  denyCount: number;
  /** Windows logged real use but recorded no allow or deny at this key. */
  undecidedButUsedCount: number;
  /** Neither a decision nor any recorded use. */
  unusedCount: number;
  apps: AppPermission[];
}

export interface PermissionDashboard {
  capabilities: CapabilityPermissions[];
  capabilitiesRequested: string[];
  consentStoreRoot: string;
  rootPresent: boolean;
  totalAppsSeen: number;
  appsAllowedSomewhere: number;
  sources: SourceReport[];
  changedAnyPermission: boolean;
  measuredAt: string;
}

export interface AdvertisingIdStatus {
  registryPath: string;
  keyPresent: boolean;
  advertisingId: string;
  /** `undefined` when the key holds no Enabled value, i.e. unmeasured rather than off. */
  enabled?: boolean | null;
  /** A stored identifier with the feature off is what a Windows reset leaves behind. */
  resetPerformedByWindows: boolean;
  limitAdTracking?: boolean | null;
  limitAdTrackingPath: string;
  sources: SourceReport[];
  changedAnyValue: boolean;
  measuredAt: string;
}

export interface ClipboardPrivacy {
  historyEnabled?: boolean | null;
  historyRegistryPath: string;
  historyKeyPresent: boolean;
  currentClipboardPresent: boolean;
  currentClipboardKind: string;
  currentClipboardCharCount: number;
  currentClipboardPreview: string;
  cleared: boolean;
  confirmationAccepted: boolean;
  sources: SourceReport[];
  changedClipboard: boolean;
  measuredAt: string;
}

export interface HostsEntry {
  lineNumber: number;
  address: string;
  hostnames: string;
  comment: string;
}

export interface HostsFileReport {
  path: string;
  exists: boolean;
  readable: boolean;
  rejectionReason?: string | null;
  byteCount: number;
  modifiedAt: string;
  lineCount: number;
  activeEntryCount: number;
  commentLineCount: number;
  blankLineCount: number;
  /** Entries pointing a name at `0.0.0.0` or `::` — how a hosts file blocks a name. */
  blockingEntryCount: number;
  duplicateAddressCount: number;
  entries: HostsEntry[];
  sources: SourceReport[];
  fileModified: boolean;
  measuredAt: string;
}
