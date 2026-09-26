/**
 * Typed contracts for the M01 planned services that now have a real native path.
 *
 * Every field here is a value Windows actually reported. The recommendation catalog is
 * the one exception and it says so itself: `catalog.sha256` is the digest of the exact
 * policy bytes used, and `packageIdVerifiedOnThisMachine` is only ever true when the
 * operator asked for a package check and it succeeded.
 */

export type WingetRepairScope = 'local' | 'system';
export type WingetRepairTarget = 'source' | 'cache' | 'package';
export type CatalogScope = 'installed' | 'available';
export type CatalogFilter = 'essential' | 'security' | 'development' | 'all';
export type InventoryFormat = 'json' | 'csv' | 'html';

export interface WingetDiagnosticLog {
  name: string;
  sizeBytes: number;
  lastModified: string;
}

export interface WingetDiagnosis {
  wingetPath: string;
  wingetVersion: string;
  sourceListSucceeded: boolean;
  sourceListText: string;
  sourceListError?: string | null;
  sourceMarkersMatched: string[];
  diagRoot: string;
  diagRootExists: boolean;
  diagLogs: WingetDiagnosticLog[];
  windowsBuild: string;
  osCaption: string;
  measuredAt: string;
}

export interface RepairStep {
  id: string;
  order: number;
  mutating: boolean;
  requiresAdmin: boolean;
  titleEn: string;
  titleAr: string;
  detailEn: string;
  detailAr: string;
  /** The measured fact that caused this step to be offered. */
  evidence: string;
  commandTemplate?: string | null;
  requiresUserValue?: string | null;
}

export interface WingetRepairGuidance {
  scopeApplied: WingetRepairScope;
  repairTargetApplied: WingetRepairTarget;
  diagnosis: WingetDiagnosis;
  steps: RepairStep[];
  stepsOmittedForScope: number;
  stepsOmittedForTarget: number;
  /** Always 0. The service repairs nothing. */
  mutatingActionsPerformed: number;
  executedAnyCommand: boolean;
  noteEn: string;
  noteAr: string;
}

export interface InstalledApp {
  displayName: string;
  registryKey: string;
  hive: string;
  publisher: string;
  version?: string | null;
  installLocation?: string | null;
  installDate?: string | null;
  estimatedSizeBytes?: number | null;
  uninstallString?: string | null;
  isWindowsInstaller?: boolean | null;
}

export interface InventoryHiveReport {
  hive: string;
  registryPath: string;
  present: boolean;
  keysRead: number;
  entriesKept: number;
  entriesSkippedSystemComponent: number;
  entriesSkippedUpdate: number;
}

export interface Inventory {
  apps: InstalledApp[];
  hives: InventoryHiveReport[];
  totalKeysRead: number;
  duplicateDisplayNamesCollapsed: number;
  inventoryTruncated: boolean;
  measuredAt: string;
  measurementSource: string;
}

export interface CatalogProvenance {
  bundledResourcePath: string;
  byteCount: number;
  sha256: string;
  catalogId: string;
  catalogRevision: string;
  declaredItemCount: number;
  policyOverridePath?: string | null;
  policyOverrideSha256?: string | null;
  descriptionEn: string;
  descriptionAr: string;
}

export interface CatalogItem {
  id: string;
  category: 'essential' | 'security' | 'development' | string;
  nameEn: string;
  nameAr: string;
  publisher: string;
  packageId: string;
  packageIdProvenance: 'bundled_policy' | 'policy_override_file' | string;
  packageIdVerifiedOnThisMachine: boolean;
  packageCheckDetail?: string | null;
  whyEn: string;
  whyAr: string;
  state: 'installed' | 'absent' | string;
  matchedBy?: string | null;
  installedDisplayName?: string | null;
  installedVersion?: string | null;
  installedPublisher?: string | null;
  installedLocation?: string | null;
  installedSizeBytes?: number | null;
  installedHive?: string | null;
}

export interface EssentialCatalogReport {
  scopeApplied: CatalogScope;
  filterApplied: CatalogFilter;
  items: CatalogItem[];
  catalogItemsInScope: number;
  itemsInstalled: number;
  itemsAbsent: number;
  itemsSuppressedByScope: number;
  packageIdsChecked: number;
  packageIdsVerified: number;
  packageCheckWasRequested: boolean;
  catalog: CatalogProvenance;
  installedState: Inventory;
  unmatchedInstalledEntries: number;
  measuredAt: string;
}

export interface InventoryExport {
  format: InventoryFormat;
  filePath: string;
  fileName: string;
  byteCount: number;
  sha256: string;
  readBackVerified: boolean;
  appCount: number;
  skippedSystemComponent: number;
  skippedUpdates: number;
  duplicateDisplayNamesCollapsed: number;
  exportDirectoryDefaulted: boolean;
  inventoryTruncated: boolean;
  hives: InventoryHiveReport[];
  includesVersion: boolean;
  includesInstallPath: boolean;
  exportedAt: string;
}

export interface ProfileStep {
  order: number;
  stepId: string;
  nativeCommand: string;
  enabled: boolean;
  parameters: Record<string, string>;
}

export interface ProfileTarget {
  path: string;
  accepted: boolean;
  exists: boolean;
  isDirectory: boolean;
  rejectionReason?: string | null;
}

export interface PostFormatProfile {
  profileId: string;
  profileName: string;
  filePath: string;
  fileName: string;
  byteCount: number;
  sha256: string;
  readBackVerified: boolean;
  targets: ProfileTarget[];
  acceptedTargetCount: number;
  rejectedTargets: string[];
  steps: ProfileStep[];
  rejectedSteps: string[];
  runAfterFormatScan: boolean;
  intervalDays?: number | null;
  osSchedulerRegistration: string;
  changedSystemState: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredProfileSummary {
  profileId: string;
  profileName: string;
  filePath: string;
  byteCount: number;
  sha256: string;
  readBackVerified: boolean;
  stepCount: number;
  acceptedTargetCount: number;
  runAfterFormatScan: boolean;
  intervalDays?: number | null;
  modifiedAt: string;
  parseError?: string | null;
}

export interface PostFormatProfileList {
  profiles: StoredProfileSummary[];
  directory: string;
  directoryExists: boolean;
}
