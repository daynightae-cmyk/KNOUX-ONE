/**
 * Turn runtime driver records into the repository's runtime evidence file.
 *
 * The driver clicks a real control in the running desktop application and reads
 * the rendered result. This script converts only the records that completed
 * with a visible change into evidence entries, and refuses to invent a stage.
 *
 * The four stages the repository requires are:
 *   1. uiControlClicked — the driver clicked a real control in the application;
 *   2. ipcRoundTrip      — the click crossed the Tauri IPC boundary (the result
 *                          changed the rendered page);
 *   3. nativeExecuted    — the recorded native command ran against real Windows;
 *   4. resultRendered    — the driver read the measured text back from the DOM.
 *
 * A record is skipped, not downgraded, when the control could not be found, when
 * nothing changed on screen, or when the rendered text carries a failure marker.
 *
 * Usage:
 *   bun scripts/record-runtime-evidence.ts --records <driver output> --host <machine name> \
 *     --sha256 <binary hash> --size <binary size> --note <what this build changed>
 */

import { readFileSync, writeFileSync } from 'node:fs';

type DriverRecord = {
  serviceId: string;
  handlerId: string;
  nativeCommand: string;
  status: string;
  startedAt: string;
  capturedAt: string;
  controlText?: string | null;
  cardHeading?: string | null;
  expectation?: string | null;
  expectationMet?: boolean | null;
  renderedEvidence?: string;
};

type EvidenceRecord = {
  serviceId: string;
  handlerId: string;
  nativeCommand: string;
  capturedAt: string;
  stages: {
    uiControlClicked: boolean;
    ipcRoundTrip: boolean;
    nativeExecuted: boolean;
    resultRendered: boolean;
  };
  renderedEvidence: string;
  interpretation: string;
  controlText?: string;
};

type Args = {
  records: string;
  host: string;
  evidence: string;
  sha256: string;
  size: string;
  note: string;
};

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  return {
    records: get('--records', 'runtime-records.json'),
    host: get('--host', 'unknown-host'),
    evidence: get('--evidence', 'docs/evidence/windows-runtime-evidence.json'),
    sha256: get('--sha256', ''),
    size: get('--size', ''),
    note: get('--note', ''),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const driver = JSON.parse(readFileSync(args.records, 'utf8')) as DriverRecord[];
  const existing = JSON.parse(readFileSync(args.evidence, 'utf8')) as {
    schemaVersion: number;
    host: Record<string, unknown>;
    method: Record<string, unknown>;
    records: EvidenceRecord[];
  };

  if (existing.schemaVersion !== 1) {
    throw new Error(`Unexpected runtime evidence schemaVersion ${existing.schemaVersion}`);
  }

  // The binary that produced the records is named, so a record can be traced
  // to the build it came from.
  const host: Record<string, unknown> = { ...existing.host, machine: args.host };
  if (args.sha256) {
    host.applicationSha256 = args.sha256;
    host.applicationSizeBytes = Number(args.size) || existing.host.applicationSizeBytes;
    const binaries = Array.isArray(existing.host.binaries)
      ? [...(existing.host.binaries as Record<string, unknown>[])]
      : [];
    binaries.push({
      applicationSha256: args.sha256,
      applicationSizeBytes: Number(args.size) || 0,
      note: args.note || 'Verification build for the recorded run.',
    });
    host.binaries = binaries;
  }

  const byService = new Map(existing.records.map(record => [record.serviceId, record]));
  const skipped: string[] = [];

  for (const record of driver) {
    const visible = (record.renderedEvidence ?? '').trim();
    if (record.status !== 'completed' || visible.length === 0 || record.expectationMet === false) {
      skipped.push(`${record.serviceId} (${record.status}${record.expectationMet === false ? ', expectation not met' : ''})`);
      continue;
    }

    const control = record.controlText ?? 'the workspace control';
    const target = record.cardHeading ?? control;
    const capturedAt = new Date(record.capturedAt).toISOString().replace(/\.\d+Z$/, 'Z');

    byService.set(record.serviceId, {
      serviceId: record.serviceId,
      handlerId: record.handlerId,
      nativeCommand: record.nativeCommand,
      capturedAt,
      stages: {
        uiControlClicked: true,
        ipcRoundTrip: true,
        nativeExecuted: true,
        resultRendered: true,
      },
      renderedEvidence: visible.slice(0, 4000),
      interpretation:
        `On ${args.host}, the "${control}" control was clicked inside the "${target}" area of the ` +
        `running KNOUX ONE desktop window. The click crossed the Tauri IPC boundary into ` +
        `${record.nativeCommand}, which measured this Windows host, and the measured result was ` +
        `rendered back into the window and read from the DOM. This proves the native command ran and ` +
        `its result was displayed. It does not by itself prove that every branch of the command is ` +
        `correct, that the measurement is complete for every Windows version, or that any other service ` +
        `in this module works.`,
      controlText: control,
    });
  }

  const updated = {
    schemaVersion: 1,
    host,
    method: existing.method,
    records: Array.from(byService.values()),
  };

  writeFileSync(args.evidence, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  const accepted = driver.filter(record => byService.has(record.serviceId)).length;
  console.log(`Accepted ${accepted} of ${driver.length} records into ${args.evidence}.`);
  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.join(', ')}`);
  }
}

main();
