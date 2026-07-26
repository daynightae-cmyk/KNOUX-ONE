import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const completionHandlers = new Set(['m03.scan.images', 'm03.scan.videos', 'm03.scan.audio', 'm03.scan.archives']);

describe('native command registry', () => {
  it('registers every Module 03 and Module 15 command in Tauri', () => {
    for (const [handlerId, command] of Object.entries(NATIVE_COMMANDS)) {
      if (handlerId.startsWith('m03.')) {
        expect(main, handlerId).toContain(`${completionHandlers.has(handlerId) ? 'completion14::m03' : 'duplicates'}::${command}`);
      }
      if (handlerId.startsWith('m15.')) expect(main, handlerId).toContain(`developer::${command}`);
    }
  });

  it('does not register removed Module 07 and Module 16 stubs', () => {
    expect(main).not.toContain('windows_repair::');
    expect(main).not.toContain('projects::');
  });
});
