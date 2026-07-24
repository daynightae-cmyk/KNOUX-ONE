/**
 * KNOUX ONE — System Data & Realistic Mock Engine
 */

import { SystemSpecs, EssentialApp, CleanupCategory, DuplicateGroup, DevToolStatus, LocalPortInfo, SupportTicket } from '../types';

export const INITIAL_SYSTEM_SPECS: SystemSpecs = {
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

export const ESSENTIAL_APPS_CATALOG: EssentialApp[] = [
  { id: 'app_google_chrome', name: 'Google Chrome', wingetId: 'Google.Chrome', publisher: 'Google LLC', category: 'browser', icon: 'Globe', recommended: true, installed: true, sizeMB: 185 },
  { id: 'app_vscode', name: 'Visual Studio Code', wingetId: 'Microsoft.VisualStudioCode', publisher: 'Microsoft Corp', category: 'developer', icon: 'Code', recommended: true, installed: true, sizeMB: 340 },
  { id: 'app_git', name: 'Git for Windows', wingetId: 'Git.Git', publisher: 'The Git Development Community', category: 'developer', icon: 'GitBranch', recommended: true, installed: true, sizeMB: 120 },
  { id: 'app_7zip', name: '7-Zip', wingetId: '7zip.7zip', publisher: 'Igor Pavlov', category: 'utility', icon: 'Archive', recommended: true, installed: true, sizeMB: 18 },
  { id: 'app_vlc', name: 'VLC Media Player', wingetId: 'VideoLAN.VLC', publisher: 'VideoLAN', category: 'media', icon: 'Film', recommended: true, installed: false, sizeMB: 140 },
  { id: 'app_discord', name: 'Discord', wingetId: 'Discord.Discord', publisher: 'Discord Inc.', category: 'communication', icon: 'MessageSquare', recommended: true, installed: false, sizeMB: 210 },
  { id: 'app_powertoys', name: 'Microsoft PowerToys', wingetId: 'Microsoft.PowerToys', publisher: 'Microsoft Corp', category: 'utility', icon: 'Sliders', recommended: true, installed: false, sizeMB: 480 },
  { id: 'app_nodejs', name: 'Node.js LTS', wingetId: 'OpenJS.NodeJS.LTS', publisher: 'OpenJS Foundation', category: 'developer', icon: 'Cpu', recommended: true, installed: true, sizeMB: 95 },
  { id: 'app_python', name: 'Python 3.11', wingetId: 'Python.Python.3.11', publisher: 'Python Software Foundation', category: 'developer', icon: 'Terminal', recommended: true, installed: true, sizeMB: 160 },
  { id: 'app_notion', name: 'Notion Desktop', wingetId: 'Notion.Notion', publisher: 'Notion Labs', category: 'utility', icon: 'FileText', recommended: false, installed: false, sizeMB: 190 },
  { id: 'app_figma', name: 'Figma Desktop', wingetId: 'Figma.Figma', publisher: 'Figma Inc', category: 'design', icon: 'Layout', recommended: false, installed: false, sizeMB: 220 },
  { id: 'app_docker', name: 'Docker Desktop', wingetId: 'Docker.DockerDesktop', publisher: 'Docker Inc', category: 'developer', icon: 'Box', recommended: false, installed: false, sizeMB: 580 }
];

export const INITIAL_CLEANUP_CATEGORIES: CleanupCategory[] = [
  {
    id: 'cat_temp',
    nameEn: 'Temporary Files',
    nameAr: 'ملفات المستخدم المؤقتة',
    descriptionEn: 'System and user temporary files (%TEMP%)',
    fileCount: 2341,
    sizeBytes: 1331439820,
    sizeFormatted: '1.24 GB',
    riskLevel: 'safe',
    selected: true,
    items: [
      { path: 'C:\\Users\\Knoux\\AppData\\Local\\Temp\\~df2394.tmp', sizeFormatted: '450 MB', modified: '2026-07-22' },
      { path: 'C:\\Users\\Knoux\\AppData\\Local\\Temp\\node_cache_d8.tmp', sizeFormatted: '380 MB', modified: '2026-07-23' },
      { path: 'C:\\Windows\\Temp\\Cab_9482.tmp', sizeFormatted: '410 MB', modified: '2026-07-20' }
    ]
  },
  {
    id: 'cat_browser',
    nameEn: 'Browser Cache',
    nameAr: 'الذاكرة المخبئية للمتصفحات',
    descriptionEn: 'Cached web files and icons from Google Chrome & Edge',
    fileCount: 1128,
    sizeBytes: 898319155,
    sizeFormatted: '856.7 MB',
    riskLevel: 'safe',
    selected: true,
    items: [
      { path: 'C:\\Users\\Knoux\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\Data', sizeFormatted: '520 MB', modified: '2026-07-23' },
      { path: 'C:\\Users\\Knoux\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache\\Data', sizeFormatted: '336 MB', modified: '2026-07-23' }
    ]
  },
  {
    id: 'cat_thumbs',
    nameEn: 'Thumbnails',
    nameAr: 'مخبأ مصغرات الصور',
    descriptionEn: 'Thumbnail cache databases (thumbcache_*.db)',
    fileCount: 3246,
    sizeBytes: 537198592,
    sizeFormatted: '512.3 MB',
    riskLevel: 'safe',
    selected: true,
    items: [
      { path: 'C:\\Users\\Knoux\\AppData\\Local\\Microsoft\\Windows\\Explorer\\thumbcache_1024.db', sizeFormatted: '310 MB', modified: '2026-07-21' }
    ]
  },
  {
    id: 'cat_dumps',
    nameEn: 'Crash Dumps',
    nameAr: 'سجلات انهيار البرامج والنظام',
    descriptionEn: 'System crash dump files (.dmp) and error reporting stores',
    fileCount: 27,
    sizeBytes: 1095216660,
    sizeFormatted: '1.02 GB',
    riskLevel: 'moderate',
    selected: true,
    items: [
      { path: 'C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive\\Memory_Dump_0720.dmp', sizeFormatted: '1.02 GB', modified: '2026-07-20' }
    ]
  },
  {
    id: 'cat_recycle',
    nameEn: 'Recycle Bin',
    nameAr: 'سلة المهملات',
    descriptionEn: 'Files sent to Recycle Bin awaiting permanent disposal',
    fileCount: 156,
    sizeBytes: 785844838,
    sizeFormatted: '732.6 MB',
    riskLevel: 'safe',
    selected: true,
    items: [
      { path: 'C:\\$Recycle.Bin\\S-1-5-21-3918\\Deleted_Draft_Video.mp4', sizeFormatted: '620 MB', modified: '2026-07-19' }
    ]
  },
  {
    id: 'cat_logs',
    nameEn: 'System & Application Logs',
    nameAr: 'سجلات البرامج والنظام القديمة',
    descriptionEn: 'Obsolete diagnostic log files older than 14 days',
    fileCount: 4312,
    sizeBytes: 308082800,
    sizeFormatted: '293.8 MB',
    riskLevel: 'safe',
    selected: true,
    items: [
      { path: 'C:\\Windows\\Logs\\CBS\\CBS.log', sizeFormatted: '180 MB', modified: '2026-07-15' }
    ]
  },
  {
    id: 'cat_downloads',
    nameEn: 'Old Downloads',
    nameAr: 'الملفات القديمة في مجلد التحميلات',
    descriptionEn: 'Downloaded setup files (.exe, .msi, .iso) older than 30 days',
    fileCount: 632,
    sizeBytes: 913833984,
    sizeFormatted: '871.5 MB',
    riskLevel: 'moderate',
    selected: true,
    items: [
      { path: 'C:\\Users\\Knoux\\Downloads\\ubuntu-22.04-desktop.iso', sizeFormatted: '871 MB', modified: '2026-06-10' }
    ]
  }
];

export const INITIAL_DUPLICATE_GROUPS: DuplicateGroup[] = [
  {
    id: 'dup_group_1',
    hash: '9f8c3a72b1049c819283e1f02a93d2e1',
    fileType: 'zip',
    fileSizeFormatted: '425.40 MB',
    fileSizeBytes: 446064230,
    items: [
      { id: 'item_1_1', path: 'D:\\Work\\Proposals\\Project_Proposal_Final.zip', modified: '2026-05-12 10:15 AM', isOriginal: true, keep: true },
      { id: 'item_1_2', path: 'D:\\Backup\\2024\\Project_Proposal_Final.zip', modified: '2026-05-12 10:16 AM', isOriginal: false, keep: false },
      { id: 'item_1_3', path: 'E:\\Archives\\Project_Proposal_Final (1).zip', modified: '2026-05-12 10:17 AM', isOriginal: false, keep: false }
    ]
  },
  {
    id: 'dup_group_2',
    hash: 'a1b2c3d4e5f60718293041526374f9d0',
    fileType: 'video',
    fileSizeFormatted: '892.12 MB',
    fileSizeBytes: 935459389,
    items: [
      { id: 'item_2_1', path: 'D:\\Media\\Videos\\Product_Demo_V2.mp4', modified: '2026-04-12 3:42 PM', isOriginal: true, keep: true },
      { id: 'item_2_2', path: 'C:\\Users\\Knoux\\Downloads\\Product_Demo_V2.mp4', modified: '2026-04-12 3:45 PM', isOriginal: false, keep: false }
    ]
  },
  {
    id: 'dup_group_3',
    hash: 'c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
    fileType: 'image',
    fileSizeFormatted: '14.22 MB',
    fileSizeBytes: 14911078,
    similarity: 95,
    items: [
      { id: 'item_3_1', path: 'D:\\Photos\\Vacation\\IMG_20240415_192430.jpg', modified: '2026-04-15 7:24 PM', isOriginal: true, keep: true, dimensions: '4000 x 3000' },
      { id: 'item_3_2', path: 'D:\\Photos\\Vacation\\IMG_20240415_192430 (1).jpg', modified: '2026-04-15 7:25 PM', isOriginal: false, keep: false, dimensions: '4000 x 3000' },
      { id: 'item_3_3', path: 'D:\\Backup\\Photos\\IMG_20240415_192430.jpg', modified: '2026-04-15 7:26 PM', isOriginal: false, keep: false, dimensions: '4000 x 3000' }
    ]
  }
];

export const DEV_TOOLS_STATUS: DevToolStatus[] = [
  { id: 'dev_git', name: 'Git', icon: 'GitBranch', version: '2.44.0', installed: true, path: 'C:\\Program Files\\Git\\cmd\\git.exe' },
  { id: 'dev_node', name: 'Node.js', icon: 'Cpu', version: '20.11.1', installed: true, path: 'C:\\Program Files\\nodejs\\node.exe' },
  { id: 'dev_pnpm', name: 'pnpm', icon: 'Box', version: '8.15.4', installed: true, path: 'C:\\Users\\Knoux\\AppData\\Roaming\\npm\\pnpm.cmd' },
  { id: 'dev_python', name: 'Python', icon: 'Terminal', version: '3.11.7', installed: true, path: 'C:\\Python311\\python.exe' },
  { id: 'dev_dotnet', name: '.NET SDK', icon: 'Layers', version: '8.0.100', installed: true, path: 'C:\\Program Files\\dotnet\\dotnet.exe' },
  { id: 'dev_java', name: 'Java JDK', icon: 'Coffee', version: '17.0.9', installed: true, path: 'C:\\Program Files\\Java\\jdk-17\\bin\\java.exe' },
  { id: 'dev_android', name: 'Android SDK', icon: 'Smartphone', version: '34.0.0', installed: true, path: 'C:\\Users\\Knoux\\AppData\\Local\\Android\\Sdk' },
  { id: 'dev_rust', name: 'Rust & Cargo', icon: 'Shield', version: '1.77.0', installed: true, path: 'C:\\Users\\Knoux\\.cargo\\bin\\cargo.exe' }
];

export const INITIAL_LOCAL_PORTS: LocalPortInfo[] = [
  { port: 3000, protocol: 'TCP', processName: 'node.exe (Vite Dev Server)', pid: 14820, status: 'In Use', address: '127.0.0.1' },
  { port: 5173, protocol: 'TCP', processName: 'node.exe (KNOUX ONE Frontend)', pid: 18944, status: 'In Use', address: '127.0.0.1' },
  { port: 5432, protocol: 'TCP', processName: 'postgres.exe (Local DB)', pid: 6108, status: 'In Use', address: 'localhost' },
  { port: 6379, protocol: 'TCP', processName: 'redis-server.exe', pid: 4892, status: 'Free', address: 'localhost' },
  { port: 8080, protocol: 'TCP', processName: 'java.exe (Spring Boot)', pid: 2104, status: 'In Use', address: '0.0.0.0' }
];

export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [
  { id: 'TK-1082', subject: 'Inquiry regarding post-format Wingset script export', category: 'General Inquiry', priority: 'low', status: 'In Progress', createdAt: '2026-07-21', lastUpdate: '2026-07-22', messagesCount: 3 },
  { id: 'TK-1079', subject: 'Verification of DISM RestoreHealth source path setting', category: 'Windows Repair', priority: 'medium', status: 'Resolved', createdAt: '2026-07-18', lastUpdate: '2026-07-19', messagesCount: 5 }
];
