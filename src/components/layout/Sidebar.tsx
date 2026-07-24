/**
 * KNOUX ONE — Navigation Sidebar Component
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { 
  LayoutDashboard, 
  Sparkles, 
  Download, 
  Trash2, 
  Copy, 
  PieChart, 
  Zap, 
  Gauge, 
  Wrench, 
  Wifi, 
  EyeOff, 
  ShieldCheck, 
  HardDrive, 
  Package, 
  FileCode, 
  Terminal, 
  Code2, 
  FolderGit2, 
  Activity, 
  Cpu, 
  Cloud, 
  HelpCircle, 
  Grid, 
  Globe, 
  Settings, 
  Info, 
  ChevronRight, 
  ChevronDown,
  Layers,
  Image as ImageIcon
} from 'lucide-react';

interface NavGroup {
  titleEn: string;
  titleAr: string;
  items: {
    id: string;
    route: string;
    titleEn: string;
    titleAr: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

export const Sidebar: React.FC = () => {
  const { currentRoute, setCurrentRoute, language, t } = useKnoux();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const navGroups: NavGroup[] = [
    {
      titleEn: 'Core Workspace',
      titleAr: 'المساحة الرئيسية',
      items: [
        { id: 'dashboard', route: 'dashboard', titleEn: 'Dashboard Overview', titleAr: 'لوحة التحكم', icon: LayoutDashboard },
        { id: 'first-run', route: 'first-run', titleEn: 'First-Run Setup Wizard', titleAr: 'معالج الإعداد الأول', icon: Sparkles, badge: 'Guided' },
        { id: 'post-format', route: 'post-format', titleEn: 'Post-Format Suite', titleAr: 'حزمة ما بعد الفورمات', icon: Download, badge: 'Popular' }
      ]
    },
    {
      titleEn: 'System Optimization',
      titleAr: 'تحسين وتطوير النظام',
      items: [
        { id: 'cleanup', route: 'cleanup', titleEn: 'Smart Storage Cleanup', titleAr: 'التنظيف الذكي', icon: Trash2 },
        { id: 'duplicates', route: 'duplicates', titleEn: 'Duplicate File Finder', titleAr: 'مستكشف الملفات المكررة', icon: Copy },
        { id: 'storage', route: 'storage', titleEn: 'Visual Storage Analyzer', titleAr: 'محلل القرص المباشر', icon: PieChart },
        { id: 'startup', route: 'startup', titleEn: 'Startup & Services', titleAr: 'إدارة البدء والخدمات', icon: Zap },
        { id: 'performance', route: 'performance', titleEn: 'Performance & Gaming', titleAr: 'الأداء والألعاب', icon: Gauge }
      ]
    },
    {
      titleEn: 'Security & Maintenance',
      titleAr: 'الأمان والصيانة',
      items: [
        { id: 'repair', route: 'repair', titleEn: 'Windows Repair & SFC', titleAr: 'صيانة وتصليح ويندوز', icon: Wrench },
        { id: 'network', route: 'network', titleEn: 'Network & DNS Optimizer', titleAr: 'الشبكات وذاكرة DNS', icon: Wifi },
        { id: 'privacy', route: 'privacy', titleEn: 'Privacy & Telemetry Block', titleAr: 'الخصوصية وتتبع النظام', icon: EyeOff },
        { id: 'security', route: 'security', titleEn: 'Security & Defender Rules', titleAr: 'الحماية وجدار الناري', icon: ShieldCheck },
        { id: 'backup', route: 'backup', titleEn: 'Backup & Restore Points', titleAr: 'النسخ الاحتياطي واستعادة', icon: HardDrive }
      ]
    },
    {
      titleEn: 'Developer & Power Tools',
      titleAr: 'أدوات المطورين والمتقدمين',
      items: [
        { id: 'applications', route: 'applications', titleEn: 'Software Store (Winget)', titleAr: 'متجر البرامج (Winget)', icon: Package },
        { id: 'file-tools', route: 'file-tools', titleEn: 'File Hashes & Shredder', titleAr: 'أدوات الملفات والتشفير', icon: FileCode },
        { id: 'automation', route: 'automation', titleEn: 'Automation & PowerShell', titleAr: 'الأتمتة والسكربتات', icon: Terminal },
        { id: 'developer', route: 'developer', titleEn: 'Developer Environments', titleAr: 'بيئات التطوير والمنافذ', icon: Code2 },
        { id: 'project-tools', route: 'project-tools', titleEn: 'Project Scaffolder & Git', titleAr: 'أدوات المشاريع وGit', icon: FolderGit2 }
      ]
    },
    {
      titleEn: 'Diagnostics & Support',
      titleAr: 'التشخيص والدعم الفني',
      items: [
        { id: 'diagnostics', route: 'diagnostics', titleEn: 'System Diagnostics & Logs', titleAr: 'تشخيص النظام والسجلات', icon: Activity },
        { id: 'hardware', route: 'hardware', titleEn: 'Hardware Benchmarking', titleAr: 'اختبار العتاد والأداء', icon: Cpu },
        { id: 'cloud', route: 'cloud', titleEn: 'Cloud Sync & Profiles', titleAr: 'المزامنة السحابية', icon: Cloud },
        { id: 'support', route: 'support', titleEn: 'Support Portal & Tickets', titleAr: 'مركز الدعم الفني', icon: HelpCircle },
        { id: 'brand-gallery', route: 'brand-gallery', titleEn: 'Official Brand & Gallery', titleAr: 'الشعارات والمعرض البصري', icon: ImageIcon, badge: 'Official' },
        { id: 'catalog', route: 'catalog', titleEn: 'All 190 Capabilities Grid', titleAr: 'دليل كافة الوظائف 190', icon: Grid, badge: '190 Tools' },
        { id: 'web-landing', route: 'web-landing', titleEn: 'Web Suite Landing Page', titleAr: 'صفحة الويب التعريفية', icon: Globe },
        { id: 'settings', route: 'settings', titleEn: 'Suite Settings', titleAr: 'الإعدادات والتخصيص', icon: Settings },
        { id: 'about', route: 'about', titleEn: 'About KNOUX ONE', titleAr: 'عن KNOUX ONE', icon: Info }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#09031C] border-r border-purple-950/40 flex flex-col h-[calc(100vh-4rem)] overflow-y-auto custom-scrollbar select-none shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-purple-950/30">
        <div className="flex items-center space-x-2 rtl:space-x-reverse px-2 py-1.5 rounded-lg bg-purple-950/20 border border-purple-900/30">
          <Layers className="w-4 h-4 text-[#8226EE]" />
          <span className="text-xs font-mono font-bold text-gray-200">
            {t('19 Modules Catalog', 'كتالوج الـ 19 موديل')}
          </span>
          <span className="ml-auto text-[10px] font-mono bg-purple-900/50 text-purple-300 px-1.5 py-0.5 rounded">
            190
          </span>
        </div>
      </div>

      {/* Navigation Groups */}
      <div className="p-3 space-y-4 flex-1">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.titleEn];
          return (
            <div key={group.titleEn} className="space-y-1">
              <button
                onClick={() => toggleGroup(group.titleEn)}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-purple-400/80 hover:text-purple-300 transition-colors"
              >
                <span>{t(group.titleEn, group.titleAr)}</span>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-purple-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-purple-500" />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-0.5 mt-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentRoute === item.route;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentRoute(item.route)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-[#8226EE] text-white shadow-lg shadow-purple-900/50 font-semibold'
                            : 'text-gray-300 hover:bg-purple-950/40 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 rtl:space-x-reverse min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                          <span className="truncate">{t(item.titleEn, item.titleAr)}</span>
                        </div>
                        {item.badge && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-tight shrink-0 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'bg-purple-900/40 text-purple-300 border border-purple-800/40'
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Developer Footer Credits */}
      <div className="p-3 border-t border-purple-950/30 bg-[#070216]/60">
        <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-900/30 text-center">
          <p className="text-[10px] text-gray-400 font-mono">
            Crafted by <span className="text-purple-300 font-bold">Eng. Sadek Elgazar</span>
          </p>
          <p className="text-[9px] text-purple-400/80 font-mono mt-0.5">
            Knoux Intelligence Suite
          </p>
        </div>
      </div>
    </aside>
  );
};
