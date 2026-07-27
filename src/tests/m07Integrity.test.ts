import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const native = fs.readFileSync(path.resolve('src-tauri/src/windows_repair/mod.rs'), 'utf8');
const workspace = fs.readFileSync(path.resolve('src/features/repair/WindowsRepairWorkspace.tsx'), 'utf8');
const view = fs.readFileSync(path.resolve('src/components/views/WindowsRepairView.tsx'), 'utf8');

const handlers = {
  'm07.sfc.manage': 'm07_sfc_manage',
  'm07.dism.check_health': 'm07_dism_check_health',
  'm07.dism.scan_health': 'm07_dism_scan_health',
  'm07.dism.restore_health': 'm07_dism_restore_health',
  'm07.update.manage': 'm07_windows_update_manage',
  'm07.cache.manage': 'm07_cache_manage',
  'm07.wmi.manage': 'm07_wmi_manage',
  'm07.installer.manage': 'm07_installer_manage',
  'm07.vss.manage': 'm07_vss_manage',
  'm07.store.manage': 'm07_store_manage',
} as const;

describe('Module 07 Windows repair completion gate', () => {
  it('publishes ten implemented services and keeps global totals honest', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm07');
    expect(module).toBeDefined();
    expect(module!.services).toHaveLength(10);
    expect(module!.services.every(service => service.status === 'available')).toBe(true);
    expect(module!.services.every(service => service.implementationState === 'implemented')).toBe(true);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(70);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(120);
  });

  it('maps every service to one explicit registered Rust command', () => {
    for (const [handler, command] of Object.entries(handlers)) {
      expect(NATIVE_COMMANDS[handler as keyof typeof NATIVE_COMMANDS], handler).toBe(command);
      expect(main, command).toContain(`windows_repair::${command}`);
      expect(native, command).toContain(`pub fn ${command}`);
    }
  });

  it('uses official Windows tools and preserves original command evidence', () => {
    expect(native).toContain('sfc.exe');
    expect(native).toContain('/verifyonly');
    expect(native).toContain('/scannow');
    expect(native).toContain('dism.exe');
    expect(native).toContain('/CheckHealth');
    expect(native).toContain('/ScanHealth');
    expect(native).toContain('/RestoreHealth');
    expect(native).toContain('winmgmt.exe');
    expect(native).toContain('/salvagerepository');
    expect(native).toContain('msiexec.exe');
    expect(native).toContain('vssadmin.exe');
    expect(native).toContain('wsreset.exe');
    expect(native).toContain('Microsoft.WindowsStore');
    expect(native).toContain('AppxManifest.xml');
  });

  it('blocks unsafe repair shortcuts and journals reversible update resets', () => {
    expect(native).not.toContain('vec!["/resetrepository"]');
    expect(native).not.toContain('Step::new("regsvr32');
    expect(native).not.toContain('Remove-Item -Recurse');
    expect(native).toContain('SoftwareDistribution.knoux-');
    expect(native).toContain('catroot2.knoux-');
    expect(native).toContain('windows-update-backups.json');
    expect(native).toContain('RESTORE WINDOWS UPDATE');
    expect(native).toContain('REBUILD ICON CACHE');
    expect(native).toContain('Only allowlisted IconCache.db');
  });

  it('uses a dedicated clear user-facing workspace without fake results', () => {
    expect(view).toContain('WindowsRepairWorkspace');
    expect(view).not.toContain('UniversalServiceWorkspace');
    expect(workspace).toContain('فحص ملفات ويندوز');
    expect(workspace).toContain('إصلاح تحديثات ويندوز');
    expect(workspace).toContain('إصلاح متجر مايكروسوفت');
    expect(workspace).toContain('RUN SFC REPAIR');
    expect(workspace).toContain('RESET WINDOWS UPDATE');
    expect(workspace).not.toContain('setTimeout');
    expect(workspace).not.toContain('Math.random');
    expect(native).not.toContain('Math.random');
    expect(native).not.toContain('setTimeout');
  });
});
