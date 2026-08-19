import type { SystemSpecs } from "../types";

type UnknownRecord = Record<string, unknown>;

export interface SystemDiscoveryPayload extends UnknownRecord {
  computerName?: unknown;
  manufacturer?: unknown;
  computerModel?: unknown;
  systemType?: unknown;
  osProductName?: unknown;
  osEdition?: unknown;
  osVersion?: unknown;
  buildNumber?: unknown;
  architecture?: unknown;
  lastBootTime?: unknown;
  totalRamGB?: unknown;
  availableRamGB?: unknown;
  cpuModel?: unknown;
  cpuCores?: unknown;
  cpuLogicalProcessors?: unknown;
  activeUser?: unknown;
  secureBootEnabled?: unknown;
  tpmAvailable?: unknown;
  tpmReady?: unknown;
  defenderEnabled?: unknown;
  firewallEnabled?: unknown;
  logicalVolumes?: unknown;
  evidenceSource?: unknown;
  measuredAt?: unknown;
}

interface LogicalVolume extends UnknownRecord {
  sizeBytes?: unknown;
  freeSpaceBytes?: unknown;
  status?: unknown;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function readBoolean(value: unknown): boolean | null | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function formatUptime(
  lastBootTime: string | undefined,
  now: number,
): { hours: number; formatted: string } | undefined {
  if (!lastBootTime) return undefined;
  const bootMilliseconds = Date.parse(lastBootTime);
  if (!Number.isFinite(bootMilliseconds) || bootMilliseconds > now)
    return undefined;

  const totalHours = Math.floor((now - bootMilliseconds) / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return {
    hours: totalHours,
    formatted: days > 0 ? `${days}d ${hours}h` : `${hours}h`,
  };
}

function summarizeVolumes(
  value: unknown,
):
  | Pick<
      SystemSpecs,
      "diskTotalGB" | "diskUsedGB" | "diskFreeGB" | "diskHealth"
    >
  | undefined {
  if (!Array.isArray(value)) return undefined;

  let totalBytes = 0;
  let freeBytes = 0;
  let measuredVolumeCount = 0;
  let healthy = true;

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const volume = candidate as LogicalVolume;
    const sizeBytes = readFiniteNumber(volume.sizeBytes);
    const freeSpaceBytes = readFiniteNumber(volume.freeSpaceBytes);
    if (
      sizeBytes === undefined ||
      freeSpaceBytes === undefined ||
      freeSpaceBytes > sizeBytes
    )
      continue;

    totalBytes += sizeBytes;
    freeBytes += freeSpaceBytes;
    measuredVolumeCount += 1;
    if (readString(volume.status)?.toLowerCase() !== "ok") healthy = false;
  }

  if (measuredVolumeCount === 0 || totalBytes <= 0) return undefined;
  const bytesPerGiB = 1024 ** 3;
  const total = totalBytes / bytesPerGiB;
  const free = freeBytes / bytesPerGiB;
  return {
    diskTotalGB: total,
    diskFreeGB: free,
    diskUsedGB: Math.max(0, total - free),
    diskHealth: healthy
      ? "Measured volumes report OK"
      : "One or more measured volumes require review",
  };
}

/**
 * Maps only evidence supplied by the native discovery command. Fields without a
 * trustworthy source are intentionally omitted so the UI keeps them unmeasured.
 */
export function mapSystemDiscoveryToSpecs(
  payload: SystemDiscoveryPayload,
  now = Date.now(),
): Partial<SystemSpecs> {
  const next: Partial<SystemSpecs> = {};
  const assignString = <K extends keyof SystemSpecs>(
    key: K,
    value: unknown,
  ) => {
    const parsed = readString(value);
    if (parsed !== undefined) next[key] = parsed as SystemSpecs[K];
  };
  const assignNumber = <K extends keyof SystemSpecs>(
    key: K,
    value: unknown,
  ) => {
    const parsed = readFiniteNumber(value);
    if (parsed !== undefined) next[key] = parsed as SystemSpecs[K];
  };

  assignString("computerName", payload.computerName);
  assignString("manufacturer", payload.manufacturer);
  assignString("computerModel", payload.computerModel);
  assignString("systemType", payload.systemType);
  assignString("processor", payload.cpuModel);
  assignNumber("cpuCores", payload.cpuCores);
  assignString("osEdition", payload.osProductName);
  assignString("osVersion", payload.osVersion);
  assignString("osBuild", payload.buildNumber);
  assignString("architecture", payload.architecture);
  assignString("activeUser", payload.activeUser);
  assignString("lastBootTime", payload.lastBootTime);
  assignString("evidenceSource", payload.evidenceSource);
  assignString("measuredAt", payload.measuredAt);

  const totalRamGB = readFiniteNumber(payload.totalRamGB);
  const availableRamGB = readFiniteNumber(payload.availableRamGB);
  if (
    totalRamGB !== undefined &&
    availableRamGB !== undefined &&
    availableRamGB <= totalRamGB
  ) {
    const usedRamGB = Math.max(0, totalRamGB - availableRamGB);
    next.totalRamGB = totalRamGB;
    next.usedRamGB = usedRamGB;
    next.ramLoadPercentage =
      totalRamGB > 0 ? (usedRamGB / totalRamGB) * 100 : 0;
  }

  const uptime = formatUptime(readString(payload.lastBootTime), now);
  if (uptime) {
    next.uptimeHours = uptime.hours;
    next.uptimeFormatted = uptime.formatted;
  }

  const volumeSummary = summarizeVolumes(payload.logicalVolumes);
  if (volumeSummary) Object.assign(next, volumeSummary);

  const secureBoot = readBoolean(payload.secureBootEnabled);
  const tpmAvailable = readBoolean(payload.tpmAvailable);
  const tpmReady = readBoolean(payload.tpmReady);
  const defenderEnabled = readBoolean(payload.defenderEnabled);
  const firewallEnabled = readBoolean(payload.firewallEnabled);
  if (secureBoot !== undefined) next.secureBootEnabled = secureBoot;
  if (tpmAvailable !== undefined) next.tpmAvailable = tpmAvailable;
  if (tpmReady !== undefined) next.tpmReady = tpmReady;
  if (defenderEnabled !== undefined) next.defenderStatus = defenderEnabled;
  if (firewallEnabled !== undefined) next.firewallStatus = firewallEnabled;

  return next;
}
