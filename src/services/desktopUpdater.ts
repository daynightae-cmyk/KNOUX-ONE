import { getVersion } from '@tauri-apps/api/app';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';

export type UpdaterStage =
  | 'idle'
  | 'checking'
  | 'no-update'
  | 'available'
  | 'downloading'
  | 'verifying'
  | 'restart-required'
  | 'failed'
  | 'offline'
  | 'server-unavailable'
  | 'signature-invalid';

export interface UpdateStatus {
  stage: UpdaterStage;
  currentVersion: string;
  availableVersion?: string;
  notes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
}

type ProgressListener = (status: UpdateStatus) => void;

const webPreviewVersion = 'desktop-only';

function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && Reflect.has(window, '__TAURI_INTERNALS__');
}

function asSafeFailureStage(error: unknown): UpdaterStage {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('signature') || message.includes('minisign')) {
    return 'signature-invalid';
  }

  if (message.includes('offline') || message.includes('dns') || message.includes('network')) {
    return 'offline';
  }

  if (message.includes('endpoint') || message.includes('status') || message.includes('server')) {
    return 'server-unavailable';
  }

  return 'failed';
}

export class DesktopUpdater {
  private update: Awaited<ReturnType<typeof check>> | null = null;

  async currentVersion(): Promise<string> {
    if (!isDesktopRuntime()) {
      return webPreviewVersion;
    }

    try {
      return await getVersion();
    } catch {
      return 'unknown';
    }
  }

  async checkForUpdate(): Promise<UpdateStatus> {
    const currentVersion = await this.currentVersion();

    if (!isDesktopRuntime()) {
      return { stage: 'offline', currentVersion };
    }

    try {
      const update = await check();
      this.update = update;

      if (!update) {
        return { stage: 'no-update', currentVersion };
      }

      return {
        stage: 'available',
        currentVersion,
        availableVersion: update.version,
        notes: update.body ?? undefined,
      };
    } catch (error) {
      return { stage: asSafeFailureStage(error), currentVersion };
    }
  }

  async downloadAndInstall(onProgress: ProgressListener): Promise<UpdateStatus> {
    const currentVersion = await this.currentVersion();

    if (!this.update) {
      return { stage: 'failed', currentVersion };
    }

    let downloadedBytes = 0;
    let totalBytes: number | undefined;

    onProgress({
      stage: 'downloading',
      currentVersion,
      availableVersion: this.update.version,
      notes: this.update.body ?? undefined,
      downloadedBytes,
      totalBytes,
    });

    try {
      await this.update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength;
        }

        if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength;
          onProgress({
            stage: 'downloading',
            currentVersion,
            availableVersion: this.update?.version,
            notes: this.update?.body ?? undefined,
            downloadedBytes,
            totalBytes,
          });
        }

        if (event.event === 'Finished') {
          onProgress({
            stage: 'verifying',
            currentVersion,
            availableVersion: this.update?.version,
            notes: this.update?.body ?? undefined,
            downloadedBytes,
            totalBytes,
          });
        }
      });

      return {
        stage: 'restart-required',
        currentVersion,
        availableVersion: this.update.version,
        notes: this.update.body ?? undefined,
        downloadedBytes,
        totalBytes,
      };
    } catch (error) {
      return { stage: asSafeFailureStage(error), currentVersion };
    }
  }

  async restartToFinishInstall(): Promise<void> {
    if (!isDesktopRuntime()) {
      throw new Error('Restart is only available in the signed desktop application.');
    }

    await relaunch();
  }
}

export const desktopUpdater = new DesktopUpdater();
