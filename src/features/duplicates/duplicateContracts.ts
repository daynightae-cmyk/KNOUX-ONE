/** KNOUX ONE — Module 03 Duplicate Control Contracts */
export type DuplicateScanMode = 'exact_blake3' | 'fast_partial' | 'similar_images' | 'video_streams' | 'audio_fingerprint' | 'documents' | 'archives' | 'folder_structures';

/**
 * What a **result** may report as its mode.
 *
 * Wider than {@link DuplicateScanMode} on purpose: the request union is what a user picks,
 * while a result reports the method that actually produced the evidence, and for the four
 * media/archive services that method is named rather than folded into `similar_images` or
 * `video_streams`. Collapsing them would hide which policy ran.
 */
export type DuplicateResultMode = DuplicateScanMode
  | 'image_similarity_oriented_multisignal'
  | 'video_timeline_frame_signature'
  | 'audio_exact_plus_offset_tolerant_fingerprint'
  | 'archive_central_directory_manifest';

/** One measured fact about a single file, attached so a row can be explained without re-running the scan. */
export interface FileEvidence { key:string; value:string; noteEn:string; noteAr:string; }

/**
 * One signal inside a similarity decision. `available: false` means the signal could not
 * be measured: its `score` is then zero and carries no evidence, so a composite built from
 * it is a partial measurement rather than a completed comparison.
 */
export interface SignalScore { signal:string; score:number; weight:number; available:boolean; detailEn:string; detailAr:string; }

/** The weight one signal carried in a composite, published so the number can be reconstructed. */
export interface SignalWeight { signal:string; weight:number; }

/** Measured evidence about one external program. A missing program is always a typed reason, never a silent empty scan. */
export interface ToolEvidence { tool:string; required:boolean; status:'resolved'|'absent'|'present_version_unknown'|string; resolvedPath?:string; version?:string; licenseEvidence?:string; reasonEn:string; reasonAr:string; }

export interface ImageDecodeLimits { maxWidth:number; maxHeight:number; maxAllocBytes:number; }

export interface ImageScanEvidence {
  strategy:string; decodeLimits:ImageDecodeLimits; orientationPolicy:string; orientationSource:string;
  filesWithExifOrientation:number; filesOrientationNormalized:number; bucketRule:string; bucketCount:number;
  largestBucket:number; comparedPairs:number; allPairsIfComputed:number; avoidedAllPairs:boolean;
  exactHashClassesCollapsed:number; weights:SignalWeight[]; cachePath:string; cacheEntries:number;
  cacheHits:number; cacheMisses:number; cacheInvalidations:number; cacheEvictions:number;
  filesChangedDuringScan:number; noDestructiveAction:boolean; limitationsEn:string[]; limitationsAr:string[];
}

export interface VideoScanEvidence {
  dependency:ToolEvidence[]; strategy:string; requestedSampleCount:number; sampleCount:number;
  /** Seconds into the video where a frame was actually read, in the order used. */
  samplePositionsSeconds:number[]; samplePositionsNormalized:number[]; frameSignatureBits:number;
  alignmentToleranceSamples:number; comparedPairs:number; signals:SignalWeight[]; exactHashGroups:number;
  /** True by construction: only an exact BLAKE3 match can ever be actionable. */
  fuzzyGroupsNeverActionable:boolean; limitationsEn:string[]; limitationsAr:string[];
}

export interface AudioDecodeRecord {
  path:string; status:'decoded'|'decoded_prefix_truncated'|'decode_failed'|'silence_only'|string;
  decodedDurationSeconds?:number; sampleRateHz?:number; sourceChannels?:number; sourceCodec?:string;
  frameCount:number; leadingSilenceMs:number; trailingSilenceMs:number; peakDbfs:number; reasonEn:string; reasonAr:string;
}

export interface AudioScanEvidence {
  dependency:ToolEvidence[];
  /** The exact algorithm identifier, so a score is never anonymous. */
  backend:string; backendKind:string; sampleRateHz:number; channelsNormalizedTo:number;
  windowSamples:number; hopSamples:number; bandCount:number; bandLowHz:number; bandHighHz:number;
  maxOffsetSamples:number; silenceTrimFraction:number; decoded:AudioDecodeRecord[]; comparedPairs:number;
  signals:SignalWeight[]; metadataUsedAsProof:boolean; exactHashGroups:number; fuzzyGroupsNeverActionable:boolean;
  limitationsEn:string[]; limitationsAr:string[];
}

export interface ArchiveScanLimits { maxEntries:number; maxDeclaredUncompressedBytes:number; maxCompressionRatio:number; maxPathDepth:number; }

/** A format this build refuses to parse, with the reason instead of a pretend result. */
export interface UnsupportedFormat { format:string; reasonEn:string; reasonAr:string; }

export interface ArchiveManifestSummary {
  path:string; status:'parsed'|'encrypted'|'unsupported_format'|'parse_failed'|'aborted_metadata_limit'|string;
  manifestHash?:string; entryCount:number; declaredUncompressedBytes:number; compressedBytes:number;
  compressionRatio:number; maxPathDepth:number; encryptedEntries:number; pathTraversalEntries:number;
  nestedArchiveEntries:number; reasonEn:string; reasonAr:string;
}

export interface ArchiveScanEvidence {
  dependency:ToolEvidence[]; parser:string; comparisonBasis:string; limits:ArchiveScanLimits;
  casePolicy:string; separatorPolicy:string; archivesParsed:number; encryptedArchives:number;
  pathTraversalEntries:string[]; depthExceededEntries:string[]; nestedArchiveEntries:string[];
  /** Always false: a nested archive's contents are never opened. */
  nestedArchiveContentsCompared:boolean; abortedReason?:string; limitsExceeded:boolean;
  /** True by construction: only the central directory is ever read. */
  neverOpensEntryPayloads:boolean; unsupportedFormats:UnsupportedFormat[]; manifests:ArchiveManifestSummary[];
  limitationsEn:string[]; limitationsAr:string[];
}

/**
 * Everything the scan measured. This is the record a reviewer reads to decide whether the
 * numbers can be believed. `runtimeVerified` is false unless a human ran the built
 * application; the Rust side never sets it.
 */
export interface MediaScanEvidence {
  serviceId:string; capabilityId:string; strategy:string; cancelled:boolean; startedAt:string; completedAt:string;
  dependencies:ToolEvidence[]; images?:ImageScanEvidence; videos?:VideoScanEvidence; audio?:AudioScanEvidence;
  archives?:ArchiveScanEvidence; runtimeVerified:boolean; verificationNoteEn:string; verificationNoteAr:string;
}

export interface DuplicateFileItem { id:string; path:string; canonicalPath:string; name:string; extension:string; sizeBytes:number; modifiedTime:string; createdTime:string; hash:string; partialHash?:string; perceptualHash?:string; similarityScore?:number; mimeType:string; width?:number; height?:number; dimensions?:{width:number;height:number}; durationSeconds?:number; fileIdentity:string; hardLinkCount:number; isHardLinkAlias:boolean; protectedPath:boolean; isKeeper:boolean; keeperReason?:string; selectedForQuarantine:boolean; evidence?:FileEvidence[]; }
export interface DuplicateGroup { groupId:string; mode:DuplicateResultMode; category:'images'|'videos'|'audio'|'documents'|'archives'|'folders'|'other'; files:DuplicateFileItem[]; wastedSizeBytes:number; commonHash:string; proofStatus:'verified_exact'|'candidate'|'visually_similar'|'visually_similar_fuzzy'|'fuzzy_frame_similarity'|'fuzzy_acoustic_similarity'|'equivalent_manifest'|'hard_link_aliases'|string; confidence:number; actionable:boolean; warnings:string[]; /** The individual signals behind `confidence`, so a group can be argued with. */ signals?:SignalScore[]; }
export interface KeeperRuleConfig { preferDate:'oldest'|'newest'; preferPath:'shortest'|'longest'|'preferred_dir'; preferredDirectory?:string; preferResolution:'highest'|'lowest'; protectedPaths:string[]; autoSelectNonKeepers:boolean; }
export interface KeeperGroupPlan { groupId:string; keeperFileId:string; selectedFileIds:string[]; reason:string; blocked:boolean; warnings:string[]; }
export interface KeeperPlanResult { plans:KeeperGroupPlan[]; blockedGroupIds:string[]; }
export interface QuarantineRecord { quarantineId:string; scanSessionId?:string; groupId?:string; originalPath:string; quarantinePath:string; fileName:string; sizeBytes:number; hash:string; fileIdentity:string; createdTime:string; modifiedTime:string; quarantinedAt:string; reason:string; keeperPath:string; status:'quarantined'|'restored'|'purged'; verificationState:'verified'|'failed'|string; purgeState:'active'|'purged'|string; lastError?:string; }
export interface QuarantineActionResult { records:QuarantineRecord[]; warnings:string[]; }
export interface DuplicateScanSummary { scanId:string; operationId:string; startedAt:string; completedAt:string; targetFolders:string[]; totalFilesScanned:number; totalBytesScanned:number; duplicateGroupsFound:number; duplicateFilesFound:number; totalWastedBytes:number; scanMode:DuplicateResultMode; errorCount:number; }
export interface DuplicateScanResult { jobId:string; groups:DuplicateGroup[]; summary:DuplicateScanSummary; warnings:string[]; /** The measured evidence for this scan; absent only for producers with no evidence model of their own. */ evidence?:MediaScanEvidence; }
export interface DuplicateJobProgress { jobId:string; operationId:string; phase:'enumerating'|'grouping_by_size'|'partial_hashing'|'full_hashing'|'media_analysis'|'folder_digest'|'persisting'|'completed'|string; mode:'determinate'|'indeterminate'; scannedFiles:number; totalFiles?:number; scannedBytes:number; currentPath?:string; candidateGroups:number; verifiedGroups:number; errors:number; canPause:boolean; canCancel:boolean; }
export interface DuplicateScanConfig { targetPaths:string[]; excludedPaths:string[]; minSizeBytes:number; maxSizeBytes?:number; scanMode:DuplicateScanMode; includeSubfolders:boolean; perceptualSimilarityThreshold:number; extensions:string[]; maxWorkers:number; }
export interface DuplicateRuntimeState { available:boolean; messageEn:string; messageAr:string; }
export interface DuplicateStoreError { code:string; message:string; }
export interface FolderComparisonResult { folders:Array<{path:string;digest:string;fileCount:number;totalBytes:number;entries:string[]}>; comparisons:Array<{leftPath:string;rightPath:string;classification:string;commonEntries:number;leftOnlyEntries:number;rightOnlyEntries:number}>; }
