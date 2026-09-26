import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const root = path.resolve('.');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

/**
 * Strips the `#[cfg(test)]` module so the anti-pattern scans below judge production code
 * only. The Rust unit tests legitimately contain the very literals they forbid, and a
 * gate that cannot distinguish the two is a gate that gets deleted.
 */
const productionOnly = (source: string): string => {
  const marker = source.indexOf('#[cfg(test)]');
  return marker === -1 ? source : source.slice(0, marker);
};

const main = read('src-tauri/src/main.rs');
const mod = read('src-tauri/src/completion14/mod.rs');
const m01Planned = read('src-tauri/src/completion14/m01_planned.rs');
const m02Planned = read('src-tauri/src/completion14/m02_planned.rs');
const m09Planned = read('src-tauri/src/completion14/m09_planned.rs');
const m10Planned = read('src-tauri/src/completion14/m10_planned.rs');
const m11Planned = read('src-tauri/src/completion14/m11_planned.rs');
const m02 = read('src-tauri/src/completion14/m02.rs');
const psbridge = read('src-tauri/src/completion14/psbridge.rs');
const catalog = read('resources/essential-software.json');

/**
 * The seven services this gate covers. Each entry is a real native command, not a UI
 * affordance: a planned service that cannot be executed must stay `planned` in the
 * catalog, and a service that claims to be implemented must be reachable.
 */
const plannedBatch = [
  { capability: 'm01_s03', service: 3, module: 'm01', handler: 'm01.winget.repair', command: 'm01_winget_repair_guide', modulePath: 'completion14::m01_planned' },
  { capability: 'm01_s04', service: 4, module: 'm01', handler: 'm01.catalog.essential', command: 'm01_essential_catalog', modulePath: 'completion14::m01_planned' },
  { capability: 'm01_s07', service: 7, module: 'm01', handler: 'm01.apps.inventory.export', command: 'm01_installed_app_inventory_export', modulePath: 'completion14::m01_planned' },
  { capability: 'm01_s08', service: 8, module: 'm01', handler: 'm01.profiles.postformat.create', command: 'm01_post_format_profile_create', modulePath: 'completion14::m01_planned' },
  { capability: 'm02_s06', service: 6, module: 'm02', handler: 'm02.cache.delivery', command: 'm02_delivery_cache', modulePath: 'completion14::m02_planned' },
  { capability: 'm02_s08', service: 8, module: 'm02', handler: 'm02.recycle.review', command: 'm02_recycle_bin_review', modulePath: 'completion14::m02_planned' },
  { capability: 'm02_s10', service: 10, module: 'm02', handler: 'm02.cleanup.schedule', command: 'm02_cleanup_schedule', modulePath: 'completion14::m02_planned' },
] as const;

describe('planned-batch implementation gate', () => {
  it('maps every planned-batch service to a command that main.rs really registers', () => {
    for (const entry of plannedBatch) {
      expect(NATIVE_COMMANDS[entry.handler as keyof typeof NATIVE_COMMANDS], entry.handler).toBe(entry.command);
      expect(main, entry.command).toContain(`${entry.modulePath}::${entry.command}`);
      // The command must be declared as a Tauri command, not merely referenced.
      const body = productionOnly(entry.modulePath.endsWith('m01_planned') ? m01Planned : m02Planned);
      expect(body, entry.command).toMatch(new RegExp(`fn ${entry.command}\\(`));
      expect(body, entry.command).toContain('#[tauri::command]');
    }
  });

  it('declares the batch as implemented only where a real handler now exists', () => {
    for (const entry of plannedBatch) {
      const module = MODULES_CATALOG.find(item => item.id === entry.module);
      const service = module?.services.find(item => item.serviceNumber === entry.service);
      expect(service, entry.capability).toBeDefined();
      expect(service?.id, entry.capability).toBe(entry.capability);
      expect(service?.implementationState, entry.capability).toBe('implemented');
      expect(service?.status, entry.capability).toBe('available');
      expect(service?.handlerId, entry.capability).toBe(entry.handler);
    }
  });

  it('exports the modules the batch needs and removed the placeholder batch files', () => {
    expect(mod).toContain('pub mod m01_planned;');
    expect(mod).toContain('pub mod m02_planned;');
    expect(mod).toContain('pub mod psbridge;');
    expect(mod).not.toContain('planned_batch');
    for (const removed of ['planned_batch1', 'planned_batch2', 'planned_batch3', 'planned_batch4']) {
      expect(fs.existsSync(path.join(root, 'src-tauri/src/completion14', `${removed}.rs`)), removed).toBe(false);
    }
    expect(fs.existsSync(path.join(root, 'src/types/plannedBatch1.ts'))).toBe(false);
  });

  it('ships the recommendation catalog as a real auditable resource', () => {
    const parsed = JSON.parse(catalog) as {
      schemaVersion: number;
      catalogId: string;
      catalogRevision: string;
      items: Array<{ id: string; category: string; packageId: string; match: { displayNameContains: string[] } }>;
    };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.catalogId).toBe('knoux-essential-software');
    expect(parsed.catalogRevision).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    expect(parsed.items.length).toBeGreaterThanOrEqual(20);
    const ids = parsed.items.map(item => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of parsed.items) {
      expect(['essential', 'security', 'development']).toContain(item.category);
      expect(item.packageId.length).toBeGreaterThan(0);
      expect(item.match.displayNameContains.length).toBeGreaterThan(0);
    }
    // The catalog is embedded at compile time, so a missing file is a build error
    // rather than a runtime surprise.
    expect(m01Planned).toContain('include_str!("../../../resources/essential-software.json")');
  });

  it('keeps guidance honest: no repair is claimed and no command is executed', () => {
    // M01-S03 is "repair guidance". The command must be able to say it executed nothing.
    expect(m01Planned).toContain('mutating_actions_performed: 0');
    expect(m01Planned).toContain('executed_any_command: false');
    expect(m01Planned).toContain('Guidance only.');
    // Steps must carry the measurement that produced them.
    expect(m01Planned).toContain('pub evidence: String');
  });
  it('keeps the read-only services read-only in code, not only in prose', () => {
    expect(m02Planned).toContain('pub deleted_anything: bool');
    expect(m02Planned).toContain('deleted_anything: false');
    expect(m02Planned).toContain('pub emptied_anything: bool');
    expect(m02Planned).toContain('emptied_anything: false');
    expect(m02Planned).toContain('pub read_only_warning: bool');
    // Delivery Optimization and the Recycle Bin are measured with bounded walks and
    // the shell namespace; neither script may delete.
    const production = productionOnly(m02Planned);
    for (const forbidden of ['Remove-Item', 'Clear-RecycleBin', 'cmd /c', 'Invoke-Expression', 'Start-Process']) {
      expect(production, forbidden).not.toContain(forbidden);
    }
  });

  it('never builds a shell command out of measured or user text', () => {
    // Every PowerShell body in the batch is a literal constant, and the only
    // interpolated value anywhere is a package identifier the operator supplied,
    // single-quoted and escaped before it reaches the script.
    for (const source of [m01Planned, m02Planned, psbridge].map(productionOnly)) {
      for (const forbidden of ['Invoke-Expression', 'iex ', 'Invoke-Command', 'Start-Process', 'cmd.exe', 'cmd /c']) {
        expect(source, forbidden).not.toContain(forbidden);
      }
    }
    expect(productionOnly(m01Planned)).toContain("id.replace('\\'', \"''\")");
    expect(m01Planned).toContain('MAX_PACKAGE_CHECKS');
    expect(m01Planned).toContain('MAX_INVENTORY_ITEMS');
    expect(m02Planned).toContain('MAX_CACHE_DEPTH');
    expect(m02Planned).toContain('MAX_RECYCLE_ITEMS');
  });

  it('reuses the audited cleanup deletion path instead of adding a second one', () => {
    // M02-S10 must delegate to the existing execute command. A second deletion
    // implementation is exactly how an allowlist quietly stops being an allowlist.
    expect(m02Planned).toContain('m02::m02_cleanup_execute_complete');
    expect(m02Planned).toContain('m02::m02_cleanup_scan_complete');
    expect(m02Planned).toContain('m02::targets(&request.targets)');
    // The shared allowlist must be reachable, not duplicated.
    expect(m02).toContain('pub(crate) fn targets(');
  });

  it('keeps post-format profile steps inside a fixed allowlist', () => {
    const start = m01Planned.indexOf('const ALLOWED_PROFILE_STEPS');
    const end = m01Planned.indexOf('];', start);
    const block = m01Planned.slice(start, end);
    for (const handler of ['m01.system.discover', 'm02.cleanup.scan', 'm07.update.manage', 'm08.dns.flush']) {
      expect(block, handler).toContain(`"${handler}"`);
    }
    // A step carries a handler and its registered command, never a command line.
    expect(m01Planned).toContain('native_command: (*native_command).to_string()');
    expect(m02Planned).toContain('const APPLY_CONFIRMATION: &str = "APPLY"');
  });

/**
 * The M10 slice. These five are read-only inspections, so the gate is that nothing in
 * the module can change state and that every provider is reported rather than assumed.
 */
const securityBatch = [
  { capability: 'm10_s01', service: 1, module: 'm10', handler: 'm10.defender.status', command: 'm10_defender_status' },
  { capability: 'm10_s05', service: 5, module: 'm10', handler: 'm10.firewall.status', command: 'm10_firewall_status' },
  { capability: 'm10_s06', service: 6, module: 'm10', handler: 'm10.uac.status', command: 'm10_uac_status' },
  { capability: 'm10_s07', service: 7, module: 'm10', handler: 'm10.smartscreen.status', command: 'm10_smartscreen_status' },
  { capability: 'm10_s08', service: 8, module: 'm10', handler: 'm10.secureboot.tpm', command: 'm10_secureboot_tpm_status' },
] as const;

describe('M10 security status gate', () => {
  it('maps every M10 status service to a command that main.rs really registers', () => {
    const production = productionOnly(m10Planned);
    for (const entry of securityBatch) {
      expect(NATIVE_COMMANDS[entry.handler as keyof typeof NATIVE_COMMANDS], entry.handler).toBe(entry.command);
      expect(main, entry.command).toContain(`completion14::m10_planned::${entry.command}`);
      expect(production, entry.command).toMatch(new RegExp(`fn ${entry.command}\\(`));
    }
    expect(mod).toContain('pub mod m10_planned;');
  });

  it('marks only the five read-only services implemented and leaves the scans planned', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm10');
    expect(module).toBeDefined();
    for (const entry of securityBatch) {
      const service = module?.services.find(item => item.serviceNumber === entry.service);
      expect(service, entry.capability).toBeDefined();
      expect(service?.implementationState, entry.capability).toBe('implemented');
      expect(service?.status, entry.capability).toBe('available');
      expect(service?.handlerId, entry.capability).toBe(entry.handler);
    }
    // S02/S03/S04 start real scans on the user's machine. Until one has actually run,
    // they must stay roadmap items with no handler.
    for (const serviceNumber of [2, 3, 4, 9, 10]) {
      const service = module?.services.find(item => item.serviceNumber === serviceNumber);
      expect(service?.implementationState, `m10_s${String(serviceNumber).padStart(2, '0')}`).toBe('planned');
      expect(service?.handlerId, `m10_s${String(serviceNumber).padStart(2, '0')}`).toBeUndefined();
    }
  });

  it('cannot change any security state from the M10 module', () => {
    const production = productionOnly(m10Planned);
    // No scan is started, no policy written, no rule toggled, no elevation requested.
    // `EnableSmartScreen` is deliberately absent from this list: it is a registry value
    // name this module *reads*, and forbidding a read target would forbid the evidence.
    for (const forbidden of [
      'Start-MpScan',
      'Set-MpPreference',
      'Remove-MpPreference',
      'Add-MpPreference',
      'Set-NetFirewallProfile',
      'New-NetFirewallRule',
      'Set-NetFirewallRule',
      'Remove-NetFirewallRule',
      'Set-ItemProperty',
      'New-ItemProperty',
      'Remove-ItemProperty',
      'Set-Item -Path',
      'reg add',
      'reg delete',
      'Start-Process -Verb RunAs',
    ]) {
      expect(production, forbidden).not.toContain(forbidden);
    }
    // No mutating cmdlet of any shape. `New-Object ... List[object]` is a .NET
    // collection constructor, not a state change, so it is carved out before the match
    // rather than the assertion being weakened.
    const withoutCollectionConstructors = production.replace(
      /New-Object System\.Collections\.Generic\.List\[object\]/g,
      'CollectionList',
    );
    expect(withoutCollectionConstructors).not.toMatch(/\b(Set|New|Remove|Add|Start|Stop|Enable|Disable)-\w+/);
    // The payloads say so in fields, not only in prose.
    expect(production).toContain('pub changed_any_setting: bool');
    expect(production).toContain('changed_any_setting: false');
    expect(production).toContain('pub changed_any_rule: bool');
    expect(production).toContain('changed_any_rule: false');
    expect(production).toContain('pub changed_any_value: bool');
    expect(production).toContain('changed_any_value: false');
    expect(production).toContain('pub elevation_performed: bool');
    expect(production).toContain('elevation_performed: false');
    expect(production).toContain('pub scan_started: bool');
    expect(production).toContain('scan_started: false');
  });

  it('reports a silent provider as silent and an unreadable policy as unknown', () => {
    const production = productionOnly(m10Planned);
    expect(production).toContain('pub struct SourceReport');
    expect(production).toContain('pub available: bool');
    // SmartScreen must be able to say "unknown" instead of defaulting to on.
    expect(production).toContain('effective_enforcement');
    expect(production).toContain('"unknown: no SmartScreen policy value was readable');
    // A missing TPM is unmeasured, not absent.
    expect(production).toContain('reported as unmeasured rather than absent');
    // Secure Boot off is a value, not an error path.
    expect(production).toContain('secure_boot_state: String');
    expect(production).toContain("'off'");
  });

  it('never builds a shell command out of measured or user text in the M10 module', () => {
    const production = productionOnly(m10Planned);
    for (const forbidden of ['Invoke-Expression', 'iex ', 'Invoke-Command', 'Start-Process', 'cmd.exe', 'cmd /c']) {
      expect(production, forbidden).not.toContain(forbidden);
    }
  });

  it('does not fabricate operating-system results in the M10 module', () => {
    const production = productionOnly(m10Planned);
    expect(production).not.toContain('Math.random');
    expect(production).not.toContain('setTimeout');
    expect(production).not.toMatch(/\b8\.6 GB\b/);
    expect(production).not.toContain('mockDefender');
    expect(production).not.toContain('SAMPLE_PROFILES');
  });
});
  it('does not fabricate operating-system results in the batch engines', () => {
    const production = [m01Planned, m02Planned, m10Planned, psbridge].map(productionOnly).join('\n');
    expect(production).not.toContain('Math.random');
    expect(production).not.toContain('setTimeout');
    expect(production).not.toMatch(/\b8\.6 GB\b/);
    expect(production).not.toMatch(/\b4\.2 GB\b/);
    expect(production).not.toContain('mockApps');
    expect(production).not.toContain('SAMPLE_APPS');
    expect(production).not.toContain('C:\\Users\\User');
  });
});

/**
 * The M09 slice. Seven services, one of which (S06) can clear the clipboard, so the gate
 * is that the destructive path is unreachable without the literal token and that the
 * three consent services read one store rather than three.
 */
const privacyBatch = [
  { capability: 'm09_s01', service: 1, handler: 'm09.permission.dashboard', command: 'm09_permission_dashboard' },
  { capability: 'm09_s02', service: 2, handler: 'm09.permission.camera', command: 'm09_camera_permission' },
  { capability: 'm09_s03', service: 3, handler: 'm09.permission.microphone', command: 'm09_microphone_permission' },
  { capability: 'm09_s04', service: 4, handler: 'm09.permission.location', command: 'm09_location_permission' },
  { capability: 'm09_s05', service: 5, handler: 'm09.advertising.id', command: 'm09_advertising_id' },
  { capability: 'm09_s06', service: 6, handler: 'm09.clipboard.privacy', command: 'm09_clipboard_privacy' },
  { capability: 'm09_s09', service: 9, handler: 'm09.hosts.inspect', command: 'm09_hosts_file' },
] as const;

describe('M09 privacy gate', () => {
  it('maps every M09 service to a command that main.rs really registers', () => {
    const production = productionOnly(m09Planned);
    for (const entry of privacyBatch) {
      expect(NATIVE_COMMANDS[entry.handler as keyof typeof NATIVE_COMMANDS], entry.handler).toBe(entry.command);
      expect(main, entry.command).toContain(`completion14::m09_planned::${entry.command}`);
      expect(production, entry.command).toMatch(new RegExp(`fn ${entry.command}\\(`));
    }
    expect(mod).toContain('pub mod m09_planned;');
  });

  it('marks the seven measured services implemented and leaves the destructive ones planned', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm09');
    expect(module).toBeDefined();
    for (const entry of privacyBatch) {
      const service = module?.services.find(item => item.serviceNumber === entry.service);
      expect(service, entry.capability).toBeDefined();
      expect(service?.implementationState, entry.capability).toBe('implemented');
      expect(service?.handlerId, entry.capability).toBe(entry.handler);
    }
    // S07 recent-file cleanup, S08 browser privacy cleanup and S10 reversible profiles
    // all delete or rewrite user data. None has been run by a human yet, so none of them
    // may look runnable.
    for (const serviceNumber of [7, 8, 10]) {
      const service = module?.services.find(item => item.serviceNumber === serviceNumber);
      expect(service?.implementationState, `m09_s${String(serviceNumber).padStart(2, '0')}`).toBe('planned');
      expect(service?.handlerId, `m09_s${String(serviceNumber).padStart(2, '0')}`).toBeUndefined();
    }
  });

  it('reads one consent store for all three permission services', () => {
    const production = productionOnly(m09Planned);
    // One script, one parser, four commands. Four parsers would be four chances to
    // disagree with each other and with the dashboard.
    expect(production.match(/const PERMISSION_SCRIPT/g) ?? []).toHaveLength(1);
    expect(production).toContain('fn permission_command(');
    expect(production).toContain('fn project_capabilities(');
    for (const handler of ['m09.permission.dashboard', 'm09.permission.camera', 'm09.permission.microphone', 'm09.permission.location']) {
      expect(production, handler).toContain(handler);
    }
  });

  it('keeps the clipboard destructive path behind a literal token', () => {
    const production = productionOnly(m09Planned);
    expect(production).toContain('const CLIPBOARD_CONFIRMATION: &str = "CLEAR"');
    expect(production).toContain('let wants_clear = request.confirmation == CLIPBOARD_CONFIRMATION');
    // The clipboard is not described unless the request opts in.
    expect(production).toContain('if !request.inspect_current_clipboard');
    expect(production).toContain('"not_inspected"');
    // The client must not opt in by default.
    const client = read('src/features/privacy/privacyClient.ts');
    expect(client).toContain('options.inspectCurrentClipboard ?? false');
  });

  it('never writes a privacy setting and never modifies the hosts file', () => {
    const production = productionOnly(m09Planned);
    for (const forbidden of [
      'Set-ItemProperty',
      'New-ItemProperty',
      'Remove-ItemProperty',
      'Clear-ItemProperty',
      'reg add',
      'reg delete',
      'std::fs::write',
      'File::create',
    ]) {
      expect(production, forbidden).not.toContain(forbidden);
    }
    // `Set-Clipboard` is the one mutation this module performs, and it is the whole
    // point of M09-S06. It is allowed exactly once, inside the clear script, and only
    // behind the literal confirmation token. Every other mutating cmdlet shape is out.
    const occurrences = production.split('Set-Clipboard').length - 1;
    expect(occurrences, 'Set-Clipboard must appear exactly once').toBe(1);
    const withoutTheAllowedOne = production
      .replace('Set-Clipboard', 'SetClipboardAllowedOnce')
      .replace(/New-Object System\.Collections\.Generic\.List\[object\]/g, 'CollectionList');
    expect(withoutTheAllowedOne).not.toMatch(/\b(Set|New|Remove|Add|Start|Stop|Enable|Disable)-\w+/);

    expect(production).toContain('pub changed_any_permission: bool');
    expect(production).toContain('changed_any_permission: false');
    expect(production).toContain('pub changed_any_value: bool');
    expect(production).toContain('changed_any_value: false');
    expect(production).toContain('pub file_modified: bool');
    expect(production).toContain('file_modified: false');
  });

  it('reports an unmeasured surface as unmeasured rather than clean', () => {
    const production = productionOnly(m09Planned);
    // A FILETIME of zero means never used, not a date in 1601.
    expect(production).toContain('fn filetime_to_rfc3339');
    expect(production).toContain('if ticks == 0');
    // A hosts file that cannot be read is not an empty hosts file.
    expect(production).toContain('hosts_read_failed');
    expect(production).toContain('hosts_file_not_utf8');
    // An absent advertising Enabled value is unmeasured, not off.
    expect(production).toContain('pub enabled: Option<bool>');
    // An empty consent store is refused rather than reported as tidy.
    expect(production).toContain('capability_consent_store_empty');
  });

  it('does not fabricate results in the M09 module', () => {
    const production = productionOnly(m09Planned);
    expect(production).not.toContain('Math.random');
    expect(production).not.toContain('setTimeout');
    expect(production).not.toContain('mockPermission');
    expect(production).not.toContain('C:\\Users\\User');
  });
});

/**
 * The M11 slice. These services write files, so the gate is that nothing is reported as
 * backed up before the bytes have been read back, and that no source is overwritten.
 */
const backupBatch = [
  { capability: 'm11_s03', service: 3, handler: 'm11.settings.export', command: 'm11_settings_export' },
  { capability: 'm11_s05', service: 5, handler: 'm11.environment.export', command: 'm11_environment_export' },
  { capability: 'm11_s06', service: 6, handler: 'm11.bookmarks.backup', command: 'm11_bookmark_backup' },
  { capability: 'm11_s07', service: 7, handler: 'm11.registry.backup', command: 'm11_registry_key_backup' },
  { capability: 'm11_s09', service: 9, handler: 'm11.restore.inventory', command: 'm11_restore_inventory' },
] as const;

describe('M11 verified backup gate', () => {
  it('maps every M11 service to a command that main.rs really registers', () => {
    const production = productionOnly(m11Planned);
    for (const entry of backupBatch) {
      expect(NATIVE_COMMANDS[entry.handler as keyof typeof NATIVE_COMMANDS], entry.handler).toBe(entry.command);
      expect(main, entry.command).toContain(`completion14::m11_planned::${entry.command}`);
      expect(production, entry.command).toMatch(new RegExp(`fn ${entry.command}\\(`));
    }
    expect(mod).toContain('pub mod m11_planned;');
  });

  it('marks the five export services implemented and leaves the rest planned', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm11');
    expect(module).toBeDefined();
    for (const entry of backupBatch) {
      const service = module?.services.find(item => item.serviceNumber === entry.service);
      expect(service?.implementationState, entry.capability).toBe('implemented');
      expect(service?.handlerId, entry.capability).toBe(entry.handler);
    }
    // S01 restore point and S04 driver export need elevation nobody has exercised here.
    // S02 copies user data at volume and S10 would register a scheduled task.
    for (const serviceNumber of [1, 2, 4, 8, 10]) {
      const service = module?.services.find(item => item.serviceNumber === serviceNumber);
      expect(service?.implementationState, `m11_s${String(serviceNumber).padStart(2, '0')}`).toBe('planned');
      expect(service?.handlerId, `m11_s${String(serviceNumber).padStart(2, '0')}`).toBeUndefined();
    }
  });

  it('cannot report a backup before the bytes have been read back', () => {
    const production = productionOnly(m11Planned);
    expect(production).toContain('fn write_verified(');
    // The digest of the written file is compared against the digest of the source bytes.
    expect(production).toContain('let verified = error.is_none() && actual == expected;');
    expect(production).toContain('pub read_back_verified: bool');
    expect(production).toContain('pub everything_verified: bool');
    // An empty run must not read as a good backup.
    expect(production).toContain('self.everything_verified = self.files_failed == 0 && !self.files.is_empty();');
    expect(production).toContain('An empty backup is reported as empty');
  });

  it('never overwrites an earlier run and never writes into a source', () => {
    const production = productionOnly(m11Planned);
    // Every run gets its own timestamped directory.
    expect(production).toContain('let run_id = format!("{prefix}-{}", stamp());');
    expect(production).toContain('fs::create_dir_all(&directory)');
    // A browser profile is read and never written; the payload says so in a field.
    expect(production).toContain('pub wrote_into_any_browser_profile: bool');
    expect(production).toContain('wrote_into_any_browser_profile: false');
    expect(production).not.toMatch(/fs::write\(&?(bookmarks|profile_dir|profile\b)/);
    // No destructive file operation and no registry write.
    for (const forbidden of [
      'fs::remove_file',
      'fs::remove_dir_all',
      'Set-ItemProperty',
      'New-ItemProperty',
      'Remove-ItemProperty',
      'reg delete',
    ]) {
      expect(production, forbidden).not.toContain(forbidden);
    }
  });

  it('reports PATH in the order Windows searches it, not one scope alone', () => {
    const production = productionOnly(m11Planned);
    expect(production).toContain('A user PATH does not replace the machine PATH on Windows');
    expect(production).toContain('duplicated_path_entries');
    expect(production).toContain('pub effective_value: String');
  });

  it('discovers browsers from real directories rather than a hard-coded list', () => {
    const production = productionOnly(m11Planned);
    expect(production).toContain('fn bookmark_candidates()');
    expect(production).toContain('fn chromium_profile_names(');
    expect(production).toContain('Local State');
    // A Bookmarks file must validate as JSON before it is called a backup.
    expect(production).toContain('bookmarks_file_is_not_json');
    // Firefox is copied as a complete SQLite set, not a lone file.
    expect(production).toContain('"-wal"');
    expect(production).toContain('"-shm"');
  });

  it('emits a portable manifest so a backup can be verified elsewhere', () => {
    const production = productionOnly(m11Planned);
    // The path separator is normalised, so the digest does not depend on the OS.
    expect(production).toContain('.join("/")');
    expect(production).toContain('sort_by(|left, right| left.0.cmp(&right.0))');
    expect(production).toContain('schemaVersion');
  });

  it('cannot take a registry backup from a caller-supplied key', () => {
    const production = productionOnly(m11Planned);
    // The allowlist is a compile-time constant, so a caller cannot widen what is read.
    expect(production).toContain('const ALLOWED_REGISTRY_KEYS: &[(&str, &str, &str)]');
    // The command signature takes no key argument at all.
    const signature = production.slice(
      production.indexOf('pub async fn m11_registry_key_backup('),
      production.indexOf(') -> Result<OperationResult<RegistryBackup>', production.indexOf('pub async fn m11_registry_key_backup(')),
    );
    // "key" here is only part of the service name, never a parameter.
    expect(signature.replace('m11_registry_key_backup', '')).not.toMatch(/key/i);
    // Keys are only ever taken by iterating the constant.
    expect(production).toContain('for (key, export_name, description) in ALLOWED_REGISTRY_KEYS {');
    // `reg export` reads a key and writes a file. The result says so explicitly, and the
    // write flag is a hard-coded false so a future edit cannot quietly flip it.
    expect(production).toContain('pub wrote_to_any_registry_key: bool');
    expect(production).toContain('wrote_to_any_registry_key: false');
    // No import of a key and no registry write, in any casing.
    for (const forbidden of ['reg import', 'reg.exe import', 'reg add', 'reg.exe add', 'reg delete', 'reg.exe delete']) {
      expect(production, forbidden).not.toContain(forbidden);
    }
  });

  it('does not call a reg.exe exit code of zero a verified registry backup', () => {
    const production = productionOnly(m11Planned);
    // A zero exit code is necessary but not sufficient: the written file is hashed, read
    // back, and re-parsed for key and value headers.
    expect(production).toContain('fn count_reg_headers(content: &str) -> (usize, usize)');
    expect(production).toContain('pub key_header_count: usize');
    expect(production).toContain('pub value_header_count: usize');
    expect(production).toContain('pub read_back_verified: bool');
    expect(production).toContain('pub everything_verified: bool');
    // A .reg file with no key header is not a usable export, so the pass condition
    // requires a key header rather than only a matching digest.
    expect(production).toContain('key_headers > 0');
    // A missing or refused key is reported as absent with a reason, not as a silent
    // success and not as a fatal failure of the whole run.
    expect(production).toContain('pub exists: bool');
    expect(production).toContain('pub keys_absent: usize');
    expect(production).toContain('fn record_absent(');
    expect(production).toContain('reg_export_failed:');
    expect(production).toContain('reg_launch_failed:');
  });

  it('cannot call a restore run verified on a digest it never recorded', () => {
    const production = productionOnly(m11Planned);
    // A file with no recorded digest is a baseline, never a pass.
    expect(production).toContain('pub baseline_only: bool');
    expect(production).toContain('pub files_baseline_only: usize');
    // The pass rule needs every file to match a digest the run itself recorded, and needs
    // a non-empty file list so an empty run is not vacuously "verified".
    expect(production).toContain('run_verified: files_checked > 0 && files_matching == files_checked');
    // A run is verified only against its own manifest, never against a sibling run.
    expect(production).toContain('fn recorded_digests(directory: &Path) -> BTreeMap<String, String>');
    expect(production).toContain('fn inspect_run(run_directory: &Path) -> RestoreRunCheck');
    // Altered and missing are counted apart from merely unmatched, so a run cannot hide
    // a deleted file inside a "still matches some files" number.
    expect(production).toContain('pub files_altered: usize');
    expect(production).toContain('pub files_missing: usize');
    expect(production).toContain('pub runs_with_missing_or_altered_files: usize');
    expect(production).toContain('pub nothing_deleted: bool');
    expect(production).toContain('nothing_deleted: true');
  });

  it('never lets a restore inventory delete or restore anything', () => {
    const production = productionOnly(m11Planned);
    // Scope the check to the inventory command itself: the same module also contains the
    // write path used by the export services, and that path is what writes backups.
    const start = production.indexOf('pub async fn m11_restore_inventory(');
    expect(start).toBeGreaterThan(-1);
    const body = production.slice(start, production.indexOf('\n#[tauri::command]', start + 1) === -1
      ? production.length
      : production.indexOf('\n#[tauri::command]', start + 1));
    for (const forbidden of [
      'fs::remove_file',
      'fs::remove_dir_all',
      'fs::rename',
      'fs::copy',
      'fs::write',
      'fs::create_dir_all',
      'reg import',
      'robocopy',
      'Command::new',
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it('does not fabricate results in the M11 module', () => {
    const production = productionOnly(m11Planned);
    expect(production).not.toContain('Math.random');
    expect(production).not.toContain('setTimeout');
    expect(production).not.toContain('mockBackup');
    expect(production).not.toContain('C:\\Users\\User');
  });
});
