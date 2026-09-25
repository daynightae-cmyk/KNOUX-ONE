import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MODULES_CATALOG } from '../src/data/capabilitiesCatalog';
import { PARTIAL_SERVICE_IDS } from '../src/data/serviceVerification';
import { NATIVE_COMMANDS } from '../src/services/nativeCommandRegistry';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputJson = resolve(projectRoot, 'docs/services/service-reality-baseline.json');
const outputMarkdown = resolve(projectRoot, 'docs/services/service-reality-baseline.md');

const STATE_ORDER = ['PLANNED', 'GUARDED', 'STATIC_VERIFIED', 'PARTIAL', 'RUNTIME_VERIFIED', 'BLOCKED'] as const;
type ServiceState = (typeof STATE_ORDER)[number];

type BaselineService = {
  moduleId: string;
  serviceId: string;
  serviceNumber: number;
  name: string;
  nameAr: string;
  state: ServiceState;
  verificationLevel: 'none' | 'static' | 'runtime';
  runtime: 'windows';
  handlerId?: string;
  nativeCommand?: string;
  requiresElevation: boolean;
  reversible: boolean;
  dangerous: boolean;
  testPosture: string;
  evidence: string;
};

function stateFor(service: { id: string; implementationState?: string; handlerId?: string }): ServiceState {
  if (PARTIAL_SERVICE_IDS.has(service.id)) return 'PARTIAL';
  if (service.implementationState === 'implemented' && service.handlerId) return 'STATIC_VERIFIED';
  return 'PLANNED';
}

function verificationLevelFor(state: ServiceState): BaselineService['verificationLevel'] {
  if (state === 'STATIC_VERIFIED' || state === 'PARTIAL') return 'static';
  return 'none';
}

function testPostureFor(state: ServiceState, moduleId: string): string {
  if (state === 'PLANNED') return 'No active native-handler test applicable.';
  if (moduleId === 'm03') return 'Static contract tests plus limited Rust unit tests; Windows runtime and E2E proof are not recorded.';
  if (moduleId === 'm02' || moduleId === 'm04' || ['m05', 'm06', 'm07', 'm08'].includes(moduleId)) {
    return 'Static contract/integrity tests; Windows runtime and E2E proof are not recorded.';
  }
  return 'Static contract evidence only; Windows runtime and E2E proof are not recorded.';
}

function evidenceFor(state: ServiceState, serviceId: string, handlerId?: string, nativeCommand?: string): string {
  if (state === 'PLANNED') {
    return 'Active catalog deliberately exposes no native handler; this service must not be presented as runnable.';
  }
  if (serviceId === 'm04_s10') {
    return 'Partial: current native export serializes JSON evidence only; the catalog must not claim PDF until a tested PDF producer exists.';
  }
  if (PARTIAL_SERVICE_IDS.has(serviceId)) {
    return 'Partial: active native path exists, but audited media/archive or old-file behavior remains intentionally limited and is not runtime verified.';
  }
  return `Static trace: catalog handler ${handlerId ?? 'missing'} maps to ${nativeCommand ?? 'missing native command'}; Windows runtime proof is still required.`;
}

function markdownTableRow(values: string[]): string {
  return `| ${values.map(value => value.replaceAll('|', '\\|')).join(' | ')} |`;
}

const services: BaselineService[] = MODULES_CATALOG.flatMap(module =>
  module.services.map(service => {
    const state = stateFor(service);
    const nativeCommand = service.handlerId ? NATIVE_COMMANDS[service.handlerId as keyof typeof NATIVE_COMMANDS] : undefined;
    return {
      moduleId: module.id.toUpperCase(),
      serviceId: service.id.toUpperCase().replace('_', '-'),
      serviceNumber: service.serviceNumber,
      name: service.nameEn,
      nameAr: service.nameAr,
      state,
      verificationLevel: verificationLevelFor(state),
      runtime: 'windows',
      handlerId: service.handlerId,
      nativeCommand,
      requiresElevation: Boolean(service.requiresAdmin),
      reversible: Boolean(service.supportsUndo || service.supportsQuarantine),
      dangerous: Boolean(service.requiresAdmin || service.riskLevel === 'moderate' || service.riskLevel === 'high'),
      testPosture: testPostureFor(state, module.id),
      evidence: evidenceFor(state, service.id, service.handlerId, nativeCommand),
    };
  }),
);

if (services.length !== 190) {
  throw new Error(`Service baseline integrity failure: expected 190 services, found ${services.length}.`);
}

const counts = Object.fromEntries(STATE_ORDER.map(state => [state, services.filter(service => service.state === state).length]));
const byModule = MODULES_CATALOG.map(module => {
  const moduleId = module.id.toUpperCase();
  const moduleServices = services.filter(service => service.moduleId === moduleId);
  return {
    moduleId,
    name: module.nameEn,
    total: moduleServices.length,
    counts: Object.fromEntries(STATE_ORDER.map(state => [state, moduleServices.filter(service => service.state === state).length])),
  };
});

const baseline = {
  schemaVersion: 1,
  sourceOfTruth: 'src/data/capabilitiesCatalog.ts + src/services/nativeCommandRegistry.ts',
  runtimeVerificationPolicy: 'Only recorded Windows runtime evidence may set verificationLevel to runtime.',
  globalRuntimeGate: {
    state: 'BLOCKED',
    reason: 'Native build had not yet passed a clean Windows Tauri check when this baseline was generated. This is a global verification gate, not evidence that every service implementation is broken.',
  },
  totals: {
    services: services.length,
    states: counts,
    runtimeVerifiedPercentageOfEligible: 0,
  },
  modules: byModule,
  services,
};

const markdown = [
  '# KNOUX ONE — Service Reality Baseline',
  '',
  '> This file is generated by `scripts/generate-service-reality.ts`. Do not edit it by hand; run `bun run services:generate` after changing the active catalog or native command registry.',
  '',
  '## Verification policy',
  '',
  'A service is **not** runtime verified merely because its UI, handler, or static test exists. `RUNTIME_VERIFIED` requires recorded Windows runtime evidence. The current global native runtime gate is **BLOCKED** until a clean native build and Windows runtime evidence are recorded.',
  '',
  '## Totals',
  '',
  markdownTableRow(['State', 'Count']),
  markdownTableRow(['---', '---:']),
  ...STATE_ORDER.map(state => markdownTableRow([state, String(counts[state])])),
  markdownTableRow(['TOTAL', String(services.length)]),
  '',
  '## Module dashboard',
  '',
  markdownTableRow(['Module', 'Total', ...STATE_ORDER]),
  markdownTableRow(['---', '---:', ...STATE_ORDER.map(() => '---:')]),
  ...byModule.map(module => markdownTableRow([module.moduleId, String(module.total), ...STATE_ORDER.map(state => String(module.counts[state]))])),
  '',
  '## Service inventory',
  '',
  markdownTableRow(['Service', 'Name', 'State', 'Verification', 'Handler', 'Native command', 'Evidence']),
  markdownTableRow(['---', '---', '---', '---', '---', '---', '---']),
  ...services.map(service => markdownTableRow([
    service.serviceId,
    service.name,
    service.state,
    service.verificationLevel,
    service.handlerId ?? '—',
    service.nativeCommand ?? '—',
    service.evidence,
  ])),
  '',
].join('\n');

async function main() {
  await mkdir(dirname(outputJson), { recursive: true });
  const json = `${JSON.stringify(baseline, null, 2)}\n`;
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const [existingJson, existingMarkdown] = await Promise.all([readFile(outputJson, 'utf8'), readFile(outputMarkdown, 'utf8')]);
    if (existingJson !== json || existingMarkdown !== markdown) {
      throw new Error('Service baseline is stale. Run `bun run services:generate` and commit the generated outputs.');
    }
    return;
  }

  await Promise.all([writeFile(outputJson, json), writeFile(outputMarkdown, markdown)]);
}

await main();
