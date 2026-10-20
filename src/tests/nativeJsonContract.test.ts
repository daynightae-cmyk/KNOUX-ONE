/**
 * Regression guard for the JSON contract between the native PowerShell
 * scripts and the Rust envelopes that read them.
 *
 * Two contract defects were found by running the diagnostics on a Windows
 * host, and both silently destroyed a whole result:
 *
 * 1. `m17_updates_analyze` — the script writes `installedUpdates`, but the
 *    Rust envelope had no camelCase binding, so the field never bound and the
 *    query failed with `missing field 'installed_updates'`, discarding the
 *    events and hotfixes that had been collected successfully.
 *
 * 2. `m17_bsod_triage` — Windows PowerShell 5.1 serialises
 *    `Select-Object -First 1 -ExpandProperty Source` over an empty pipeline
 *    as `{}` instead of `null`, and a map cannot be read as a path, so the
 *    triage failed with `invalid type: map, expected a string`.
 *
 * This test reads the native sources and checks the contract that connects
 * them, so a mismatch is caught on every runner and not only on Windows.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIAGNOSTICS_DIR = 'src-tauri/src/diagnostics';

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.rs')) out.push(full);
  }
  return out;
}

/** Removes the lines that are a Rust comment, so a note about a pattern is
 *  never mistaken for the pattern itself. */
function withoutComments(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

/** Keeps only the production code. A test module may quote a pattern in an
 *  assertion message, and a test is not the script the app runs. */
function productionSource(source: string): string {
  const testIndex = source.indexOf('#[cfg(test)]');
  return testIndex === -1 ? source : source.slice(0, testIndex);
}

/** The object a script pipes into `ConvertTo-Json`. Only that object is the
 *  envelope; the other objects in a script describe a single record. */
const ENVELOPE_START = '[pscustomobject]@{';

/** `installedUpdates` is `installed_updates` in a Rust field name. */
function snakeCase(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** The keys of the object a script pipes into `ConvertTo-Json`. */
function envelopeKeys(source: string): string[] {
  const jsonIndex = source.lastIndexOf('ConvertTo-Json');
  if (jsonIndex === -1) return [];

  const start = source.lastIndexOf(ENVELOPE_START, jsonIndex);
  if (start === -1) return [];

  const close = source.lastIndexOf('}', jsonIndex);
  if (close <= start) return [];

  const content = source
    .slice(start + ENVELOPE_START.length, close)
    .replace(/^\{+/, '')
    .replace(/\}+$/, '');

  return content
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter((key) => /^[a-zA-Z][a-zA-Z0-9]*$/.test(key));
}

interface Envelope {
  file: string;
  keys: string[];
  fields: string[];
  camelCase: boolean;
}

/** Reads the envelope a script writes and the envelope a Rust struct reads. */
function readEnvelopes(file: string): Envelope | null {
  const source = productionSource(readFileSync(file, 'utf8'));

  const structIndex = source.indexOf('struct RawEnvelope');
  if (structIndex === -1) return null;

  const bodyEnd = source.indexOf('}', structIndex);
  const body = source.slice(structIndex, bodyEnd);

  // The serde attribute sits above the struct, so the search looks back.
  const attributeStart = source.lastIndexOf('#[serde', structIndex);
  const attribute = attributeStart === -1 ? '' : source.slice(attributeStart, structIndex);

  const keys = envelopeKeys(source);

  const fields = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+:/.test(line))
    .map((line) => line.split(':')[0]);

  return {
    file,
    keys,
    fields,
    camelCase: attribute.includes('rename_all = "camelCase"'),
  };
}

describe('native JSON contracts', () => {
  it('finds the native sources to inspect', () => {
    expect(walk(DIAGNOSTICS_DIR).length).toBeGreaterThan(5);
  });

  it('binds the update envelope to the camelCase key the script writes', () => {
    const updates = readFileSync(join(DIAGNOSTICS_DIR, 'updates.rs'), 'utf8');

    expect(updates).toContain('installedUpdates=@($updates)');
    expect(updates).toMatch(
      /#\[serde\(rename_all = "camelCase"\)\]\s*\nstruct RawEnvelope/,
    );
  });

  it('never expands a property that can be empty into an object', () => {
    const offenders: string[] = [];

    for (const file of walk('src-tauri/src')) {
      const source = withoutComments(productionSource(readFileSync(file, 'utf8')));
      for (const match of source.matchAll(
        /Select-Object -First 1 -ExpandProperty/g,
      )) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }

    expect(
      offenders,
      'Select-Object -First 1 -ExpandProperty writes an empty object in Windows PowerShell 5.1 when nothing is found.',
    ).toEqual([]);
  });

  it('collects the debugger sources into an array before reading one', () => {
    const bsod = readFileSync(join(DIAGNOSTICS_DIR, 'bsod.rs'), 'utf8');

    expect(bsod).toContain('$debuggerSources=@(');
    expect(bsod).toContain('$debugger=[string]$debuggerSources[0]');
  });

  it('reads an optional string leniently so a shape change cannot fail a triage', () => {
    const json = readFileSync(join(DIAGNOSTICS_DIR, 'json.rs'), 'utf8');

    expect(json).toContain('pub fn optional_string');
    expect(json).toContain('serde_json::Value::String(text)');
  });

  it('keeps every envelope key and its Rust field aligned', () => {
    const envelopes = walk(DIAGNOSTICS_DIR)
      .map((file) => readEnvelopes(file))
      .filter((envelope): envelope is Envelope => envelope !== null);

    expect(envelopes.length).toBeGreaterThan(5);

    for (const envelope of envelopes) {
      expect(envelope.keys.length, `${envelope.file} writes no envelope`).toBeGreaterThan(0);

      for (const key of envelope.keys) {
        // A camelCase envelope reads the key the script wrote, so the Rust
        // field is the snake_case spelling of that key.
        const expected = envelope.camelCase ? snakeCase(key) : key;
        expect(
          envelope.fields,
          `${envelope.file} writes the key "${key}" but its envelope has no "${expected}" field`,
        ).toContain(expected);
      }
    }
  });
});
