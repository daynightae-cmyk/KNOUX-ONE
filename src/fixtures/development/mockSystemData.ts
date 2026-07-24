/**
 * KNOUX ONE — Development & Testing Fixtures
 * Samples moved out of production bundle per security and integrity policies.
 */

import { SystemSpecs, EssentialApp, CleanupCategory, DuplicateGroup, DevToolStatus, LocalPortInfo, SupportTicket } from '../../types';

export const FIXTURE_SYSTEM_SPECS: SystemSpecs = {
  computerName: 'KNOUX-DEV-WIN11',
  processor: 'Intel Core i7-10750H @ 2.60GHz (12 CPUs)',
  cpuCores: 12,
  cpuLoadPercentage: 12,
  totalRamGB: 16,
  usedRamGB: 7.4,
  ramLoadPercentage: 46,
  osEdition: 'Windows 11 Pro',
  osVersion: '23H2',
  osBuild: '22631.3593',
  architecture: 'x64-based processor',
  uptimeHours: 62.5,
  uptimeFormatted: '2d 14h 32m',
  diskTotalGB: 512,
  diskUsedGB: 194,
  diskFreeGB: 318,
  diskHealth: 'Healthy (NVMe SSD 98% Endurance Remaining)',
  networkAdapter: 'Intel(R) Wi-Fi 6 AX201 160MHz',
  networkSpeedMbps: 8.4,
  ipAddress: '192.168.1.105',
  defenderStatus: true,
  firewallStatus: true,
  healthScore: 92
};

export const FIXTURE_ESSENTIAL_APPS: EssentialApp[] = [
  { id: 'app_google_chrome', name: 'Google Chrome', wingetId: 'Google.Chrome', publisher: 'Google LLC', category: 'browser', icon: 'Globe', recommended: true, installed: false, sizeMB: 185 },
  { id: 'app_vscode', name: 'Visual Studio Code', wingetId: 'Microsoft.VisualStudioCode', publisher: 'Microsoft Corp', category: 'developer', icon: 'Code', recommended: true, installed: false, sizeMB: 340 },
  { id: 'app_git', name: 'Git for Windows', wingetId: 'Git.Git', publisher: 'The Git Development Community', category: 'developer', icon: 'GitBranch', recommended: true, installed: false, sizeMB: 120 },
  { id: 'app_7zip', name: '7-Zip', wingetId: '7zip.7zip', publisher: 'Igor Pavlov', category: 'utility', icon: 'Archive', recommended: true, installed: false, sizeMB: 18 }
];
