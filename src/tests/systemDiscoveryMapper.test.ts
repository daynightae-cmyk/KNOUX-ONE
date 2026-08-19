import { describe, expect, it } from "vitest";
import { mapSystemDiscoveryToSpecs } from "../services/systemDiscoveryMapper";

describe("system discovery mapper", () => {
  it("maps only measured Windows evidence into dashboard fields", () => {
    const mapped = mapSystemDiscoveryToSpecs(
      {
        computerName: "KNOUX-WIN",
        manufacturer: "KNOUX Labs",
        computerModel: "Workstation",
        systemType: "x64-based PC",
        osProductName: "Windows 11 Pro",
        osVersion: "10.0.26100",
        buildNumber: "26100",
        architecture: "64-bit",
        totalRamGB: 32,
        availableRamGB: 12,
        cpuModel: "Measured CPU",
        cpuCores: 16,
        activeUser: "KNOUX\\operator",
        lastBootTime: "2026-08-19T08:00:00.000Z",
        secureBootEnabled: true,
        tpmAvailable: true,
        tpmReady: true,
        defenderEnabled: true,
        firewallEnabled: true,
        logicalVolumes: [
          {
            deviceId: "C:",
            name: "System",
            sizeBytes: 1_000 * 1024 ** 3,
            freeSpaceBytes: 400 * 1024 ** 3,
            status: "OK",
          },
          {
            deviceId: "D:",
            name: "Data",
            sizeBytes: 500 * 1024 ** 3,
            freeSpaceBytes: 125 * 1024 ** 3,
            status: "OK",
          },
        ],
        evidenceSource: "Windows providers",
        measuredAt: "2026-08-19T12:00:00.000Z",
      },
      Date.parse("2026-08-19T12:30:00.000Z"),
    );

    expect(mapped).toMatchObject({
      computerName: "KNOUX-WIN",
      manufacturer: "KNOUX Labs",
      computerModel: "Workstation",
      processor: "Measured CPU",
      cpuCores: 16,
      totalRamGB: 32,
      usedRamGB: 20,
      ramLoadPercentage: 62.5,
      diskTotalGB: 1500,
      diskFreeGB: 525,
      diskUsedGB: 975,
      diskHealth: "Measured volumes report OK",
      uptimeHours: 4,
      uptimeFormatted: "4h",
      defenderStatus: true,
      firewallStatus: true,
      secureBootEnabled: true,
      tpmAvailable: true,
      tpmReady: true,
    });
  });

  it("does not invent telemetry from malformed or unavailable evidence", () => {
    const mapped = mapSystemDiscoveryToSpecs({
      computerName: "KNOUX-WIN",
      totalRamGB: 16,
      availableRamGB: 20,
      lastBootTime: "not-a-date",
      defenderEnabled: "enabled",
      firewallEnabled: undefined,
      logicalVolumes: [
        { deviceId: "C:", sizeBytes: 100, freeSpaceBytes: 200, status: "OK" },
      ],
    });

    expect(mapped.computerName).toBe("KNOUX-WIN");
    expect(mapped.totalRamGB).toBeUndefined();
    expect(mapped.usedRamGB).toBeUndefined();
    expect(mapped.diskTotalGB).toBeUndefined();
    expect(mapped.uptimeHours).toBeUndefined();
    expect(mapped.defenderStatus).toBeUndefined();
    expect(mapped.firewallStatus).toBeUndefined();
  });
});
