import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');

const expectedHandlers = {
  'm02.cleanup.scan': ['m02_cleanup_scan_complete', 'completion14'],
  'm02.cleanup.execute': ['m02_cleanup_execute_complete', 'completion14'],
  'm02.cleanup.cancel': ['m02_cleanup_cancel_complete', 'completion14'],
  'm02.cleanup.history': ['m02_cleanup_history_complete', 'completion14'],
  'm02.scan.user_temp': ['m02_scan_user_temp', 'cleanup::commands'],
  'm02.scan.windows_temp': ['m02_scan_windows_temp_complete', 'completion14'],
  'm02.scan.browser_cache': ['m02_scan_browser_cache', 'cleanup::commands'],
  'm02.scan.thumbnail_cache': ['m02_scan_thumbnail_cache', 'cleanup::commands'],
  'm02.scan.crash_dumps': ['m02_scan_crash_dumps_complete', 'completion14'],
  'm02.scan.application_logs': ['m02_scan_application_logs_complete', 'completion14'],
  'm02.scan.old_downloads': ['m02_scan_old_downloads_complete', 'completion14'],
} as const;

describe('Module 02 native command registry', () => {
  it('uses only explicit cleanup handler mappings', () => {
    for (const [handlerId, [command, namespace]] of Object.entries(expectedHandlers)) {
      expect(NATIVE_COMMANDS[handlerId as keyof typeof NATIVE_COMMANDS], handlerId).toBe(command);
      expect(main, handlerId).toContain(`${namespace}::${command}`);
    }
  });

  it('does not introduce generated generic service handlers', () => {
    for (const handlerId of Object.keys(NATIVE_COMMANDS)) expect(handlerId).not.toMatch(/^m\d{2}\.service\.\d+$/);
  });
});
