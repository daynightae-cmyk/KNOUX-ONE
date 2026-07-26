import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');

const expectedHandlers = {
  'm04.storage.scan': ['m04_storage_scan_complete', 'completion14'],
  'm04.files.largest': ['m04_largest_files', 'storage_analyzer::commands'],
  'm04.folders.largest': ['m04_largest_folders', 'storage_analyzer::commands'],
  'm04.types.distribution': ['m04_type_distribution', 'storage_analyzer::commands'],
  'm04.files.old': ['m04_old_files_complete', 'completion14'],
  'm04.downloads.analyze': ['m04_downloads_complete', 'completion14'],
  'm04.appdata.analyze': ['m04_appdata_complete', 'completion14'],
  'm04.drives.external': ['m04_external_drives_complete', 'completion14'],
  'm04.space.check': ['m04_space_check_complete', 'completion14'],
  'm04.report.export': ['m04_report_export_complete', 'completion14'],
  'm04.scan.cancel': ['m04_scan_cancel_complete', 'completion14'],
} as const;

describe('Module 04 native command registry', () => {
  it('maps every storage handler explicitly to its Rust command', () => {
    for (const [handlerId, [command, namespace]] of Object.entries(expectedHandlers)) {
      expect(NATIVE_COMMANDS[handlerId as keyof typeof NATIVE_COMMANDS], handlerId).toBe(command);
      expect(main, handlerId).toContain(`${namespace}::${command}`);
    }
  });

  it('keeps generic generated service handlers prohibited', () => {
    for (const handlerId of Object.keys(NATIVE_COMMANDS)) expect(handlerId).not.toMatch(/^m\d{2}\.service\.\d+$/);
  });
});
