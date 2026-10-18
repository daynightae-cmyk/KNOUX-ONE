/**
 * KNOUX ONE — Module 17 Logs & Diagnostics Contracts
 *
 * These types mirror the native contracts in src-tauri/src/diagnostics/contracts.rs.
 * Every field is produced by a measured read of the local Windows event surface.
 */

export interface DiagnosticEvent {
  recordId?: number | null;
  channel: string;
  provider: string;
  eventId: number;
  level: string;
  timeCreated: string;
  machineName?: string | null;
  message: string;
  correlationKey: string;
}

export interface EventQueryResult {
  events: DiagnosticEvent[];
  queriedChannels: string[];
  hours: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  warnings: string[];
}

export interface ApplicationCrash {
  application: string;
  faultingModule?: string | null;
  exceptionCode?: string | null;
  eventId: number;
  provider: string;
  timeCreated: string;
  occurrenceCount: number;
  message: string;
}

export interface CrashCorrelationResult {
  crashes: ApplicationCrash[];
  totalEvents: number;
  recurringApplications: string[];
  warnings: string[];
}

export interface MinidumpEvidence {
  path: string;
  fileName: string;
  sizeBytes: number;
  modifiedAt: string;
  readable: boolean;
}

export interface BugcheckEvidence {
  timeCreated: string;
  code?: string | null;
  parameters: string[];
  dumpPath?: string | null;
  message: string;
}

export interface BsodTriageResult {
  bugchecks: BugcheckEvidence[];
  minidumps: MinidumpEvidence[];
  debuggerAvailable: boolean;
  debuggerPath?: string | null;
  analysisLevel: string;
  warnings: string[];
}

export interface ReliabilityRecord {
  timeGenerated: string;
  sourceName: string;
  productName?: string | null;
  eventIdentifier?: number | null;
  message: string;
}

export interface DayCount {
  day: string;
  incidents: number;
}

export interface ReliabilityResult {
  records: ReliabilityRecord[];
  dayCounts: DayCount[];
  warnings: string[];
}

export interface ServiceFailure {
  serviceName?: string | null;
  displayName?: string | null;
  startMode?: string | null;
  state?: string | null;
  processId?: number | null;
  eventId?: number | null;
  timeCreated?: string | null;
  message: string;
}

export interface ServiceDiagnosticsResult {
  failures: ServiceFailure[];
  automaticNotRunning: ServiceFailure[];
  warnings: string[];
}

export interface UpdateEvidence {
  timeCreated: string;
  eventId: number;
  level: string;
  kb?: string | null;
  errorCode?: string | null;
  message: string;
}

export interface InstalledUpdate {
  hotfixId: string;
  description: string;
  installedOn?: string | null;
}

export interface UpdateDiagnosticsResult {
  events: UpdateEvidence[];
  installedUpdates: InstalledUpdate[];
  failureCount: number;
  warnings: string[];
}

export interface HardwareWarning {
  timeCreated: string;
  provider: string;
  eventId: number;
  level: string;
  category: string;
  message: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface HardwareWarningsResult {
  events: HardwareWarning[];
  categoryCounts: CategoryCount[];
  warnings: string[];
}

export interface NetworkAdapterEvidence {
  name: string;
  description: string;
  status: string;
  linkSpeed?: string | null;
  macAddress?: string | null;
  ipv4: string[];
  gateways: string[];
  dnsServers: string[];
}

export interface NetworkProbe {
  target: string;
  resolvedAddresses: string[];
  pingSucceeded: boolean;
  tcpSucceeded?: boolean | null;
  remotePort?: number | null;
  sourceAddress?: string | null;
  interfaceAlias?: string | null;
  latencyMs?: number | null;
}

export interface NetworkDiagnosticsResult {
  adapters: NetworkAdapterEvidence[];
  probe?: NetworkProbe | null;
  events: DiagnosticEvent[];
  warnings: string[];
}

export type DiagnosticExportFormat = 'json' | 'markdown' | 'html';

export interface DiagnosticExportResult {
  exportId: string;
  path: string;
  format: string;
  sizeBytes: number;
  createdAt: string;
  redactionCount: number;
  sha256: string;
  includedFiles: string[];
  warnings: string[];
}

export type DiagnosticSection =
  | 'events'
  | 'crashes'
  | 'bsod'
  | 'reliability'
  | 'services'
  | 'updates'
  | 'hardware'
  | 'network'
  | 'export';

export interface DiagnosticStoreError {
  code: string;
  message: string;
}
