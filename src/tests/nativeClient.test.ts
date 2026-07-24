import { describe, it, expect } from 'vitest';
import { NativeClient } from '../services/nativeClient';

describe('NativeClient Execution & Fallback Bridge', () => {
  it('detects Tauri availability correctly in node test runner (should be false)', () => {
    expect(NativeClient.isTauriAvailable()).toBe(false);
  });

  it('handles web fallback execution for m01_s01 without throwing', async () => {
    const result = await NativeClient.executeModule01Capability('m01_s01', 'm01.system.discover');
    expect(result).toBeDefined();
    expect(result.capabilityId).toBe('m01_s01');
    expect(result.handlerId).toBe('m01.system.discover');
    expect(result.status).toBe('unavailable');
    expect(result.summaryEn).toContain('Desktop runtime unavailable');
  });

  it('rejects execution gracefully when invalid handler is requested', async () => {
    const result = await NativeClient.executeModule01Capability('m01_s01', 'invalid.handler.id');
    expect(result.status).toBe('unavailable');
    expect(result.summaryEn).toContain('Desktop runtime unavailable');
  });
});
