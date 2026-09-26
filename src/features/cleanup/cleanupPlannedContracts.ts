/**
 * Typed contracts for the M02 planned services that now have a real native path.
 *
 * S06 and S08 are read-only measurements and their payloads say so in a field
 * (`deletedAnything`, `emptiedAnything`) rather than only in prose. S10 carries the
 * measurement and the apply result separately, so a dry run can never be displayed as
 * a cleanup.
 */

export type DeliveryCacheScope = 'system' | 'user';

export interface DeliveryCacheItem {
  path: string;
  sizeBytes: number;
  lastModified: string;
  ageDays: number;
}

export interface DeliveryCacheRoot {
  id: string;
  path: string;
  exists: boolean;
  readable: boolean;
  rejectionReason?: string | null;
  requiresAdmin: boolean;
  fileCount: number;
  totalBytes: number;
  oldestModified?: string | null;
  newestModified?: string | null;
  truncated: boolean;
}

export interface DeliveryOptimizationEntry {
  fileId: string;
  status: string;
  priority: string;
  bytesFromHttp?: number | null;
  bytesFromPeers?: number | null;
  sourceKind: string;
}

export interface DeliveryServiceState {
  /** The cmdlet exists on this machine. */
  statusCmdletAvailable: boolean;
  /** The cmdlet exists *and* the query completed. A Windows build can ship the cmdlet
   *  while its backing class is unregistered, so these are reported separately. */
  statusQuerySucceeded: boolean;
  perfSnapCmdletAvailable: boolean;
  perfSnapQuerySucceeded: boolean;
  entries: DeliveryOptimizationEntry[];
  cacheSizeBytesReported?: number | null;
  downloadMode?: string | null;
  uploadMode?: string | null;
  diag?: string | null;
}

export interface DeliveryCacheReport {
  scopeApplied: DeliveryCacheScope;
  roots: DeliveryCacheRoot[];
  totalBytes: number;
  entryCount: number;
  accessibleRootCount: number;
  items: DeliveryCacheItem[];
  itemsIncluded: boolean;
  itemsTruncated: boolean;
  serviceState: DeliveryServiceState;
  measurementSource: string;
  deletedAnything: boolean;
  measuredAt: string;
}

export interface RecycleEntry {
  shellName: string;
  originalPath: string;
  deletedAt: string;
  sizeBytes?: number | null;
  sizeReported: boolean;
  kind: string;
}

export interface RecycleBinReport {
  shellNamespaceUsed: string;
  enumerationSucceeded: boolean;
  totalItems: number;
  sizedItems: number;
  unsizedItems: number;
  totalBytes: number;
  items: RecycleEntry[];
  itemsTruncated: boolean;
  readOnlyWarning: boolean;
  emptiedAnything: boolean;
  measurementSource: string;
  measuredAt: string;
}

export interface CleanupProfileMeasurement {
  scanId: string;
  categoriesMeasured: string[];
  rejectedTargets: string[];
  filesMeasured: number;
  bytesMeasured: number;
  scanTruncated: boolean;
  scanCancelled: boolean;
}

export interface CleanupProfileApplyResult {
  applied: boolean;
  confirmationAccepted: boolean;
  deletedFiles: number;
  deletedBytes: number;
  skippedFiles: number;
  failureCount: number;
  /** Old installers are moved to the reversible quarantine rather than deleted. */
  quarantinedInsteadOfDeleted: boolean;
  status: 'dry_run' | 'applied' | 'cancelled' | string;
  warnings: string[];
}

export interface CleanupProfile {
  profileId: string;
  profileName: string;
  filePath: string;
  byteCount: number;
  sha256: string;
  readBackVerified: boolean;
  targets: string[];
  rejectedTargets: string[];
  intervalDays?: number | null;
  dryRunDefault: boolean;
  confirmationToken: string;
  osSchedulerRegistration: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
  lastRunReclaimedBytes?: number | null;
  runCount: number;
}

export interface CleanupProfileResult {
  profile: CleanupProfile;
  measurement: CleanupProfileMeasurement;
  apply: CleanupProfileApplyResult;
  readOnlyWarning: boolean;
}
