/**
 * Services with a real native path whose audited scope remains intentionally limited.
 *
 * A service is removed from this set only when its closure target in
 * `PARTIAL_SERVICES_CLOSURE.md` is actually met, and only after the repository gates pass.
 * Removing an id here moves the presentation counts: `partial` down, `implemented` up.
 * It does **not** make the service runtime verified; that needs recorded Windows evidence.
 */
export const PARTIAL_SERVICE_IDS = new Set<string>([]);
