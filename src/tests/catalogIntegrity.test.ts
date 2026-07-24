/**
 * KNOUX ONE — Catalog Integrity Audit
 * Validates module mapping, capability count (19 modules x 10 services = 190 capabilities), and bilingual string completeness.
 */

import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

export function runCatalogIntegrityAudit(): {
  success: boolean;
  moduleCount: number;
  capabilityCount: number;
  errors: string[];
} {
  const errors: string[] = [];
  const seenCapabilityIds = new Set<string>();
  let totalCapabilities = 0;

  if (MODULES_CATALOG.length !== 19) {
    errors.push(`Expected 19 modules in catalog, found ${MODULES_CATALOG.length}`);
  }

  MODULES_CATALOG.forEach((mod, modIdx) => {
    const expectedModNumber = modIdx + 1;
    const expectedModId = `m${expectedModNumber.toString().padStart(2, '0')}`;

    if (mod.id !== expectedModId) {
      errors.push(`Module at index ${modIdx} has ID "${mod.id}", expected "${expectedModId}"`);
    }

    if (mod.number !== expectedModNumber) {
      errors.push(`Module ${mod.id} has number ${mod.number}, expected ${expectedModNumber}`);
    }

    if (!mod.services || mod.services.length !== 10) {
      errors.push(`Module ${mod.id} must have exactly 10 services, found ${mod.services?.length || 0}`);
    }

    mod.services?.forEach((svc, svcIdx) => {
      totalCapabilities++;
      const expectedSvcNumber = svcIdx + 1;
      const expectedSvcId = `${expectedModId}_s${expectedSvcNumber.toString().padStart(2, '0')}`;

      if (svc.id !== expectedSvcId) {
        errors.push(`Capability at module ${mod.id} service index ${svcIdx} has ID "${svc.id}", expected "${expectedSvcId}"`);
      }

      if (seenCapabilityIds.has(svc.id)) {
        errors.push(`Duplicate capability ID detected: "${svc.id}"`);
      }
      seenCapabilityIds.add(svc.id);

      if (!svc.nameEn || !svc.nameAr) {
        errors.push(`Capability "${svc.id}" is missing bilingual titles.`);
      }

      if (!svc.descriptionEn || !svc.descriptionAr) {
        errors.push(`Capability "${svc.id}" is missing bilingual descriptions.`);
      }
    });
  });

  if (totalCapabilities !== 190) {
    errors.push(`Expected exactly 190 total capabilities in catalog, found ${totalCapabilities}`);
  }

  return {
    success: errors.length === 0,
    moduleCount: MODULES_CATALOG.length,
    capabilityCount: totalCapabilities,
    errors
  };
}

// Auto-run validation check log on import
const auditResult = runCatalogIntegrityAudit();
if (auditResult.success) {
  console.log(`[KNOUX CATALOG AUDIT] Verified 19 Modules and 190 Registered Capabilities. Integrity 100%.`);
} else {
  console.warn(`[KNOUX CATALOG AUDIT ERRORS]`, auditResult.errors);
}
