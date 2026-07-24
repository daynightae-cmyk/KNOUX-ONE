/**
 * KNOUX ONE — Module 03 Duplicate Finder Contracts
 */

export type DuplicateScanMode =
  | 'exact_blake3'
  | 'fast_partial'
  | 'similar_images'
  | 'video_streams'
  | 'audio_fingerprint'
  | 'documents'
  | 'archives'
  | 'folder_structures';

export interface DuplicateFileItem {
  id: string;
  path: string;
  name: string;
  extension: string;
  sizeBytes: number;
  modifiedTime: string;
  createdTime: string;
  hash: string;
  partialHash?: string;
  perceptualHash?: string;
  similarityScore?: number; // 0 to 100 for perceptual matching
  mimeType: string;
  dimensions?: { width: number; height: number };
  durationSeconds?: number;
  isKeeper: boolean;
  keeperReason?: string;
  selectedForQuarantine: boolean;
}

export interface DuplicateGroup {
  groupId: string;
  mode: DuplicateScanMode;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'folders' | 'other';
  files: DuplicateFileItem[];
  wastedSizeBytes: number;
  commonHash: string;
}

export interface KeeperRuleConfig {
  preferDate: 'oldest' | 'newest';
  preferPath: 'shortest' | 'longest' | 'preferred_dir';
  preferredDirectory?: string;
  preferResolution: 'highest' | 'lowest';
  autoSelectNonKeepers: boolean;
}

export interface QuarantineRecord {
  quarantineId: string;
  originalPath: string;
  quarantinePath: string;
  fileName: string;
  sizeBytes: number;
  quarantinedAt: string;
  hash: string;
  status: 'quarantined' | 'restored' | 'purged';
}

export interface DuplicateScanSummary {
  scanId: string;
  startedAt: string;
  completedAt: string;
  targetFolders: string[];
  totalFilesScanned: number;
  totalBytesScanned: number;
  duplicateGroupsFound: number;
  duplicateFilesFound: number;
  totalWastedBytes: number;
  scanMode: DuplicateScanMode;
}

export interface DuplicateScanConfig {
  targetPaths: string[];
  excludedPaths: string[];
  minSizeBytes: number;
  maxSizeBytes?: number;
  scanMode: DuplicateScanMode;
  includeSubfolders: boolean;
  perceptualSimilarityThreshold: number; // e.g. 90%
}
