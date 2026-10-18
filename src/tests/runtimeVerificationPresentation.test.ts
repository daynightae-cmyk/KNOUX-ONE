import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ALL_CAPABILITIES } from '../data/capabilitiesCatalog';
import { RUNTIME_VERIFIED_SERVICE_IDS } from '../data/serviceVerification';

const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8');

const baseline = JSON.parse(read('docs/services/service-reality-baseline.json')) as {
  globalRuntimeGate: { state: string; verified: number; eligible: number; missing: string[] };
  totals: { services: number; states: Record<string, number> };
  services: { serviceId: string; state: string }[];
};

describe('runtime verification is never presented as static verification', () => {
  it('the interface set is exactly the baseline RUNTIME_VERIFIED list', () => {
    // The baseline prints `M01-S01`; the catalog calls the same service `m01_s01`.
    const fromBaseline = baseline.services
      .filter(service => service.state === 'RUNTIME_VERIFIED')
      .map(service => service.serviceId.toLowerCase().replace('-', '_'))
      .sort();
    expect([...RUNTIME_VERIFIED_SERVICE_IDS].sort()).toEqual(fromBaseline);
  });

  it('every runtime-verified id is an implemented service in the active catalog', () => {
    const catalog = new Map(ALL_CAPABILITIES.map(capability => [capability.id, capability]));
    for (const id of RUNTIME_VERIFIED_SERVICE_IDS) {
      const capability = catalog.get(id);
      expect(capability, `${id} is runtime verified but absent from the catalog`).toBeDefined();
      expect(capability!.implementationState, `${id} must be implemented, not merely planned`).toBe('implemented');
      expect(capability!.handlerId, `${id} claims runtime proof with no handler`).toBeTruthy();
    }
  });

  it('splits implemented services into runtime verified and statically verified only', () => {
    const implemented = ALL_CAPABILITIES.filter(capability => capability.implementationState === 'implemented');
    const runtimeVerified = implemented.filter(capability => RUNTIME_VERIFIED_SERVICE_IDS.has(capability.id));
    const staticOnly = implemented.filter(capability => !RUNTIME_VERIFIED_SERVICE_IDS.has(capability.id));

    // These are the two numbers the dashboard headline shows. Collapsing them into one
    // total is the mislabel this test exists to prevent.
    expect(implemented).toHaveLength(baseline.globalRuntimeGate.eligible);
    expect(runtimeVerified).toHaveLength(baseline.globalRuntimeGate.verified);
    expect(runtimeVerified.length + staticOnly.length).toBe(implemented.length);

    // The split has to be a real one, not a degenerate one.
    expect(runtimeVerified.length).toBeGreaterThan(0);
    expect(staticOnly.length).toBeGreaterThan(0);
  });

  it('the dashboard labels both kinds of proof and never calls the total statically verified', () => {
    const source = read('src/components/views/DashboardView.tsx');
    expect(source).toContain('runtimeVerified');
    expect(source).toContain('staticVerifiedOnly');
    expect(source).toContain('runtimeUnproven');
    // The original defect: one number followed by the words "statically verified".
    expect(source).not.toMatch(/\{capabilityCounts\.implemented\}\s*\{t\('statically verified services'/);
    expect(source).toContain("'runtime verified on Windows'");
    expect(source).toContain('Runtime gate BLOCKED');
  });

  it('README totals are generated and agree with the baseline', () => {
    const readme = read('README.md');
    const marked = readme.slice(
      readme.indexOf('<!-- service-reality:begin -->'),
      readme.indexOf('<!-- service-reality:end -->'),
    );
    const states = baseline.totals.states;
    expect(marked).toContain(`| Services | ${baseline.totals.services} |`);
    expect(marked).toContain(`| Statically verified native paths | ${states.STATIC_VERIFIED} |`);
    expect(marked).toContain(`| Partial native paths with documented limits | ${states.PARTIAL} |`);
    expect(marked).toContain(`| Planned, non-executable | ${states.PLANNED + states.GUARDED} |`);
    expect(marked).toContain(`| Runtime verified on Windows in repository evidence | ${states.RUNTIME_VERIFIED} |`);
  });

  it('the generator would reject a README whose totals were hand-edited', () => {
    const readme = read('README.md');
    const drifted = readme.replace(
      /\| Runtime verified on Windows in repository evidence \| \d+ \|/,
      '| Runtime verified on Windows in repository evidence | 0 |',
    );
    expect(drifted).not.toBe(readme);
    const marked = drifted.slice(
      drifted.indexOf('<!-- service-reality:begin -->'),
      drifted.indexOf('<!-- service-reality:end -->'),
    );
    expect(marked).not.toContain(`| Runtime verified on Windows in repository evidence | ${baseline.totals.states.RUNTIME_VERIFIED} |`);
  });
});