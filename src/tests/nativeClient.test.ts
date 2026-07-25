import { describe, expect, it } from 'vitest';
import { NativeClient } from '../services/nativeClient';
import { resolveNativeCommand } from '../services/nativeCommandRegistry';

describe('typed native bridge', () => {
  it('uses a static allowlist for Module 03', () => {
    expect(resolveNativeCommand('m03.scan.exact')).toBe('m03_scan_exact');
    expect(resolveNativeCommand('m03.quarantine.manage')).toBe('m03_quarantine_manage');
    expect(resolveNativeCommand('m03.s01')).toBeNull();
    expect(resolveNativeCommand('unknown.handler')).toBeNull();
  });

  it('returns unavailable in web preview instead of simulating desktop success', async () => {
    delete (globalThis as typeof globalThis & { window?: unknown }).window;
    const result = await NativeClient.executeCapability('m03_s01', 'm03.scan.exact', {
      request: { paths: ['C:\\Data'] },
    });
    expect(result.status).toBe('unavailable');
    expect(result.errorCode).toBe('desktop_runtime_unavailable');
  });

  it('rejects unknown handlers before invocation', async () => {
    const result = await NativeClient.executeCapability('m03_s01', 'm03.s01');
    expect(result.status).toBe('unsupported');
    expect(result.errorCode).toBe('unsupported_handler');
  });
});
