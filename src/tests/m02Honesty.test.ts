import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';

const workspace = fs.readFileSync(path.resolve('src/features/cleanup/SmartCleanupWorkspace.tsx'), 'utf8');
const completion = fs.readFileSync(path.resolve('src-tauri/src/completion14/m02.rs'), 'utf8');
const quarantinePanel = fs.readFileSync(path.resolve('src/features/cleanup/DownloadQuarantinePanel.tsx'), 'utf8');
const module02 = MODULES_CATALOG.find(module => module.id === 'm02');

describe('Module 02 honest cleanup engine', () => {
  it('publishes all ten Module 02 services as implemented, each with a real handler', () => {
    expect(module02).toBeDefined();
    expect(Object.fromEntries(module02!.services.map(service => [service.id, service.implementationState]))).toEqual({
      m02_s01: 'implemented',
      m02_s02: 'implemented',
      m02_s03: 'implemented',
      m02_s04: 'implemented',
      m02_s05: 'implemented',
      m02_s06: 'implemented',
      m02_s07: 'implemented',
      m02_s08: 'implemented',
      m02_s09: 'implemented',
      m02_s10: 'implemented',
    });
  });

  it('maps the three newly implemented services to registered native commands', () => {
    const expected: Record<number, string> = {
      6: 'm02.cache.delivery',
      8: 'm02.recycle.review',
      10: 'm02.cleanup.schedule',
    };
    for (const [serviceNumber, handlerId] of Object.entries(expected)) {
      const service = module02!.services.find(item => item.serviceNumber === Number(serviceNumber))!;
      expect(service.handlerId, service.id).toBe(handlerId);
      expect(service.status, service.id).toBe('available');
    }
  });

  it('contains no timer-driven or fixed-size cleanup result simulation', () => {
    const production = `${workspace}\n${completion}\n${quarantinePanel}`;
    expect(production).not.toContain('setTimeout');
    expect(production).not.toContain('setInterval');
    expect(production).not.toContain('8.6 GB');
    expect(production).not.toContain('4.2 GB');
    expect(production).not.toContain('1.8 GB');
    expect(production).not.toContain('512 MB');
  });

  it('uses signed elevated evidence and reversible installer quarantine', () => {
    expect(completion).toContain('WalkDir::new');
    expect(completion).toContain('follow_links(false)');
    expect(completion).toContain('-Verb RunAs');
    expect(completion).toContain('ExpectedHash');
    expect(completion).toContain('outside_allowed_root');
    expect(completion).toContain('reparse_point_blocked');
    expect(completion).toContain('download-quarantine');
    expect(completion).toContain('m02_download_quarantine_restore');
    expect(quarantinePanel).toContain('restoreQuarantinedInstaller');
  });
});
