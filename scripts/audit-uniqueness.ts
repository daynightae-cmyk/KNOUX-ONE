import { readFileSync } from 'node:fs';
import { NATIVE_COMMANDS } from '../src/services/nativeCommandRegistry';

const baseline = JSON.parse(readFileSync('docs/services/service-reality-baseline.json', 'utf8'));
const services = baseline.services as Array<{
  moduleId: string;
  serviceId: string;
  name: string;
  state: string;
  handlerId?: string;
  nativeCommand?: string;
  implementationState?: string;
}>;

const registry = NATIVE_COMMANDS as Record<string, string>;

console.log('=== A. services sharing one handlerId (not exclusive) ===');
const byHandler = new Map<string, typeof services>();
for (const s of services) {
  if (!s.handlerId) continue;
  const list = byHandler.get(s.handlerId) ?? [];
  list.push(s);
  byHandler.set(s.handlerId, list);
}
let shared = 0;
for (const [handler, list] of byHandler) {
  if (list.length > 1) {
    shared += list.length;
    console.log(`  ${handler} -> ${list.map(s => `${s.serviceId} (${s.name}) [${s.state}]`).join(' | ')}`);
  }
}
console.log(`  services on a shared handler: ${shared}`);

console.log('\n=== B. services sharing one native command ===');
const byCommand = new Map<string, typeof services>();
for (const s of services) {
  if (!s.nativeCommand) continue;
  const list = byCommand.get(s.nativeCommand) ?? [];
  list.push(s);
  byCommand.set(s.nativeCommand, list);
}
for (const [command, list] of byCommand) {
  if (list.length > 1) {
    console.log(`  ${command} -> ${list.map(s => `${s.serviceId} (${s.name})`).join(' | ')}`);
  }
}

console.log('\n=== C. handlerId not in the native registry ===');
let missing = 0;
for (const s of services) {
  if (s.handlerId && !(s.handlerId in registry)) {
    missing += 1;
    console.log(`  ${s.serviceId} ${s.handlerId} [${s.state}]`);
  }
}
console.log(`  missing: ${missing}`);

console.log('\n=== D. handler nativeCommand disagrees with the registry ===');
let mismatched = 0;
for (const s of services) {
  if (!s.handlerId || !s.nativeCommand) continue;
  const expected = registry[s.handlerId];
  if (expected && expected !== s.nativeCommand) {
    mismatched += 1;
    console.log(`  ${s.serviceId} ${s.handlerId}: baseline=${s.nativeCommand} registry=${expected}`);
  }
}
console.log(`  mismatched: ${mismatched}`);

console.log('\n=== E. registry handlers never bound to a catalog service ===');
const bound = new Set(services.map(s => s.handlerId).filter(Boolean) as string[]);
const orphans = Object.keys(registry).filter(h => !bound.has(h));
for (const h of orphans) console.log(`  ${h} -> ${registry[h]}`);
console.log(`  orphan handlers: ${orphans.length}`);

console.log('\n=== F. per-module service counts and state mix ===');
const byModule = new Map<string, typeof services>();
for (const s of services) {
  const list = byModule.get(s.moduleId) ?? [];
  list.push(s);
  byModule.set(s.moduleId, list);
}
for (const [moduleId, list] of byModule) {
  const states = list.reduce<Record<string, number>>((acc, s) => {
    acc[s.state] = (acc[s.state] ?? 0) + 1;
    return acc;
  }, {});
  const distinctNames = new Set(list.map(s => s.name)).size;
  console.log(`  ${moduleId}: ${list.length} services, ${distinctNames} distinct names, ${JSON.stringify(states)}`);
}

console.log('\n=== G. duplicate names across the whole catalog ===');
const byName = new Map<string, typeof services>();
for (const s of services) {
  const list = byName.get(s.name) ?? [];
  list.push(s);
  byName.set(s.name, list);
}
for (const [name, list] of byName) {
  if (list.length > 1) console.log(`  "${name}" -> ${list.map(s => s.serviceId).join(', ')}`);
}
