/**
 * KNOUX ONE — Vitest Catalog Integrity Test
 * Validates module mapping, capability count (19 modules x 10 services = 190 capabilities),
 * implementation states, and forbids fake completion states.
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

  it('verifies that Module 01 capabilities have valid handlerIds and registered execution metadata', () => {
    const m01 = MODULES_CATALOG.find(m => m.id === 'm01');
    expect(m01).toBeDefined();

    m01?.services.forEach(svc => {
      expect(['implemented', 'partial', 'planned'], `${svc.id} has an invalid implementation state`).toContain(svc.implementationState);
      expect(svc.handlerId, `${svc.id} must keep its explicit native handler registration`).toBeDefined();
      expect(svc.handlerId, `${svc.id} handler must remain inside Module 01`).toMatch(/^m01\./);
    });
  });

  it('verifies that Modules 02-19 capabilities are honestly disabled as planned without handlerIds', () => {
    const otherModules = MODULES_CATALOG.filter(m => m.id !== 'm01');

    otherModules.forEach(mod => {
      mod.services.forEach(svc => {
        expect(svc.implementationState, `${mod.id}/${svc.id} must not claim partial or complete native execution`).toBe('planned');
        expect(svc.handlerId, `${mod.id}/${svc.id} must not expose a native handler before implementation`).toBeUndefined();
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
