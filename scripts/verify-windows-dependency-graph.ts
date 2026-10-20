/**
 * KNOUX ONE — Windows dependency graph gate.
 *
 * `Cargo.lock` records every crate in the dependency graph for every target,
 * including crates that never compile into a Windows binary. Dependabot reports
 * advisories against those crates, which is accurate about the lockfile and
 * irrelevant to the shipped artifact.
 *
 * This gate answers the question that actually matters: does the vulnerable
 * crate appear in the dependency graph that produces the Windows build? It
 * resolves the graph for the Windows target and fails if a crate listed in
 * `WINDOWS_EXCLUDED_CRATES` is present.
 *
 * It does not silence an advisory that is genuinely reachable. If a crate in
 * this list ever enters the Windows graph, the gate fails and the advisory
 * must be treated as real.
 *
 * Usage: bun scripts/verify-windows-dependency-graph.ts
 */

import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = resolve(projectRoot, 'src-tauri');

/**
 * Crates that carry advisories but cannot reach a Windows binary.
 *
 * `glib` reaches the graph only through `gtk`, which `tao` depends on under
 * `cfg(any(target_os = "linux", target_os = "dragonfly", target_os = "freebsd",
 * target_os = "openbsd"))`. KNOUX ONE is a Windows-only product: its bundle
 * targets are `nsis` and `msi` and it never builds for Linux. The advisory
 * (GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429) is fixed in `glib` 0.20.0, and no
 * published `tao` release requires a `gtk` new enough to pull it in, so the
 * lockfile cannot be updated to a non-vulnerable `glib` without an upstream
 * release. This entry documents that the crate is unreachable rather than
 * pretending the advisory does not exist.
 */
const WINDOWS_EXCLUDED_CRATES: Array<{ crate: string; advisory: string; reason: string }> = [
  {
    crate: 'glib',
    advisory: 'GHSA-wrw7-89jp-8q8g / RUSTSEC-2024-0429',
    reason:
      'Reachable only through gtk -> tao under Linux/BSD target cfgs. KNOUX ONE ships Windows-only ' +
      'nsis/msi bundles, so this crate is not compiled into the shipped binary. Fixed upstream in ' +
      'glib 0.20.0; no published tao requires a gtk version that pulls it in yet.',
  },
];

const WINDOWS_TARGET = 'x86_64-pc-windows-msvc';

function readWindowsGraph(): string[] {
  const output = execFileSync(
    'cargo',
    ['tree', '--target', WINDOWS_TARGET, '--prefix', 'none', '--format', '{p}'],
    { cwd: tauriDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function main(): void {
  const graph = readWindowsGraph();

  if (graph.length === 0) {
    throw new Error(
      `The Windows dependency graph for ${WINDOWS_TARGET} resolved to nothing. ` +
        'This gate cannot prove anything about an empty graph, so it fails instead of passing.',
    );
  }

  const failures: string[] = [];

  for (const entry of WINDOWS_EXCLUDED_CRATES) {
    const pattern = new RegExp(`^${entry.crate} v`, 'm');
    if (pattern.test(graph.join('\n'))) {
      failures.push(
        `${entry.crate} is now present in the ${WINDOWS_TARGET} dependency graph. ` +
          `Advisory ${entry.advisory} is therefore reachable and must be fixed, not excluded.`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      'Windows dependency graph gate failed:\n' +
        failures.map(line => `  - ${line}`).join('\n'),
    );
  }

  const excluded = WINDOWS_EXCLUDED_CRATES.map(entry => entry.crate).join(', ');
  console.log(
    `Windows dependency graph gate passed: ${graph.length} packages resolved for ${WINDOWS_TARGET}.`,
  );
  console.log(`Documented as unreachable on Windows: ${excluded}.`);
}

main();
