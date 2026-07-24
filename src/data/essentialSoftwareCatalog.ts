/**
 * KNOUX ONE — Essential Software Catalog
 * Validated Winget package IDs and metadata for Module 01
 */

export interface EssentialSoftwareItem {
  id: string;
  packageId: string;
  name: string;
  publisher: string;
  category: 'browsers' | 'utilities' | 'communication' | 'media' | 'developer' | 'design';
  descriptionEn: string;
  descriptionAr: string;
  officialUrl?: string;
  source: string;
  installedState: 'installed' | 'not_installed' | 'unknown' | 'outdated';
  installedVersion?: string;
  availableVersion?: string;
  selected: boolean;
  recommended: boolean;
  requiresAdmin?: boolean;
}

export const ESSENTIAL_SOFTWARE_CATALOG: EssentialSoftwareItem[] = [
  // Browsers
  {
    id: 'sw_chrome',
    packageId: 'Google.Chrome',
    name: 'Google Chrome',
    publisher: 'Google LLC',
    category: 'browsers',
    descriptionEn: 'Fast, secure, and customizable web browser built by Google.',
    descriptionAr: 'متصفح الإنترنت السريع والآمن من جوجل.',
    officialUrl: 'https://www.google.com/chrome/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: true
  },
  {
    id: 'sw_firefox',
    packageId: 'Mozilla.Firefox',
    name: 'Mozilla Firefox',
    publisher: 'Mozilla Foundation',
    category: 'browsers',
    descriptionEn: 'Independent, privacy-focused open-source web browser.',
    descriptionAr: 'متصفح حر مفتوح المصدر يركز على خصوصية المستخدم.',
    officialUrl: 'https://www.mozilla.org/firefox/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_brave',
    packageId: 'Brave.Brave',
    name: 'Brave Browser',
    publisher: 'Brave Software',
    category: 'browsers',
    descriptionEn: 'Privacy-focused browser with built-in ad and tracker blocking.',
    descriptionAr: 'متصفح ذكي يحجب الإعلانات والمتتبعات تلقائياً.',
    officialUrl: 'https://brave.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: false
  },

  // Utilities
  {
    id: 'sw_7zip',
    packageId: '7zip.7zip',
    name: '7-Zip',
    publisher: 'Igor Pavlov',
    category: 'utilities',
    descriptionEn: 'High-compression open-source file archiver.',
    descriptionAr: 'أداة ضغط وفك ضغط الملفات بضغطة عالية وبدون رسوم.',
    officialUrl: 'https://www.7-zip.org/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_powertoys',
    packageId: 'Microsoft.PowerToys',
    name: 'Microsoft PowerToys',
    publisher: 'Microsoft Corporation',
    category: 'utilities',
    descriptionEn: 'System utilities for power users to tune and streamline Windows.',
    descriptionAr: 'مجموعة أدوات احترافية من مايكروسوفت لتسهيل العمل على ويندوز.',
    officialUrl: 'https://github.com/microsoft/PowerToys',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_everything',
    packageId: 'voidtools.Everything',
    name: 'Everything Search',
    publisher: 'voidtools',
    category: 'utilities',
    descriptionEn: 'Instant desktop search engine for Windows file paths and names.',
    descriptionAr: 'محرك بحث فوري خارق للملفات والمجلدات على الأقراص.',
    officialUrl: 'https://www.voidtools.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: true
  },
  {
    id: 'sw_notepadplusplus',
    packageId: 'Notepad++.Notepad++',
    name: 'Notepad++',
    publisher: 'Don Ho',
    category: 'utilities',
    descriptionEn: 'Lightweight text editor and source code editor.',
    descriptionAr: 'محرر نصوص سريع وخفيف يدعم لغات البرمجة المتعددة.',
    officialUrl: 'https://notepad-plus-plus.org/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: false
  },

  // Communication
  {
    id: 'sw_telegram',
    packageId: 'Telegram.TelegramDesktop',
    name: 'Telegram Desktop',
    publisher: 'Telegram FZ-LLC',
    category: 'communication',
    descriptionEn: 'Fast and secure desktop messaging app synced across devices.',
    descriptionAr: 'تطبيق التراسل السريع والآمن للكمبيوتر.',
    officialUrl: 'https://desktop.telegram.org/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_whatsapp',
    packageId: 'WhatsApp.WhatsApp',
    name: 'WhatsApp Desktop',
    publisher: 'Meta Platforms, Inc.',
    category: 'communication',
    descriptionEn: 'Official WhatsApp desktop client for chats and calling.',
    descriptionAr: 'تطبيق واتساب الرسمي للمحادثات والمكالمات على الكمبيوتر.',
    officialUrl: 'https://www.whatsapp.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_discord',
    packageId: 'Discord.Discord',
    name: 'Discord',
    publisher: 'Discord Inc.',
    category: 'communication',
    descriptionEn: 'Voice, video, and text communication platform for communities.',
    descriptionAr: 'منصة التواصل الصوتي والتكست للمجتمعات والمطورين.',
    officialUrl: 'https://discord.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: false
  },

  // Media
  {
    id: 'sw_vlc',
    packageId: 'VideoLAN.VLC',
    name: 'VLC Media Player',
    publisher: 'VideoLAN',
    category: 'media',
    descriptionEn: 'Free and open-source cross-platform multimedia player.',
    descriptionAr: 'مشغل الفيديو والصوت الشهير الداعم لكافة الصيغ.',
    officialUrl: 'https://www.videolan.org/vlc/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_spotify',
    packageId: 'Spotify.Spotify',
    name: 'Spotify',
    publisher: 'Spotify AB',
    category: 'media',
    descriptionEn: 'Digital music and podcast streaming service.',
    descriptionAr: 'تطبيق البث الموسيقي والبودكاست.',
    officialUrl: 'https://www.spotify.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: false
  },

  // Developer
  {
    id: 'sw_vscode',
    packageId: 'Microsoft.VisualStudioCode',
    name: 'Visual Studio Code',
    publisher: 'Microsoft Corporation',
    category: 'developer',
    descriptionEn: 'Streamlined code editor with support for debugging and Git.',
    descriptionAr: 'محرر البرمجة الأشهر مع دعم الملحقات وGit.',
    officialUrl: 'https://code.visualstudio.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },
  {
    id: 'sw_git',
    packageId: 'Git.Git',
    name: 'Git for Windows',
    publisher: 'The Git Development Team',
    category: 'developer',
    descriptionEn: 'Distributed version control system for source code management.',
    descriptionAr: 'نظام تتبع وإدارة إصدارات المشاريع البرمجية.',
    officialUrl: 'https://git-scm.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: true
  },
  {
    id: 'sw_nodejs',
    packageId: 'OpenJS.NodeJS.LTS',
    name: 'Node.js LTS',
    publisher: 'OpenJS Foundation',
    category: 'developer',
    descriptionEn: 'JavaScript runtime built on Chrome V8 engine.',
    descriptionAr: 'بيئة تشغيل لغة جافاسكريبت المعتمدة للمطورين.',
    officialUrl: 'https://nodejs.org/',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: true
  },
  {
    id: 'sw_python',
    packageId: 'Python.Python.3.12',
    name: 'Python 3.12',
    publisher: 'Python Software Foundation',
    category: 'developer',
    descriptionEn: 'Versatile programming language engine for AI, scripts, and automation.',
    descriptionAr: 'محرك لغة بايثون للذكاء الاصطناعي والأتمتة البرمجية.',
    officialUrl: 'https://www.python.org/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: true
  },
  {
    id: 'sw_terminal',
    packageId: 'Microsoft.WindowsTerminal',
    name: 'Windows Terminal',
    publisher: 'Microsoft Corporation',
    category: 'developer',
    descriptionEn: 'Modern, fast, and powerful terminal application for Windows.',
    descriptionAr: 'منصة موجه الأوامر المتطورة والحديثة لويندوز.',
    officialUrl: 'https://aka.ms/terminal',
    source: 'winget',
    installedState: 'not_installed',
    selected: true,
    recommended: true,
    requiresAdmin: false
  },

  // Design
  {
    id: 'sw_figma',
    packageId: 'Figma.Figma',
    name: 'Figma Desktop',
    publisher: 'Figma, Inc.',
    category: 'design',
    descriptionEn: 'Collaborative interface design tool desktop app.',
    descriptionAr: 'تطبيق الكمبيوتر لتصميم واجهات المستخدم والرسومات.',
    officialUrl: 'https://www.figma.com/',
    source: 'winget',
    installedState: 'not_installed',
    selected: false,
    recommended: false,
    requiresAdmin: false
  }
];
