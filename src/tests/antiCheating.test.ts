import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function productionFiles(root: string): string[] {
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!['node_modules', 'dist', 'target', 'tests', '.git'].includes(entry.name)) visit(absolute);
      } else if (/\.(ts|tsx|rs|json)$/.test(entry.name)) {
        result.push(absolute);
      }
    }
  };
  visit(root);
  return result;
}

const files = [
  ...productionFiles(path.resolve('src')),
  ...productionFiles(path.resolve('src-tauri')),
];
const source = files.map(file => `\n// FILE: ${file}\n${fs.readFileSync(file, 'utf8')}`).join('\n');

describe('Phase 04A anti-cheating gate', () => {
  it('contains no production duplicate or developer sample facts', () => {
    for (const forbidden of [
      'mockGroups',
      'SAMPLE_DUPLICATES',
      'SAMPLE_TOOLCHAIN',
      'SAMPLE_PORTS',
      'SAMPLE_REPOS',
      'SAMPLE_BUILD_CACHES',
      'C:\\Users\\User',
      'C:\\ProgramData\\KNOUX\\Quarantine',
    ]) {
      expect(source.includes(forbidden), forbidden).toBe(false);
    }
  });

  it('contains no Module 03 empty-success native stubs', () => {
    const duplicateRust = fs.readFileSync(path.resolve('src-tauri/src/duplicates/mod.rs'), 'utf8');
    expect(duplicateRust).not.toMatch(/m03_scan_exact[\s\S]{0,500}Ok\(vec!\[\]\)/);
    expect(duplicateRust).not.toMatch(/m03_quarantine_manage[\s\S]{0,500}Ok\(true\)/);
    expect(source).not.toContain('Testing stream...');
  });

  it('does not construct native commands by replacing dots', () => {
    const nativeClient = fs.readFileSync(path.resolve('src/services/nativeClient.ts'), 'utf8');
    expect(nativeClient).not.toMatch(/handlerId\.replace/);
    expect(nativeClient).not.toMatch(/replace\(\/\\\.\/g/);
  });

  it('does not simulate duplicate operations with timers or React-only quarantine', () => {
    const store = fs.readFileSync(path.resolve('src/features/duplicates/duplicateStore.ts'), 'utf8');
    expect(store).not.toContain('setTimeout');
    expect(store).not.toContain('fake quarantine');
    expect(store).not.toContain('quarantinePath: `');
  });
});
