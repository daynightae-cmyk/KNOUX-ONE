import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');

describe('Module 03 command registry', () => {
  it('registers every Module 03 catalog command in Tauri', () => {
    for (const [handlerId, command] of Object.entries(NATIVE_COMMANDS)) {
      if (!handlerId.startsWith('m03.')) continue;
      expect(main, handlerId).toContain(`duplicates::${command}`);
    }
  });

  it('does not register removed Module 07 and Module 15/16 stubs', () => {
    expect(main).not.toContain('windows_repair::');
    expect(main).not.toContain('developer::');
    expect(main).not.toContain('projects::');
  });
});
