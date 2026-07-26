import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

const workspace = fs.readFileSync(path.resolve('src/features/storage/StorageAnalyzerWorkspace.tsx'), 'utf8');
const scanner = fs.readFileSync(path.resolve('src-tauri/src/storage_analyzer/scanner.rs'), 'utf8');
const drives = fs.readFileSync(path.resolve('src-tauri/src/storage_analyzer/drives.rs'), 'utf8');
const commands = fs.readFileSync(path.resolve('src-tauri/src/storage_analyzer/commands.rs'), 'utf8');
const module04 = MODULES_CATALOG.find(module => module.id === 'm04');

describe('Module 04 honest storage analyzer', () => {
  it('publishes six implemented and four partial services', () => {
    expect(module04).toBeDefined();
    expect(Object.fromEntries(module04!.services.map(service => [service.id, service.implementationState]))).toEqual({
      m04_s01: 'implemented',
      m04_s02: 'implemented',
      m04_s03: 'implemented',
      m04_s04: 'implemented',
      m04_s05: 'partial',
      m04_s06: 'implemented',
      m04_s07: 'implemented',
      m04_s08: 'partial',
      m04_s09: 'partial',
      m04_s10: 'partial',
    });
  });

  it('contains no timer-driven or fixed storage results', () => {
    expect(workspace).not.toContain('setTimeout');
    expect(workspace).not.toContain('setInterval');
    expect(workspace).not.toContain('Math.random');
    expect(workspace).not.toMatch(/\b\d+(?:\.\d+)?\s*(?:GB|MB|TB)\b/);
  });

  it('uses real bounded filesystem traversal without following symbolic links', () => {
    expect(scanner).toContain('WalkDir::new');
    expect(scanner).toContain('follow_links(false)');
    expect(scanner).toContain('entry.metadata()');
    expect(scanner).toContain('MAX_TRACKED_DIRECTORIES');
    expect(scanner).toContain('storage_max_files_reached');
  });

  it('measures Windows drive capacity and exports only a measured snapshot', () => {
    expect(drives).toContain('GetLogicalDriveStringsW');
    expect(drives).toContain('GetDiskFreeSpaceExW');
    expect(commands).toContain('ANALYSIS_SNAPSHOTS');
    expect(commands).toContain('serde_json::to_vec_pretty(&snapshot)');
    expect(commands).not.toContain('pdf');
  });

  it('reports limitations instead of overstating them', () => {
    const oldFiles = module04!.services.find(service => service.serviceNumber === 5)!;
    const alerts = module04!.services.find(service => service.serviceNumber === 9)!;
    const report = module04!.services.find(service => service.serviceNumber === 10)!;
    expect(oldFiles.availabilityReasonEn).toContain('modification time');
    expect(alerts.availabilityReasonEn).toContain('one-time');
    expect(report.availabilityReasonEn).toContain('JSON');
    expect(report.availabilityReasonEn).toContain('PDF');
  });
});
