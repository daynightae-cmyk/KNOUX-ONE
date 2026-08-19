import { describe, expect, it, vi } from 'vitest';
import { DesktopUpdater } from '../services/desktopUpdater';

describe('DesktopUpdater web-runtime safety', () => {
  it('does not claim that updates can run in a web preview', async () => {
    const updater = new DesktopUpdater();

    await expect(updater.currentVersion()).resolves.toBe('desktop-only');
    await expect(updater.checkForUpdate()).resolves.toEqual({
      stage: 'offline',
      currentVersion: 'desktop-only',
    });
  });

  it('does not install or restart when no signed desktop update is available', async () => {
    const updater = new DesktopUpdater();
    const onProgress = vi.fn();

    await expect(updater.downloadAndInstall(onProgress)).resolves.toEqual({
      stage: 'failed',
      currentVersion: 'desktop-only',
    });
    expect(onProgress).not.toHaveBeenCalled();
    await expect(updater.restartToFinishInstall()).rejects.toThrow(
      'Restart is only available in the signed desktop application.',
    );
  });
});
