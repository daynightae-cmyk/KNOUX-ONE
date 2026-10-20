/**
 * Service exclusivity gate.
 *
 * A catalog service is the unit a user acts on, so every service must own
 * exactly one native command and no two services may share one. Every native
 * command that is not a catalog service must be declared below as a workspace
 * primitive, with the reason it is not a service of its own.
 *
 * The gate fails when a service is bound to no command, to a command that does
 * not exist, to a command another service already owns, when two services share
 * a name, or when a command is neither bound nor declared.
 */
import { readFileSync } from 'node:fs';

import { MODULES_CATALOG } from '../src/data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../src/services/nativeCommandRegistry';

/**
 * Implemented native commands that are deliberately not catalog services.
 *
 * Each one is a step inside a service the user already acts on, not an outcome
 * of its own, so publishing it as a separate service would duplicate the
 * surface the user sees.
 */
const WORKSPACE_PRIMITIVES: Record<string, string> = {
  'm01.winget.queue.list': 'Reads the persistent installation queue behind M01-S05.',
  'm01.winget.queue.resume': 'Resumes the persistent installation queue behind M01-S05.',
  'm01.profiles.postformat.list': 'Lists the post-format profiles created by M01-S08.',
  'm02.cleanup.scan': 'Scan step of the M02 cleanup workspace.',
  'm02.cleanup.execute': 'Execute step of the M02 cleanup workspace.',
  'm02.cleanup.cancel': 'Cancel step of the M02 cleanup workspace.',
  'm02.cleanup.history': 'History step of the M02 cleanup workspace.',
  'm02.downloads.quarantine.list': 'Lists the quarantined downloads of M02-S09.',
  'm02.downloads.quarantine.restore': 'Restores a quarantined download of M02-S09.',
  'm03.job.list': 'Lists the running duplicate scan jobs of M03.',
  'm03.job.pause': 'Pauses a running duplicate scan job of M03.',
  'm03.job.resume': 'Resumes a paused duplicate scan job of M03.',
  'm03.job.cancel': 'Cancels a running duplicate scan job of M03.',
  'm03.scan.history': 'Reads the duplicate scan history of M03.',
  'm03.scan.result': 'Reads the stored result of a duplicate scan of M03.',
  'm03.folder.pick': 'Chooses the folder that the M03 scan inspects.',
  'm04.report.history': 'Reads the stored storage reports of M04.',
  'm04.scan.cancel': 'Cancels a running storage scan of M04.',
  'm05.startup.change': 'Enables or disables one startup entry behind M05-S07 and M05-S09.',
  'm16.projects.discover': 'Workspace tool of the M16 project surface.',
  'm16.projects.health': 'Workspace tool of the M16 project surface.',
  'm16.commands.execute': 'Workspace tool of the M16 project surface.',
  'm16.git.workspace': 'Workspace tool of the M16 project surface.',
  'm16.runtime.orchestrate': 'Workspace tool of the M16 project surface.',
  'm16.reports.export': 'Workspace tool of the M16 project surface.',
};

const registry = NATIVE_COMMANDS as Record<string, string>;
const failures: string[] = [];

// 1. Every service is bound to exactly one command that exists.
const boundHandlers = new Map<string, string[]>();
for (const module of MODULES_CATALOG) {
  for (const service of module.services) {
    const handlerId = service.handlerId;
    if (!handlerId) {
      if (service.status !== 'planned' || service.implementationState !== 'planned') {
        failures.push(
          `${service.id} has no handler but is not planned (status=${service.status}, state=${service.implementationState}).`,
        );
      }
      continue;
    }
    if (!registry[handlerId]) {
      failures.push(`${service.id} points at ${handlerId}, which is not in the native registry.`);
      continue;
    }
    if (service.status !== 'available' || service.implementationState !== 'implemented') {
      failures.push(
        `${service.id} owns ${handlerId} but is not published as implemented (status=${service.status}, state=${service.implementationState}).`,
      );
    }
    const owners = boundHandlers.get(handlerId) ?? [];
    owners.push(service.id);
    boundHandlers.set(handlerId, owners);
  }
}

// 2. No two services may share a handler.
for (const [handlerId, owners] of boundHandlers) {
  if (owners.length > 1) {
    failures.push(`${handlerId} is shared by ${owners.length} services: ${owners.join(', ')}.`);
  }
}

// 3. No two services may share a name.
const byName = new Map<string, string[]>();
for (const module of MODULES_CATALOG) {
  for (const service of module.services) {
    const owners = byName.get(service.nameEn) ?? [];
    owners.push(service.id);
    byName.set(service.nameEn, owners);
  }
}
for (const [name, owners] of byName) {
  if (owners.length > 1) {
    failures.push(`The name "${name}" is used by ${owners.length} services: ${owners.join(', ')}.`);
  }
}

// 4. Every registered command is either a catalog service or a declared primitive.
for (const handlerId of Object.keys(registry)) {
  if (boundHandlers.has(handlerId)) continue;
  if (!(handlerId in WORKSPACE_PRIMITIVES)) {
    failures.push(`${handlerId} is implemented and allowlisted but no service owns it and it is not a declared workspace primitive.`);
  }
}

// 5. Every declared primitive must still exist.
for (const handlerId of Object.keys(WORKSPACE_PRIMITIVES)) {
  if (!registry[handlerId]) {
    failures.push(`Workspace primitive ${handlerId} is declared but no longer in the native registry.`);
  }
}

// 6. The generated baseline must agree with the catalog and the registry.
const baseline = JSON.parse(
  readFileSync('docs/services/service-reality-baseline.json', 'utf8'),
) as {
  services: Array<{ serviceId: string; handlerId?: string; nativeCommand?: string }>;
};
for (const record of baseline.services) {
  if (!record.handlerId) continue;
  const expected = registry[record.handlerId];
  if (!expected) {
    failures.push(`The baseline binds ${record.serviceId} to ${record.handlerId}, which is not in the native registry.`);
  } else if (expected !== record.nativeCommand) {
    failures.push(
      `The baseline maps ${record.serviceId} to ${record.nativeCommand} while the registry maps ${record.handlerId} to ${expected}.`,
    );
  }
}

const serviceCount = MODULES_CATALOG.reduce((total, module) => total + module.services.length, 0);
const exclusiveCount = boundHandlers.size;
const primitiveCount = Object.keys(WORKSPACE_PRIMITIVES).length;

if (failures.length > 0) {
  console.error('Service exclusivity gate failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  `Service exclusivity gate passed: ${serviceCount} services, ${exclusiveCount} exclusive native commands, ${primitiveCount} declared workspace primitives.`,
);
