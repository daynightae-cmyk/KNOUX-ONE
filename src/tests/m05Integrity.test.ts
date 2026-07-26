import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const native = fs.readFileSync(path.resolve('src-tauri/src/startup_services/mod.rs'), 'utf8');
const workspace = fs.readFileSync(path.resolve('src/features/startup/StartupServicesWorkspace.tsx'), 'utf8');

const handlers = {
  'm05.registry.inspect': 'm05_registry_entries',
  'm05.folders.inspect': 'm05_startup_folders',
  'm05.tasks.inspect': 'm05_scheduled_tasks',
  'm05.services.inspect': 'm05_windows_services',
  'm05.impact.assess': 'm05_impact_assess',
  'm05.recommendations.generate': 'm05_recommendations',
  'm05.delay.manage': 'm05_delay_manage',
  'm05.profiles.manage': 'm05_profiles_manage',
  'm05.restore.manage': 'm05_restore_manage',
  'm05.boot.history': 'm05_boot_history',
} as const;

describe('Module 05 startup and services completion gate', () => {
  it('publishes exactly ten implemented Module 05 services and keeps other totals honest', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm05');
    expect(module).toBeDefined();
    expect(module!.services).toHaveLength(10);
    expect(module!.services.every(service => service.implementationState === 'implemented')).toBe(true);
    expect(module!.services.every(service => service.status === 'available')).toBe(true);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(50);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(140);
  });

  it('maps every catalog service to an explicit registered Rust command', () => {
    for (const [handler, command] of Object.entries(handlers)) {
      expect(NATIVE_COMMANDS[handler as keyof typeof NATIVE_COMMANDS], handler).toBe(command);
      expect(main, command).toContain(`startup_services::${command}`);
      expect(native, command).toContain(`pub fn ${command}`);
    }
    expect(NATIVE_COMMANDS['m05.startup.change']).toBe('m05_startup_change');
    expect(main).toContain('startup_services::m05_startup_change');
  });

  it('uses real Windows evidence and reversible safety controls', () => {
    expect(native).toContain('HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run');
    expect(native).toContain('Get-ScheduledTask');
    expect(native).toContain('Get-CimInstance Win32_Service');
    expect(native).toContain('Microsoft-Windows-Diagnostics-Performance/Operational');
    expect(native).toContain('Get-AuthenticodeSignature');
    expect(native).toContain('changes.json');
    expect(native).toContain('profiles.json');
    expect(native).toContain('DISABLE {}');
    expect(native).toContain('APPLY PROFILE');
    expect(native).toContain('DELETE PROFILE');
    expect(native).toContain('startup_item_is_protected_or_requires_administrator');
  });

  it('uses a dedicated user-facing workspace without fake host results', () => {
    expect(workspace).not.toContain('UniversalServiceWorkspace');
    expect(workspace).toContain('StartupServicesWorkspace');
    expect(workspace).toContain('Disable safely');
    expect(workspace).toContain('Delay start');
    expect(workspace).toContain('Create a startup profile');
    expect(workspace).not.toContain('setTimeout');
    expect(workspace).not.toContain('Math.random');
    expect(native).not.toContain('setTimeout');
    expect(native).not.toContain('Math.random');
  });
});
