import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const postFormat = fs.readFileSync(path.resolve('src/components/views/PostFormatView.tsx'), 'utf8');
const workspace = fs.readFileSync(path.resolve('src/features/setup/WindowsSetupWorkspace.tsx'), 'utf8');
const client = fs.readFileSync(path.resolve('src/features/setup/setupClient.ts'), 'utf8');
const contracts = fs.readFileSync(path.resolve('src/features/setup/setupContracts.ts'), 'utf8');

describe('Windows setup workspace integration', () => {
  it('routes post-format setup to the dedicated native workflow', () => {
    expect(postFormat).toContain('WindowsSetupWorkspace');
    expect(postFormat).not.toContain('UniversalServiceWorkspace');
  });

  it('requires verified Winget before an installation request', () => {
    expect(workspace).toContain("disabled={!runtime.available || !wingetStatus || Boolean(busy)}");
    expect(workspace).toContain("setupClient.verifyWinget()");
    expect(workspace).toContain("setupClient.install(selectedPackage)");
    expect(workspace).toContain("result.status === 'completed' || result.status === 'completed_with_warnings'");
  });

  it('uses the allowlisted queued installer and the matching discovery RAM contract', () => {
    expect(client).toContain("'m01.winget.install'");
    expect(client).toContain('{ packageId }');
    expect(contracts).toContain('totalRamGB?: number | null;');
    expect(contracts).toContain('availableRamGB?: number | null;');
    expect(contracts).not.toContain('totalRamGb?:');
    expect(workspace).toContain('hardware.totalRamGB');
    expect(workspace).not.toContain('hardware.totalRamGb');
  });
});
