/**
 * KNOUX ONE — Vitest Catalog Integrity Test
 * Validates module mapping, capability count (19 modules x 10 services = 190 capabilities),
 * implementation states, and forbids false completed execution states.
 */

import { describe, it, expect } from 'vitest';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

describe('KNOUX ONE Catalog Integrity', () => {
  it('contains exactly 19 modules', () => {
    expect(MODULES_CATALOG.length).toBe(19);
  });

  it('contains exactly 190 registered capabilities (10 per module)', () => {
    let totalCapabilities = 0;
    MODULES_CATALOG.forEach(mod => {
      expect(mod.services.length, `${mod.id} must contain exactly ten services`).toBe(10);
      totalCapabilities += mod.services.length;
    });
    expect(totalCapabilities).toBe(190);
  });

  it('verifies that implemented modules (m01, m03, m07, m15, m16) have valid handlerIds and registered execution metadata', () => {
    const implementedModuleIds = ['m01', 'm03', 'm07', 'm15', 'm16'];
    const implementedMods = MODULES_CATALOG.filter(m => implementedModuleIds.includes(m.id));
    expect(implementedMods.length).toBe(5);

    implementedMods.forEach(mod => {
      mod.services.forEach(svc => {
        expect(['implemented', 'partial', 'planned', 'requires_configuration'], `${svc.id} has an invalid implementation state`).toContain(svc.implementationState);
        if (svc.implementationState === 'implemented') {
          expect(svc.handlerId, `${svc.id} must keep its explicit native handler registration`).toBeDefined();
          expect(svc.handlerId, `${svc.id} handler must match module ID prefix`).toMatch(new RegExp(`^${mod.id}\\.`));
        }
      });
    });
  });

  it('keeps planned modules visibly documented without falsely claiming completed execution', () => {
    const plannedModules = MODULES_CATALOG.filter(m => !['m01', 'm03', 'm07', 'm15', 'm16'].includes(m.id));

    plannedModules.forEach(mod => {
      mod.services.forEach(svc => {
        expect(svc.implementationState, `${mod.id}/${svc.id} must not claim complete native execution`).not.toBe('implemented');

        if (svc.implementationState === 'planned') {
          expect(svc.handlerId, `${mod.id}/${svc.id} planned service must not expose a native handler`).toBeUndefined();
        }

        if (svc.implementationState === 'partial') {
          expect(svc.handlerId, `${mod.id}/${svc.id} partial service must identify its reserved native bridge`).toBeDefined();
        }
      });
    });
  });

  it('ensures all capabilities have non-empty bilingual names and descriptions', () => {
    MODULES_CATALOG.forEach(mod => {
      mod.services.forEach(svc => {
        expect(svc.nameEn, `${svc.id} requires an English name`).toBeTruthy();
        expect(svc.nameAr, `${svc.id} requires an Arabic name`).toBeTruthy();
        expect(svc.descriptionEn, `${svc.id} requires an English description`).toBeTruthy();
        expect(svc.descriptionAr, `${svc.id} requires an Arabic description`).toBeTruthy();
      });
    });
  });
});
