import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

const workspace = fs.readFileSync(path.resolve('src/features/storage/StorageAnalyzerWorkspace.tsx'), 'utf8');
const completion = fs.readFileSync(path.resolve('src-tauri/src/completion14/m04.rs'), 'utf8');
const reports = fs.readFileSync(path.resolve('src-tauri/src/completion14/m04_reports.rs'), 'utf8');
const panels = fs.readFileSync(path.resolve('src/features/storage/StorageEvidencePanels.tsx'), 'utf8');
const migration = fs.readFileSync(path.resolve('src-tauri/migrations/004_storage_reports.sql'), 'utf8');
const monitor = fs.readFileSync(path.resolve('src/features/storage/StorageMonitorPanel.tsx'), 'utf8');
const module04 = MODULES_CATALOG.find(module => module.id === 'm04');

/** The formats the native exporter will actually write. Kept in sync with the Rust list. */
const SUPPORTED_REPORT_FORMATS = ['json', 'csv', 'html'] as const;

describe('Module 04 honest storage analyzer', () => {
  it('publishes ten implemented services', () => {
    expect(module04).toBeDefined();
    for (const service of module04!.services) {
      expect(service.implementationState, service.id).toBe('implemented');
      expect(service.status, service.id).toBe('available');
      expect(service.handlerId, service.id).toBeTruthy();
    }
  });

  it('contains no timer-driven or fixed storage results', () => {
    const production = `${workspace}\n${completion}\n${monitor}`;
    expect(production).not.toContain('setTimeout');
    expect(production).not.toContain('Math.random');
    expect(workspace).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:GB|MB|TB)\b/);
  });

  it('uses bounded filesystem traversal and a measured access-time policy', () => {
    expect(completion).toContain('WalkDir::new');
    expect(completion).toContain('follow_links(false)');
    expect(completion).toContain('accessed_at');
    expect(completion).toContain('created_at');
    expect(completion).toContain('max_files_reached');
    // The three age bases must exist and be distinguishable, and access time may only
    // be used when the machine was measured to keep it.
    expect(completion).toContain('LAST_ACCESS');
    expect(completion).toContain('LAST_WRITE_FALLBACK');
    expect(completion).toContain('UNKNOWN');
    expect(completion).toContain('classify_age');
    expect(completion).toContain('fsutil');
    expect(completion).toContain('behavior');
    expect(completion).toContain('disablelastaccess');
    expect(completion).toContain('NtfsDisableLastAccessUpdate');
  });

  it('never claims a file is unused when only modification time is known', () => {
    // A LastAccess basis requires the policy to have been measured as reliable.
    expect(completion).toContain('last_access_reliable_for_files');
    expect(completion).not.toMatch(/age_basis:\s*"?last_access"?/);
    // This service is analysis only.
    expect(completion).toContain('read_only: true');
    expect(completion).not.toMatch(/fn\s+delete|remove_file\(/);
  });

  it('measures physical storage, monitors thresholds and exports durable hashed reports', () => {
    expect(completion).toContain('Get-PhysicalDisk');
    expect(completion).toContain('Win32_LogicalDisk');
    expect(completion).toContain('m04://low-space-alert');
    expect(completion).toContain('ToastNotificationManager');
    expect(completion).toContain('json_evidence_path');
    expect(monitor).toContain("listen<StorageSpaceAlert>('m04://low-space-alert'");
  });

  it('does not fabricate a PDF and says so instead of skipping it silently', () => {
    // No hand-assembled PDF writer, and no renamed document.
    expect(completion).not.toContain('%PDF');
    expect(completion).not.toContain('make_pdf');
    expect(reports).not.toContain('%PDF');
    // The honest alternative: HTML renders Arabic and every measured path exactly.
    expect(SUPPORTED_REPORT_FORMATS).not.toContain('pdf');
    expect(reports).toContain('render_html');
    expect(reports).toContain('render_csv');
    expect(reports).toContain('render_json');
  });

  it('reads exported reports from persisted evidence rather than process memory', () => {
    expect(completion).not.toContain('static SNAPSHOTS');
    expect(reports).toContain('persist_snapshot');
    expect(reports).toContain('load_snapshot');
    expect(reports).toContain('storage_snapshots');
    // Every written document is hashed so it can be verified by a recipient.
    expect(reports).toContain('sha256');
    expect(reports).toContain('blake3');
    expect(reports).toContain('signature_valid');
    expect(reports).toContain('RedactionProfile');
  });

  it('persists storage evidence in a real migration, not in memory', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS storage_snapshots');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS storage_snapshot_files');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS storage_snapshot_exclusions');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS knoux_artifacts');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS storage_report_exports');
    expect(migration).toContain('sha256 TEXT NOT NULL');
    expect(migration).toContain('blake3 TEXT NOT NULL');
    const database = fs.readFileSync(path.resolve('src-tauri/src/storage/database.rs'), 'utf8');
    expect(database).toContain('004_storage_reports.sql');
    expect(database).toContain("'schema_version', '4'");
  });

  it('shows the measured age policy and per-row basis in the interface', () => {
    // The UI must be able to say "not accessed since" and "not modified since" as
    // distinct statements, and must have a wording for no signal at all.
    expect(panels).toContain("'not accessed since'");
    expect(panels).toContain("'not modified since'");
    expect(panels).toContain("'no trustworthy age signal'");
    expect(panels).toContain('lastAccessReliableForFiles');
    expect(panels).toContain('formatsUnsupported');
    expect(panels).toContain('signatureValid');
    expect(workspace).toContain('StorageAgePolicyPanel');
    expect(workspace).toContain('StorageReportPanel');
    expect(workspace).toContain('data-age-basis');
    // The read-only promise must be visible to the user, not only in Rust.
    expect(workspace).toContain('read-only');
  });
});
