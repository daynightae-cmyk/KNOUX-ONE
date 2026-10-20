/**
 * Regression guard for the PowerShell scripts embedded in the native sources.
 *
 * PowerShell reads `"$name: ..."` as a scoped variable reference, because `:` is
 * the scope operator. The whole script then fails to parse with
 *
 *   Variable reference is not valid. ':' was not followed by a valid variable
 *   name character. Consider using ${} to delimit the name.
 *
 * which surfaced in the app as a `powershell_command_failed` banner on the
 * Windows Event Intelligence and hardware warning queries. The fix is to write
 * `"${name}: ..."`, which this test enforces across every native source.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.rs')) out.push(full);
  }
  return out;
}

/** `$name:` where the name is a plain PowerShell variable. */
const AMBIGUOUS_VARIABLE = /\$[a-zA-Z_][a-zA-Z0-9_]*:/g;

/** `$env:NAME` is a distinct namespace and is not affected. */
const ENVIRONMENT_VARIABLE = /\$env:[a-zA-Z_][a-zA-Z0-9_]*/g;

/** Rust macro signatures such as `$name:ident` are not PowerShell. */
const RUST_MACRO_BINDING = /\$[a-zA-Z_][a-zA-Z0-9_]*:(ident|literal|ty|expr|path)\b/g;

describe('native PowerShell scripts', () => {
  const files = walk('src-tauri/src');

  it('finds the native sources to inspect', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('never writes an ambiguous $variable: reference into a PowerShell script', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      // Remove the two cases that are not PowerShell string content.
      const cleaned = source.replace(ENVIRONMENT_VARIABLE, '').replace(RUST_MACRO_BINDING, '');
      for (const match of cleaned.matchAll(AMBIGUOUS_VARIABLE)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      'Use ${name}: instead of $name: — the colon is the PowerShell scope operator.',
    ).toEqual([]);
  });

  it('keeps the corrected diagnostics queries on the braced form', () => {
    const events = readFileSync('src-tauri/src/diagnostics/events.rs', 'utf8');
    expect(events).toContain('${{channel}}:');
    expect(events).not.toContain('"$channel:');

    const hardware = readFileSync('src-tauri/src/diagnostics/hardware.rs', 'utf8');
    expect(hardware).toContain('${{provider}}:');
    expect(hardware).not.toContain('"$provider:');
  });
});
