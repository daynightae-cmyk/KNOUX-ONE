import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Anti-Cheating Verification', () => {
  const readAllFiles = (dir: string, fileList: string[] = []): string[] => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const stat = fs.statSync(path.join(dir, file));
      if (stat.isDirectory() && !file.includes('node_modules') && !file.includes('dist') && !file.includes('tests')) {
        readAllFiles(path.join(dir, file), fileList);
      } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.rs') || file.endsWith('.json'))) {
        fileList.push(path.join(dir, file));
      }
    }
    return fileList;
  };

  const allFiles = [...readAllFiles(path.resolve('./src')), ...readAllFiles(path.resolve('./src-tauri')), ...readAllFiles(path.resolve('./public'))];

  it('should not contain fake mock variables in production code', () => {
    let mockDataImports = 0;
    let healthScoreMock = 0;
    let zeroVulnsMock = 0;
    let wingetVersionMock = 0;
    let staticChartMock = 0;
    let setTimeoutMock = 0;
    let desktopElevatedMock = 0;
    let nightShaMock = 0;
    let dayShaMock = 0;
    let fixedRustTimestamp = 0;
    let staticWindows11Pro = 0;
    let staticTpmTrue = 0;
    let staticSecureBootTrue = 0;

    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf8');
      
      if (file.includes('antiCheating.test.ts')) continue;
      if (file.includes('mockSystemData.ts')) continue;
      
      if (content.includes('import {') && content.includes('mockSystemData')) mockDataImports++;
      if (content.includes('healthScore: 92')) healthScoreMock++;
      if (content.includes('0 Vulnerabilities')) zeroVulnsMock++;
      if (content.includes('Winget v1.8')) wingetVersionMock++;
      if (content.includes('[20, 25, 18, 30, 45, 28, 22, 35')) staticChartMock++;
      if (content.includes('setTimeout') && (file.includes('Context') || file.includes('View'))) setTimeoutMock++;
      if (content.includes('setRuntimeMode("desktop_elevated")')) desktopElevatedMock++;
      if (content.includes('night_sha_verified')) nightShaMock++;
      if (content.includes('day_sha_verified')) dayShaMock++;
      if (content.includes('2026-07-24T12:00:00Z')) fixedRustTimestamp++;
      if (content.includes('"Windows 11 Pro".into()')) staticWindows11Pro++;
      if (content.includes('tpm_available: true')) staticTpmTrue++;
      if (content.includes('secure_boot_enabled: true')) staticSecureBootTrue++;
    }

    expect(mockDataImports, 'Production should not import mockSystemData').toBe(0);
    expect(healthScoreMock, 'Should not hardcode healthScore: 92').toBe(0);
    expect(zeroVulnsMock, 'Should not hardcode 0 Vulnerabilities').toBe(0);
    expect(wingetVersionMock, 'Should not hardcode Winget v1.8').toBe(0);
    expect(staticChartMock, 'Should not use static chart arrays').toBe(0);
    expect(setTimeoutMock, 'Should not use setTimeout for operations').toBe(0);
    expect(desktopElevatedMock, 'Should not use setRuntimeMode for elevation').toBe(0);
    expect(nightShaMock, 'Should not use night_sha_verified').toBe(0);
    expect(dayShaMock, 'Should not use day_sha_verified').toBe(0);
    expect(fixedRustTimestamp, 'Should not use fixed Rust timestamps').toBe(0);
    expect(staticWindows11Pro, 'Should not return static Windows 11 Pro in Rust').toBe(0);
    expect(staticTpmTrue, 'Should not return static TPM true in Rust').toBe(0);
    expect(staticSecureBootTrue, 'Should not return static Secure Boot true in Rust').toBe(0);
  });
});
