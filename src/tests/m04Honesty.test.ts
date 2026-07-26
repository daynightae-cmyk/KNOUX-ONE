import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

const workspace = fs.readFileSync(path.resolve('src/features/storage/StorageAnalyzerWorkspace.tsx'), 'utf8');
const completion = fs.readFileSync(path.resolve('src-tauri/src/completion14/m04.rs'), 'utf8');
const monitor = fs.readFileSync(path.resolve('src/features/storage/StorageMonitorPanel.tsx'), 'utf8');
const module04 = MODULES_CATALOG.find(module => module.id === 'm04');

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

  it('uses bounded filesystem traversal and explicit access-time evidence', () => {
    expect(completion).toContain('WalkDir::new');
    expect(completion).toContain('follow_links(false)');
    expect(completion).toContain('accessed_at');
    expect(completion).toContain('modified_fallback');
    expect(completion).toContain('max_files_reached');
  });

  it('measures physical storage, monitors thresholds and exports PDF plus JSON', () => {
    expect(completion).toContain('Get-PhysicalDisk');
    expect(completion).toContain('Win32_LogicalDisk');
    expect(completion).toContain('m04://low-space-alert');
    expect(completion).toContain('ToastNotificationManager');
    expect(completion).toContain('%PDF-1.4');
    expect(completion).toContain('json_evidence_path');
    expect(monitor).toContain("listen<StorageSpaceAlert>('m04://low-space-alert'");
  });
});
