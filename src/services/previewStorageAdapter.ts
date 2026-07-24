/**
 * KNOUX ONE — Web Preview Storage Adapter
 * Temporary browser LocalStorage adapter for the web preview.
 * This is NOT the production SQLite database used by the Tauri desktop runtime.
 */

import { ActionLog } from '../types';

export interface SetupProfile {
  id: string;
  name: string;
  description: string;
  type: 'built_in' | 'custom';
  selectedPackages: {
    packageId: string;
    source: string;
  }[];
  preferences: {
    theme?: 'dark' | 'light' | 'system';
    language?: 'ar' | 'en';
    createRestorePointBeforeRun: boolean;
    stopQueueOnFailure: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface QueueItem {
  id: string;
  profileId?: string;
  packageId: string;
  packageName: string;
  source: string;
  requestedVersion?: string;
  status: 'queued' | 'validating' | 'downloading' | 'installing' | 'completed' | 'completed_with_warnings' | 'failed' | 'cancelled' | 'skipped' | 'awaiting_restart' | 'interrupted';
  attemptCount: number;
  exitCode?: number;
  stdoutLogPath?: string;
  stderrLogPath?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const STORAGE_KEYS = {
  PROFILES: 'knoux_one_setup_profiles_v1',
  QUEUE: 'knoux_one_install_queue_v1',
  PREFERENCES: 'knoux_one_app_prefs_v1',
  OPERATION_LOGS: 'knoux_one_operation_logs_v1',
};

export class LocalStorageService {
  /**
   * Setup Profiles Persistence
   */
  static getSetupProfiles(): SetupProfile[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('[LocalStorage] Error reading setup profiles:', e);
    }
    return this.getDefaultProfiles();
  }

  static saveSetupProfiles(profiles: SetupProfile[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(profiles));
    } catch (e) {
      console.warn('[LocalStorage] Error saving setup profiles:', e);
    }
  }

  static saveProfile(profile: SetupProfile): void {
    const profiles = this.getSetupProfiles();
    const idx = profiles.findIndex(p => p.id === profile.id);
    if (idx >= 0) {
      profiles[idx] = { ...profile, updatedAt: new Date().toISOString() };
    } else {
      profiles.push({ ...profile, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveSetupProfiles(profiles);
  }

  static deleteProfile(id: string): void {
    const profiles = this.getSetupProfiles().filter(p => p.id !== id && p.type !== 'built_in');
    this.saveSetupProfiles(profiles);
  }

  /**
   * Installation Queue Persistence
   */
  static getInstallationQueue(): QueueItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('[LocalStorage] Error reading installation queue:', e);
    }
    return [];
  }

  static saveInstallationQueue(queue: QueueItem[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn('[LocalStorage] Error saving installation queue:', e);
    }
  }

  static enqueuePackage(packageId: string, packageName: string, source: string = 'winget'): QueueItem {
    const queue = this.getInstallationQueue();
    const existing = queue.find(q => q.packageId === packageId && q.status !== 'completed');
    if (existing) return existing;

    const newItem: QueueItem = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      packageId,
      packageName,
      source,
      status: 'queued',
      attemptCount: 0,
      createdAt: new Date().toISOString()
    };

    queue.push(newItem);
    this.saveInstallationQueue(queue);
    return newItem;
  }

  static updateQueueItemStatus(id: string, status: QueueItem['status'], exitCode?: number): void {
    const queue = this.getInstallationQueue();
    const item = queue.find(q => q.id === id);
    if (item) {
      item.status = status;
      if (exitCode !== undefined) item.exitCode = exitCode;
      if (status === 'installing' && !item.startedAt) item.startedAt = new Date().toISOString();
      if (['completed', 'completed_with_warnings', 'failed', 'cancelled'].includes(status)) {
        item.completedAt = new Date().toISOString();
      }
      this.saveInstallationQueue(queue);
    }
  }

  static clearCompletedQueue(): void {
    const queue = this.getInstallationQueue().filter(q => !['completed', 'completed_with_warnings', 'cancelled'].includes(q.status));
    this.saveInstallationQueue(queue);
  }

  /**
   * Operation Logs Persistence
   */
  static getOperationLogs(): ActionLog[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OPERATION_LOGS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('[LocalStorage] Error reading operation logs:', e);
    }
    return [];
  }

  static addOperationLog(log: ActionLog): void {
    const logs = this.getOperationLogs();
    logs.unshift(log);
    try {
      localStorage.setItem(STORAGE_KEYS.OPERATION_LOGS, JSON.stringify(logs.slice(0, 100)));
    } catch (e) {
      console.warn('[LocalStorage] Error adding operation log:', e);
    }
  }

  /**
   * Default Built-in Setup Profiles
   */
  private static getDefaultProfiles(): SetupProfile[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'p_developer',
        name: 'Developer Workstation',
        description: 'Visual Studio Code, Git, Node.js LTS, Windows Terminal, PowerToys, 7-Zip.',
        type: 'built_in',
        selectedPackages: [
          { packageId: 'Microsoft.VisualStudioCode', source: 'winget' },
          { packageId: 'Git.Git', source: 'winget' },
          { packageId: 'OpenJS.NodeJS.LTS', source: 'winget' },
          { packageId: 'Microsoft.WindowsTerminal', source: 'winget' },
          { packageId: 'Microsoft.PowerToys', source: 'winget' },
          { packageId: '7zip.7zip', source: 'winget' }
        ],
        preferences: { createRestorePointBeforeRun: true, stopQueueOnFailure: false },
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'p_minimal',
        name: 'Minimal Utilities',
        description: 'Google Chrome, 7-Zip, VLC Media Player.',
        type: 'built_in',
        selectedPackages: [
          { packageId: 'Google.Chrome', source: 'winget' },
          { packageId: '7zip.7zip', source: 'winget' },
          { packageId: 'VideoLAN.VLC', source: 'winget' }
        ],
        preferences: { createRestorePointBeforeRun: true, stopQueueOnFailure: false },
        createdAt: now,
        updatedAt: now
      }
    ];
  }
}
