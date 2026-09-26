/**
 * Typed contracts for the M11 backup services.
 *
 * Every payload carries `readBackVerified` per file and `everythingVerified` per run.
 * A backup whose bytes were never read back is reported as unverified, and an empty run
 * reports `everythingVerified: false` so it can never read as a good backup.
 */

export interface SourceReport {
  name: string;
  available: boolean;
  detail: string;
}

export interface WrittenFile {
  kind: string;
  sourcePath: string;
  fileName: string;
  filePath: string;
  byteCount: number;
  sha256: string;
  /** True only when the bytes read back from disk hash to the same value. */
  readBackVerified: boolean;
  verificationNote?: string | null;
}

export interface BackupRun {
  runId: string;
  runDirectory: string;
  createdAt: string;
  files: WrittenFile[];
  sources: SourceReport[];
  filesWritten: number;
  filesFailed: number;
  totalBytes: number;
  /** False when nothing was written. An empty backup is not a good backup. */
  everythingVerified: boolean;
  destinationDefaulted: boolean;
}

export interface SettingsExport {
  run: BackupRun;
  appDataDirectory: string;
  documentCount: number;
  documentNames: string[];
  includeContents: boolean;
  manifestSha256: string;
  manifestFilePath: string;
  manifestReadBackVerified: boolean;
}

export interface EnvironmentVariable {
  name: string;
  /** `null` when that scope holds no value, which is different from an empty value. */
  machineValue?: string | null;
  userValue?: string | null;
  /** For PATH this is the concatenation in the order Windows actually searches it. */
  effectiveValue: string;
  machinePresent: boolean;
  userPresent: boolean;
  pathEntryCount: number;
  /** Entries present in both scopes, which is how a duplicated PATH is found. */
  duplicatedPathEntries: string[];
}

export interface EnvironmentExport {
  run: BackupRun;
  variables: EnvironmentVariable[];
  pathMachineEntries: number;
  pathUserEntries: number;
  pathDuplicateEntries: number;
  machinePathLength: number;
  userPathLength: number;
  effectivePathLength: number;
  exportFilePath: string;
  exportSha256: string;
}

export interface BookmarkSource {
  browser: string;
  profileName: string;
  profilePath: string;
  bookmarksPath: string;
  exists: boolean;
  readable: boolean;
  rejectionReason?: string | null;
  byteCount: number;
  modifiedAt: string;
  copied: boolean;
  readBackVerified: boolean;
  sha256: string;
  targetFile: string;
}

export interface BookmarkBackup {
  run: BackupRun;
  sources: BookmarkSource[];
  browsersFound: number;
  profilesFound: number;
  filesCopied: number;
  everythingVerified: boolean;
  /** Always false. This service copies out of a profile and never back into it. */
  wroteIntoAnyBrowserProfile: boolean;
}

// ---------------------------------------------------------------------------
// M11-S07 — Registry-key backup
// ---------------------------------------------------------------------------

export interface RegistryKeyBackup {
  key: string;
  description: string;
  exists: boolean;
  exported: boolean;
  fileName: string;
  filePath: string;
  byteCount: number;
  /** Key headers found by re-parsing the written file. Zero means the export is unusable. */
  keyHeaderCount: number;
  valueHeaderCount: number;
  sha256: string;
  readBackVerified: boolean;
  rejectionReason?: string | null;
}

export interface RegistryBackup {
  run: BackupRun;
  keys: RegistryKeyBackup[];
  keysRequested: number;
  keysExported: number;
  keysAbsent: number;
  everythingVerified: boolean;
  /** Always false. `reg export` reads a key and writes a file; nothing writes here. */
  wroteToAnyRegistryKey: boolean;
}

// ---------------------------------------------------------------------------
// M11-S09 — Restore inventory
// ---------------------------------------------------------------------------

export interface RestoreFileCheck {
  fileName: string;
  filePath: string;
  presentOnDisk: boolean;
  recordedSha256?: string | null;
  currentSha256?: string | null;
  /** True only when a recorded digest exists and the file still matches it. */
  stillMatches: boolean;
  byteCount: number;
  /** True when no prior digest existed, so this run establishes a baseline, not a pass. */
  baselineOnly: boolean;
  note?: string | null;
}

export interface RestoreRunCheck {
  runId: string;
  runDirectory: string;
  modifiedAt: string;
  ageDays: number;
  manifestPresent: boolean;
  filesChecked: number;
  filesMatching: number;
  filesMissing: number;
  filesAltered: number;
  filesBaselineOnly: number;
  totalBytes: number;
  /** True only when every file in the run still matches a digest the run recorded. */
  runVerified: boolean;
  files: RestoreFileCheck[];
}

export interface RestoreInventory {
  backupRoot: string;
  backupRootExists: boolean;
  runs: RestoreRunCheck[];
  runsFound: number;
  runsVerified: number;
  runsWithMissingOrAlteredFiles: number;
  totalBytesOnDisk: number;
  nothingDeleted: boolean;
  measuredAt: string;
}