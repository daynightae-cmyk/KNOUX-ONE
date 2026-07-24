/**
 * KNOUX ONE — Windows Intelligence & Developer Suite
 * Type Definitions
 */

export type KnouxLanguage = 'en' | 'ar';
export type KnouxTheme = 'dark' | 'light' | 'system';
export type KnouxRuntime = 'desktop' | 'desktop_elevated' | 'web' | 'cloud';

export type CapabilityStatus = 
  | 'available' 
  | 'planned' 
  | 'requires_admin' 
  | 'requires_configuration' 
  | 'unsupported';

export type RiskLevel = 'safe' | 'low' | 'moderate' | 'advanced' | 'high';

export interface KnouxCapability {
  id: string;
  moduleId: string;
  moduleNameEn: string;
  moduleNameAr: string;
  serviceNumber: number; // 1 to 10 within module
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  psCommand?: string;
  wingetId?: string;
  runtime: KnouxRuntime;
  status: CapabilityStatus;
  riskLevel: RiskLevel;
  requiresAdmin: boolean;
  supportsPreview: boolean;
  supportsDryRun: boolean;
  supportsCancel: boolean;
  supportsUndo: boolean;
  supportsQuarantine: boolean;
}

export interface KnouxModule {
  id: string;
  number: number; // 1 to 19
  nameEn: string;
  nameAr: string;
  titleEn?: string;
  titleAr?: string;
  descriptionEn: string;
  descriptionAr: string;
  iconName: string;
  category: 'core' | 'maintenance' | 'security' | 'developer' | 'cloud';
  services: KnouxCapability[];
  capabilities?: KnouxCapability[];
}

export interface SystemSpecs {
  computerName: string;
  processor: string;
  cpuCores: number;
  cpuLoadPercentage: number;
  totalRamGB: number;
  usedRamGB: number;
  ramLoadPercentage: number;
  osEdition: string;
  osVersion: string;
  osBuild: string;
  architecture: string;
  uptimeHours: number;
  uptimeFormatted: string;
  diskTotalGB: number;
  diskUsedGB: number;
  diskFreeGB: number;
  diskHealth: string;
  networkAdapter: string;
  networkSpeedMbps: number;
  ipAddress: string;
  defenderStatus: boolean;
  firewallStatus: boolean;
  healthScore: number;
}

export interface EssentialApp {
  id: string;
  name: string;
  wingetId: string;
  publisher: string;
  category: 'browser' | 'developer' | 'utility' | 'media' | 'communication' | 'design';
  icon: string;
  recommended: boolean;
  installed: boolean;
  sizeMB: number;
}

export interface CleanupCategory {
  id: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  fileCount: number;
  sizeBytes: number;
  sizeFormatted: string;
  riskLevel: RiskLevel;
  selected: boolean;
  items: {
    path: string;
    sizeFormatted: string;
    modified: string;
  }[];
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  fileType: 'zip' | 'video' | 'image' | 'document' | 'archive';
  fileSizeFormatted: string;
  fileSizeBytes: number;
  similarity?: number;
  items: {
    id: string;
    path: string;
    modified: string;
    isOriginal: boolean;
    keep: boolean;
    dimensions?: string;
  }[];
}

export interface QuarantineItem {
  id: string;
  originalPath: string;
  quarantinePath: string;
  filename: string;
  sizeFormatted: string;
  checksum: string;
  quarantinedAt: string;
  reason: string;
}

export interface DevToolStatus {
  id: string;
  name: string;
  icon: string;
  version: string;
  installed: boolean;
  path: string;
}

export interface LocalPortInfo {
  port: number;
  protocol: 'TCP' | 'UDP';
  processName: string;
  pid: number;
  status: 'In Use' | 'Free' | 'Listening';
  address: string;
}

export interface ActionLog {
  id: string;
  timestamp: string;
  capabilityId: string;
  capabilityName: string;
  status: 'completed' | 'failed' | 'in_progress' | 'cancelled';
  details: string;
  reclaimedSpace?: string;
  adminElevated: boolean;
}

export interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
  status: 'Open' | 'In Progress' | 'Resolved';
  createdAt: string;
  lastUpdate: string;
  messagesCount: number;
}
