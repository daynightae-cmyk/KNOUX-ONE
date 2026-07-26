import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

const workspace = fs.readFileSync(path.resolve('src/features/cleanup/SmartCleanupWorkspace.tsx'), 'utf8');
const scanner = fs.readFileSync(path.resolve('src-tauri/src/cleanup/scanner.rs'), 'utf8');
const cleaner = fs.readFileSync(path.resolve('src-tauri/src/cleanup/cleaner.rs'), 'utf8');

const module02 = MODULES_CATALOG.find(module => module.id === 'm02');

describe('Module 02 honest cleanup engine', () => {
  it('publishes only verified Module 02 states', () => {
    expect(module02).toBeDefined();
    expect(Object.fromEntries(module02!.services.map(service => [service.id, service.implementationState]))).toEqual({
      m02_s01: 'implemented',
      m02_s02: 'partial',
      m02_s03: 'implemented',
      m02_s04: 'implemented',
      m02_s05: 'partial',
      m02_s06: 'planned',
      m02_s07: 'partial',
      m02_s08: 'planned',
      m02_s09: 'partial',
      m02_s10: 'planned',
    });
  });

  it('keeps planned cleanup services non-executable', () => {
    for (const serviceNumber of [6, 8, 10]) {
      const service = module02!.services.find(item => item.serviceNumber === serviceNumber)!;
      expect(service.handlerId, service.id).toBeUndefined();
      expect(service.status, service.id).toBe('planned');
    }
  });

  it('contains no timer-driven or fixed-size cleanup result simulation', () => {
    expect(workspace).not.toContain('setTimeout');
    expect(workspace).not.toContain('setInterval');
    expect(workspace).not.toContain('8.6 GB');
    expect(workspace).not.toContain('4.2 GB');
    expect(workspace).not.toContain('1.8 GB');
    expect(workspace).not.toContain('512 MB');
  });

  it('uses real filesystem traversal and revalidates files before deletion', () => {
    expect(scanner).toContain('WalkDir::new');
    expect(scanner).toContain('follow_links(false)');
    expect(scanner).toContain('entry.metadata()');
    expect(cleaner).toContain('snapshot_still_matches');
    expect(cleaner).toContain('path_is_within');
    expect(cleaner).toContain('fs::remove_file');
  });
});
