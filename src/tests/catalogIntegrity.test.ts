import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

describe('KNOUX ONE honest capability catalog', () => {
  it('contains exactly 19 modules and 190 services', () => {
    expect(MODULES_CATALOG).toHaveLength(19);
    for (const module of MODULES_CATALOG) {
      expect(module.services, module.id).toHaveLength(10);
    }
    expect(ALL_CAPABILITIES).toHaveLength(190);
    expect(new Set(ALL_CAPABILITIES.map(item => item.id)).size).toBe(190);
  });

  it('never exposes a planned service as an executable handler', () => {
    for (const capability of ALL_CAPABILITIES) {
      if (capability.implementationState === 'planned') {
        expect(capability.handlerId, capability.id).toBeUndefined();
        expect(capability.status, capability.id).toBe('planned');
      }
    }
  });

  it('maps every executable service to an explicit allowlisted native command', () => {
    for (const capability of ALL_CAPABILITIES) {
      if (capability.handlerId) {
        expect(
          Object.prototype.hasOwnProperty.call(NATIVE_COMMANDS, capability.handlerId),
          `${capability.id}/${capability.handlerId}`,
        ).toBe(true);
      }
      if (capability.implementationState === 'implemented') {
        expect(capability.handlerId, capability.id).toBeTruthy();
      }
    }
  });

  it('keeps Module 15 and Module 16 honestly planned during Phase 04A', () => {
    for (const moduleId of ['m15', 'm16']) {
      const module = MODULES_CATALOG.find(item => item.id === moduleId);
      expect(module).toBeDefined();
      for (const service of module!.services) {
        expect(service.implementationState, service.id).toBe('planned');
        expect(service.handlerId, service.id).toBeUndefined();
      }
    }
  });

  it('publishes the verified Module 03 implementation matrix', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm03');
    const states = Object.fromEntries(module!.services.map(service => [service.id, service.implementationState]));
    expect(states).toEqual({
      m03_s01: 'implemented',
      m03_s02: 'implemented',
      m03_s03: 'partial',
      m03_s04: 'partial',
      m03_s05: 'partial',
      m03_s06: 'implemented',
      m03_s07: 'partial',
      m03_s08: 'implemented',
      m03_s09: 'implemented',
      m03_s10: 'implemented',
    });
  });
});
