import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const completionHandlers = new Set(['m03.scan.images', 'm03.scan.videos', 'm03.scan.audio', 'm03.scan.archives']);

describe('native command registry', () => {
  it('registers every Module 03, Module 07, and Module 15 command in Tauri', () => {
    for (const [handlerId, command] of Object.entries(NATIVE_COMMANDS)) {
      if (handlerId.startsWith('m03.')) {
        expect(main, handlerId).toContain(`${completionHandlers.has(handlerId) ? 'completion14::m03' : 'duplicates'}::${command}`);
      }
      if (handlerId.startsWith('m07.')) expect(main, handlerId).toContain(`windows_repair::${command}`);
      if (handlerId.startsWith('m15.')) expect(main, handlerId).toContain(`developer::${command}`);
    }
  });

  /**
   * Module 16 previously had no native module; the generic project stubs were
   * removed, and the module now lives in the dedicated `projects` engine. This
   * test is bidirectional: every registered m16 handler must be wired under
   * `projects::` in main.rs, and main.rs must not invoke any `projects::` command
   * that the registry does not know about.
   */
  it('registers every Module 16 command through the dedicated projects module', () => {
    const registered = new Map(
      Object.entries(NATIVE_COMMANDS).filter(([handler]) => handler.startsWith('m16.')),
    );
    expect(registered.size, 'the Module 16 engine exposes exactly ten commands').toBe(10);
    for (const [handlerId, command] of registered) {
      expect(main, handlerId).toContain(`projects::${command}`);
    }
    const wired = new Set([...main.matchAll(/projects::(m16_[a-z_]+)/g)].map(match => match[1]));
    for (const command of wired) {
      expect([...registered.values()], `main.rs wires ${command} without a registry entry`).toContain(command);
    }
  });
});
