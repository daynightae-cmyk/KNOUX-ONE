import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');

const expectedHandlers = {
  'm04.storage.scan': 'm04_storage_scan',
  'm04.files.largest': 'm04_largest_files',
  'm04.folders.largest': 'm04_largest_folders',
  'm04.types.distribution': 'm04_type_distribution',
  'm04.files.old': 'm04_old_files',
  'm04.downloads.analyze': 'm04_downloads_analyze',
  'm04.appdata.analyze': 'm04_appdata_analyze',
  'm04.drives.external': 'm04_external_drives',
  'm04.space.check': 'm04_space_check',
  'm04.report.export': 'm04_report_export',
  'm04.scan.cancel': 'm04_scan_cancel',
} as const;

describe('Module 04 native command registry', () => {
  it('maps every storage handler explicitly to its Rust command', () => {
    for (const [handlerId, command] of Object.entries(expectedHandlers)) {
      expect(NATIVE_COMMANDS[handlerId as keyof typeof NATIVE_COMMANDS], handlerId).toBe(command);
      expect(main, handlerId).toContain(`storage_analyzer::commands::${command}`);
    }
  });

  it('keeps generic generated service handlers prohibited', () => {
    for (const handlerId of Object.keys(NATIVE_COMMANDS)) {
      expect(handlerId).not.toMatch(/^m\d{2}\.service\.\d+$/);
    }
  });
});
