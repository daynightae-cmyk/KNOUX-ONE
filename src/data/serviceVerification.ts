/**
 * Services with a real native path whose audited scope remains intentionally limited.
 *
 * A service is removed from this set only when its closure target in
 * `PARTIAL_SERVICES_CLOSURE.md` is actually met, and only after the repository gates pass.
 * Removing an id here moves the presentation counts: `partial` down, `implemented` up.
 * It does **not** make the service runtime verified; that needs recorded Windows evidence.
 */
export const PARTIAL_SERVICE_IDS = new Set<string>([]);

/**
 * Services whose full Windows path was driven and rendered, recorded in
 * `docs/evidence/windows-runtime-evidence.json` and classified `RUNTIME_VERIFIED` in
 * `docs/services/service-reality-baseline.json`.
 *
 * This set exists so the interface can stop presenting runtime-verified services as
 * merely statically verified. `implemented` covers both kinds, so a count of 101 does
 * not mean 101 verified services — it means 29 driven on Windows and 72 proven only
 * statically.
 *
 * Ids are catalog ids (`m01_s01`). The generated baseline writes them as `M01-S01`, and
 * `runtimeVerificationPresentation.test.ts` asserts the two forms agree, so this set
 * cannot silently drift away from the evidence.
 */
export const RUNTIME_VERIFIED_SERVICE_IDS = new Set<string>([
  'm01_s01',
  'm01_s02',
  'm01_s03',
  'm01_s04',
  'm01_s07',
  'm02_s01',
  'm02_s03',
  'm02_s04',
  'm02_s06',
  'm02_s08',
  'm02_s10',
  'm04_s02',
  'm04_s03',
  'm04_s04',
  'm04_s05',
  'm04_s06',
  'm04_s08',
  'm04_s09',
  'm04_s10',
  'm09_s01',
  'm09_s05',
  'm09_s09',
  'm10_s07',
  'm10_s08',
  'm11_s03',
  'm11_s05',
  'm11_s06',
  'm15_s01',
  'm15_s03',
]);