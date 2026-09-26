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
  if (serviceId === 'm04_s05') {
    return 'Old-file analysis measures the machine last-access policy with fsutil and the registry, labels every row LAST_ACCESS, LAST_WRITE_FALLBACK or UNKNOWN, and only says "not accessed since" when access time was measured reliable. Read-only; Windows runtime proof is still required.';
  }
  if (serviceId === 'm04_s10') {
    return 'Storage reports are regenerated from the SQLite snapshot after a restart, rendered as deterministic JSON, CSV and HTML, and hashed with SHA-256 and BLAKE3 with a format-signature check. PDF is reported as unsupported with its reason rather than faked. Windows runtime proof is still required.';
  }
  const plannedBatchEvidence: Record<string, string> = {
    m01_s03: 'Winget is diagnosed by measuring the real executable, capturing the verbatim `winget source list` output and listing the newest diagnostic log. Each guidance step must cite the measurement that produced it, and the response reports that zero mutating actions were performed. Guidance text is never executed by the application. Windows runtime proof is still required.',
    m01_s04: 'The bundled recommendation catalog is resolved against the measured Windows uninstall registry, and the exact catalog bytes are reported with a SHA-256 so a policy edit is always visible. A package identifier is only reported as verified when an explicitly requested check actually succeeded. Windows runtime proof is still required.',
    m01_s07: 'The uninstall registry is read across HKLM 64-bit, HKLM WOW6432Node and HKCU; system-component and update entries are excluded by a named rule and the exclusion counts are reported. The JSON, CSV or HTML report is written, hashed with SHA-256 and read back before it is reported as exported. Windows runtime proof is still required.',
    m01_s08: 'A post-format profile accepts only allowlisted native handlers with only their allowlisted parameter keys, so it cannot become an arbitrary command line. The document is written atomically, read back and hashed. No Windows scheduled task is created and no system state changes. Windows runtime proof is still required.',
    m02_s06: 'The real Delivery Optimization cache directories are measured with the file API under a depth ceiling, a file ceiling and a listing ceiling; hitting a ceiling is reported. The Delivery Optimization cmdlets are read when present and their absence is reported rather than faked. Nothing is removed. Windows runtime proof is still required.',
    m02_s08: 'The Recycle Bin is enumerated through the Windows Shell namespace and sized from the shell detail columns. The number of entries that carry no size is reported, so the byte total never overstates coverage. Nothing is emptied. Windows runtime proof is still required.',
    m02_s10: 'A cleanup profile is measured through the same allowlisted category list as the ordinary cleanup and is persisted and hashed like every other profile document. Applying it delegates to the existing audited cleanup execute command, so there is one deletion path, and it requires a literal confirmation token. No Windows scheduled task is registered. Windows runtime proof is still required.',
    m10_s01: 'Defender status, signature age, scan ages and the full exclusion list are read from Get-MpComputerStatus, Get-MpPreference, the WinDefend service and the signature registry key. Each provider is reported separately so one that stayed silent is visible. No scan is started and no setting is written. The Defender scan services remain planned because no scan has actually been run on a user machine yet. Windows runtime proof is still required.',
    m10_s05: 'Every firewall profile is read with its default actions and logging state, and active rules are counted rather than listed. No rule is created, enabled or disabled. Windows runtime proof is still required.',
    m10_s06: 'The machine and per-user User Account Control policy values are read and each is given its plain meaning, so a bare numeric policy value is never presented without an interpretation. The response names the machine policy as the governing scope. No value is written and no elevation is requested. Windows runtime proof is still required.',
    m10_s07: 'SmartScreen policy is probed at all six locations Windows exposes it and each readable value is reported with its origin. When no location is readable the service reports unknown rather than assuming a default. Windows runtime proof is still required.',
    m10_s08: 'Secure Boot is read through Confirm-SecureBootUEFI and the firmware registry flag, and TPM through Get-Tpm and Win32_Tpm. Secure Boot being off is reported as a reading rather than an error, and a TPM no provider could reach is reported as unmeasured rather than absent. Windows runtime proof is still required.',
    m09_s01: 'The per-user CapabilityAccessManager consent store is read across webcam, microphone, location and extended location, with per-application allow, deny and never-asked counts and last-used timestamps converted from Windows FILETIME. A store that does not exist is reported as absent, not as clean. No permission is changed. Windows runtime proof is still required.',
    m09_s02: 'Camera consent entries are projected from the same measured consent store the dashboard uses, so the two services cannot disagree. An absent webcam store is reported as absent. Windows runtime proof is still required.',
    m09_s03: 'Microphone consent entries come from the same measured consent store as the dashboard, with per-application counts and real last-used times. Windows runtime proof is still required.',
    m09_s04: 'Location consent is read from the measured consent store. A capability Windows has no record of is reported as unmeasured rather than permitted. Windows runtime proof is still required.',
    m09_s05: 'The stored per-user advertising identifier and its Enabled switch are read verbatim. A stored identifier with the feature switched off is reported as stored rather than active, which is what a Windows reset actually leaves behind. Nothing is reset by this service. Windows runtime proof is still required.',
    m09_s06: 'Clipboard history state is read from the registry. The clipboard content is only described when the request explicitly opts in, is truncated to a sixty-character preview and is never stored. Clearing requires the literal confirmation token and does not clear clipboard history itself. Windows runtime proof is still required.',
    m09_s09: 'The Windows hosts file is read as bytes, validated as UTF-8 and parsed into active mappings, comments and blank lines. Blocking entries and repeated addresses are counted, and an unreadable or non-UTF-8 file is reported as such rather than as empty. The file is not modified. Windows runtime proof is still required.',
    m11_s03: 'An explicit document list from the KNOUX ONE app data directory is exported, each file hashed and read back, and a manifest written, hashed and read back in turn. Directory walks are emitted in sorted order with a normalised path separator so the digest is reproducible on any platform. An empty export reports everythingVerified false rather than reading as a good backup. Windows runtime proof is still required.',
    m11_s05: 'Machine and per-user environment variables are read from the registry and exported, with PATH reported in the order Windows actually searches it and every entry present in both scopes named, because exporting one scope alone loses entries on restore. Windows runtime proof is still required.',
    m11_s06: 'Browsers are discovered from real profile directories and Chromium profile names are read from Local State rather than guessed. Every Bookmarks file is validated as JSON before it is called a backup, and a Firefox profile is copied as a complete places.sqlite set including its WAL and SHM sidecars. Nothing is written inside any browser profile directory. Windows runtime proof is still required.',
  };
  if (plannedBatchEvidence[serviceId]) return plannedBatchEvidence[serviceId];
  if (PARTIAL_SERVICE_IDS.has(serviceId)) {
    return 'Partial: active native path exists, but audited media/archive behavior remains intentionally limited and is not runtime verified.';
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

/**
 * Git checks this file out with CRLF on a Windows clone when `core.autocrlf=true`, while the
 * generator always emits LF. Comparing the raw bytes therefore fails on Windows and passes
 * on Linux for identical content, which is exactly the kind of gate that reports a result it
 * did not measure. Line endings are normalised before the comparison so the check reports
 * staleness of content, not of the platform it ran on.
 */
const normaliseLineEndings = (value: string): string => value.replace(/\r\n/g, '\n');

async function main() {
  await mkdir(dirname(outputJson), { recursive: true });
  const json = `${JSON.stringify(baseline, null, 2)}\n`;
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const [existingJson, existingMarkdown] = await Promise.all([readFile(outputJson, 'utf8'), readFile(outputMarkdown, 'utf8')]);
    if (normaliseLineEndings(existingJson) !== json || normaliseLineEndings(existingMarkdown) !== markdown) {
      throw new Error('Service baseline is stale. Run `bun run services:generate` and commit the generated outputs.');
    }
    return;
  }

  await Promise.all([writeFile(outputJson, json), writeFile(outputMarkdown, markdown)]);
}

await main();
