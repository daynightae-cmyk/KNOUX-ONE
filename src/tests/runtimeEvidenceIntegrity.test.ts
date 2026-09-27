import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALL_CAPABILITIES } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS, resolveNativeCommand } from '../services/nativeCommandRegistry';

type RuntimeStages = {
  uiControlClicked: boolean;
  ipcRoundTrip: boolean;
  nativeExecuted: boolean;
  resultRendered: boolean;
};

type RuntimeRecord = {
  serviceId: string;
  handlerId: string;
  nativeCommand: string;
  capturedAt: string;
  stages: RuntimeStages;
  renderedEvidence: string;
  interpretation: string;
  capabilityIdReturnedByNative?: string;
  applicationSha256?: string;
};

const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8');
const evidencePath = 'docs/evidence/windows-runtime-evidence.json';
const baselinePath = 'docs/services/service-reality-baseline.json';

const evidence = JSON.parse(read(evidencePath)) as {
  schemaVersion: number;
  host: Record<string, unknown>;
  records: RuntimeRecord[];
};

const baseline = JSON.parse(read(baselinePath)) as {
  globalRuntimeGate: { state: string; verified: number; eligible: number; missing: string[] };
  totals: { states: Record<string, number> };
  services: { serviceId: string; state: string; verificationLevel: string }[];
};

/**
 * Recorded Windows runtime evidence is the only thing that may promote a service
 * out of `STATIC_VERIFIED`, so it has to be held to the same standard as the code.
 * A record that drifts away from the catalog, a record that claims a stage it did
 * not reach, and a baseline that disagrees with the evidence are all ways this
 * file could start asserting something the machine never did.
 */
describe('recorded Windows runtime evidence', () => {
  it('uses the supported schema version', () => {
    expect(evidence.schemaVersion).toBe(1);
  });

  it('names the exact host and binary the run happened on', () => {
    expect(String(evidence.host.machine)).toBeTruthy();
    expect(String(evidence.host.os)).toBeTruthy();
    expect(String(evidence.host.applicationSha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(Number(evidence.host.applicationSizeBytes)).toBeGreaterThan(0);
  });

  /**
   * A record may pin the binary it was captured against, which matters when a
   * later fix forces a rebuild: the first ten records ran on the first binary and
   * the Module 01 records ran on the rebuild. A record that names a binary has to
   * name one that this repository actually declares, otherwise a digest could be
   * invented alongside it.
   */
  it('pins each record to a declared binary when it names one', () => {
    const declared = new Set(
      [evidence.host.applicationSha256, (evidence.host.rebuild as { applicationSha256?: string } | undefined)?.applicationSha256]
        .filter((value): value is string => typeof value === 'string'),
    );
    expect(declared.size).toBeGreaterThan(0);
    for (const value of declared) expect(value).toMatch(/^[0-9a-f]{64}$/);

    for (const record of evidence.records) {
      if (record.applicationSha256 === undefined) continue;
      expect(declared.has(record.applicationSha256), `${record.serviceId} binary`).toBe(true);
    }
  });

  it('only names implemented services', () => {
    expect(evidence.records.length).toBeGreaterThan(0);
    for (const record of evidence.records) {
      const capability = ALL_CAPABILITIES.find(item => item.id === record.serviceId);
      expect(capability, record.serviceId).toBeDefined();
      expect(capability!.implementationState, record.serviceId).toBe('implemented');
    }
  });

  it('matches the handler and native command the catalog publishes today', () => {
    for (const record of evidence.records) {
      const capability = ALL_CAPABILITIES.find(item => item.id === record.serviceId)!;
      expect(capability.handlerId, `${record.serviceId} handler`).toBe(record.handlerId);
      expect(resolveNativeCommand(record.handlerId), `${record.serviceId} command`).toBe(record.nativeCommand);
      expect(NATIVE_COMMANDS[record.handlerId as keyof typeof NATIVE_COMMANDS]).toBe(record.nativeCommand);
    }
  });

  it('reaches all four stages, or the record is not runtime proof', () => {
    for (const record of evidence.records) {
      expect(record.stages.uiControlClicked, `${record.serviceId} uiControlClicked`).toBe(true);
      expect(record.stages.ipcRoundTrip, `${record.serviceId} ipcRoundTrip`).toBe(true);
      expect(record.stages.nativeExecuted, `${record.serviceId} nativeExecuted`).toBe(true);
      expect(record.stages.resultRendered, `${record.serviceId} resultRendered`).toBe(true);
    }
  });

  it('carries an ISO timestamp, rendered evidence and an interpretation', () => {
    for (const record of evidence.records) {
      expect(record.capturedAt, record.serviceId).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(Number.isNaN(Date.parse(record.capturedAt)), record.serviceId).toBe(false);
      expect(record.renderedEvidence.trim().length, `${record.serviceId} renderedEvidence`).toBeGreaterThan(20);
      expect(record.interpretation.trim().length, `${record.serviceId} interpretation`).toBeGreaterThan(20);
    }
  });

  it('agrees with the generated baseline it feeds', () => {
    const runtimeInBaseline = baseline.services.filter(service => service.state === 'RUNTIME_VERIFIED');
    expect(runtimeInBaseline).toHaveLength(evidence.records.length);
    for (const record of evidence.records) {
      const serviceId = record.serviceId.toUpperCase().replace('_', '-');
      const row = baseline.services.find(service => service.serviceId === serviceId);
      expect(row, serviceId).toBeDefined();
      expect(row!.state, serviceId).toBe('RUNTIME_VERIFIED');
      expect(row!.verificationLevel, serviceId).toBe('runtime');
    }
    expect(baseline.totals.states.RUNTIME_VERIFIED).toBe(evidence.records.length);
  });

  it('keeps the global runtime gate honest about the remaining coverage', () => {
    const implemented = ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented').length;
    expect(baseline.globalRuntimeGate.eligible).toBe(implemented);
    expect(baseline.globalRuntimeGate.verified).toBe(evidence.records.length);
    expect(baseline.globalRuntimeGate.missing).toHaveLength(implemented - evidence.records.length);

    // The gate must not open while any implemented service is unproven, and it must
    // not stay closed once every one of them is proven.
    const expected = implemented === evidence.records.length ? 'PASS' : 'BLOCKED';
    expect(baseline.globalRuntimeGate.state).toBe(expected);
  });
});
