/**
 * KNOUX ONE — Navigation Sidebar Component
 */

import React, { useState } from 'react';
import { useKnoux } from '../../context/KnouxContext';
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
  Image as ImageIcon,
  ChevronLeft
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
  const { currentRoute, setCurrentRoute, t } = useKnoux();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleGroup = (title: string) => {
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const navGroups: NavGroup[] = [
    {
      titleEn: 'HOME & OVERVIEW',
      titleAr: 'الرئيسية والوظائف',
      items: [
        { id: 'dashboard', route: 'dashboard', titleEn: 'Dashboard', titleAr: 'لوحة التحكم', icon: LayoutDashboard },
        { id: 'first-run', route: 'first-run', titleEn: 'First Run', titleAr: 'البداية', icon: Sparkles, badge: 'M01' },
        { id: 'post-format', route: 'post-format', titleEn: 'Post-Format Setup', titleAr: 'إعداد ما بعد الفورمات', icon: Download, badge: 'Popular' },
        { id: 'catalog', route: 'catalog', titleEn: 'Command Center', titleAr: 'مركز الوظائف', icon: Grid, badge: '190' },
        { id: 'support', route: 'support', titleEn: 'Activity History', titleAr: 'سجل العمليات والدعم', icon: HelpCircle }
      ]
    },
    {
      titleEn: 'SYSTEM CARE',
      titleAr: 'العناية بالنظام',
      items: [
        { id: 'cleanup', route: 'cleanup', titleEn: 'Smart Cleanup', titleAr: 'التنظيف الذكي', icon: Trash2 },
        { id: 'duplicates', route: 'duplicates', titleEn: 'Duplicate Finder', titleAr: 'مستكشف المكررات', icon: Copy },
        { id: 'storage', route: 'storage', titleEn: 'Storage Analyzer', titleAr: 'محلل القرص', icon: PieChart },
        { id: 'startup', route: 'startup', titleEn: 'Startup & Services', titleAr: 'إدارة بدء التشغيل', icon: Zap },
        { id: 'performance', route: 'performance', titleEn: 'Performance Center', titleAr: 'مركز الأداء', icon: Gauge }
      ]
    },
    {
      titleEn: 'WINDOWS & SECURITY',
      titleAr: 'ويندوز والأمان',
      items: [
        { id: 'repair', route: 'repair', titleEn: 'Windows Repair', titleAr: 'إصلاح ويندوز', icon: Wrench },
        { id: 'network', route: 'network', titleEn: 'Network & Internet', titleAr: 'الشبكة والإنترنت', icon: Wifi },
        { id: 'privacy', route: 'privacy', titleEn: 'Privacy Center', titleAr: 'مركز الخصوصية', icon: EyeOff },
        { id: 'security', route: 'security', titleEn: 'Security Center', titleAr: 'مركز الأمان', icon: ShieldCheck },
        { id: 'backup', route: 'backup', titleEn: 'Backup & Recovery', titleAr: 'النسخ الاحتياطي', icon: HardDrive }
      ]
    },
    {
      titleEn: 'APPLICATIONS & TOOLS',
      titleAr: 'التطبيقات والأدوات',
      items: [
        { id: 'applications', route: 'applications', titleEn: 'Applications & Drivers', titleAr: 'التطبيقات والتعريفات', icon: Package },
        { id: 'file-tools', route: 'file-tools', titleEn: 'File Utilities', titleAr: 'أدوات الملفات', icon: FileCode },
        { id: 'automation', route: 'automation', titleEn: 'Automation & Productivity', titleAr: 'الأتمتة والإنتاجية', icon: Terminal }
      ]
    },
    {
      titleEn: 'DEVELOPMENT & DIAGNOSTICS',
      titleAr: 'التطوير والتشخيص',
      items: [
        { id: 'developer', route: 'developer', titleEn: 'Developer Studio', titleAr: 'استوديو المطور', icon: Code2 },
        { id: 'project-tools', route: 'project-tools', titleEn: 'Code & Project Tools', titleAr: 'أدوات الكود والمشاريع', icon: FolderGit2 },
        { id: 'diagnostics', route: 'diagnostics', titleEn: 'Logs & Diagnostics', titleAr: 'السجلات والتشخيص', icon: Activity },
        { id: 'hardware', route: 'hardware', titleEn: 'Hardware & Device Health', titleAr: 'صحة العتاد', icon: Cpu }
      ]
    },
    {
      titleEn: 'KNOUX SYSTEM',
      titleAr: 'منظومة كنوكس',
      items: [
        { id: 'cloud', route: 'cloud', titleEn: 'KNOUX Cloud & Support', titleAr: 'سحابة ودعم كنوكس', icon: Cloud },
        { id: 'brand-gallery', route: 'brand-gallery', titleEn: 'Brand & Assets', titleAr: 'الشعارات والمعرض', icon: ImageIcon, badge: 'Official' },
        { id: 'web-landing', route: 'web-landing', titleEn: 'Web Landing Page', titleAr: 'صفحة الويب', icon: Globe },
        { id: 'settings', route: 'settings', titleEn: 'Settings', titleAr: 'الإعدادات', icon: Settings },
        { id: 'about', route: 'about', titleEn: 'About KNOUX ONE', titleAr: 'عن التطبيق', icon: Info }
      ]
    }
  ];

  return (
    <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-68'} bg-[var(--knoux-sidebar)] border-r border-[var(--knoux-border)] flex flex-col h-[calc(100vh-4.5rem)] overflow-y-auto custom-scrollbar select-none shrink-0 transition-all duration-300 z-30`}>
      {/* Sidebar Header Controls */}
      <div className="p-3 border-b border-[var(--knoux-border)]">
        <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--knoux-surface-muted)] border border-[var(--knoux-border)]">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2 rtl:space-x-reverse px-1">
              <Layers className="w-4 h-4 text-[var(--knoux-primary)]" />
              <span className="text-xs font-mono font-bold text-[var(--knoux-text)] truncate">
                {t('19 Modules Catalog', '19 موديول للذكاء')}
              </span>
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(prev => !prev)}
            className="p-1.5 rounded-lg hover:bg-[var(--knoux-surface-elevated)] text-[var(--knoux-primary)] transition-colors mx-auto"
            title={isSidebarCollapsed ? t('Expand Sidebar', 'توسيع القائمة') : t('Collapse Sidebar', 'طوي القائمة')}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Navigation Items List */}
      <div className="p-3 space-y-4 flex-1">
        {navGroups.map((group) => {
          const isCollapsed = collapsedGroups[group.titleEn];
          return (
            <div key={group.titleEn} className="space-y-1">
              {!isSidebarCollapsed && (
                <button
                  onClick={() => toggleGroup(group.titleEn)}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-mono font-bold uppercase tracking-wider text-[var(--knoux-text-muted)] hover:text-[var(--knoux-text)] transition-colors"
                >
                  <span>{t(group.titleEn, group.titleAr)}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 text-[var(--knoux-primary)]" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-[var(--knoux-primary)]" />
                  )}
                </button>
              )}

              {(!isCollapsed || isSidebarCollapsed) && (
                <div className="space-y-1 mt-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentRoute === item.route;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentRoute(item.route)}
                        title={isSidebarCollapsed ? t(item.titleEn, item.titleAr) : undefined}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                          isActive
                            ? 'bg-gradient-to-r from-[var(--knoux-primary)] to-[var(--knoux-primary-hover)] text-white shadow-lg shadow-[var(--knoux-primary)]/25 font-bold border border-white/10'
                            : 'text-[var(--knoux-text-secondary)] hover:bg-[var(--knoux-surface-muted)] hover:text-[var(--knoux-text)]'
                        }`}
                      >
                        <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-full' : 'space-x-3 rtl:space-x-reverse'} min-w-0`}>
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--knoux-primary)]'}`} />
                          {!isSidebarCollapsed && (
                            <span className="truncate">{t(item.titleEn, item.titleAr)}</span>
                          )}
                        </div>
                        {!isSidebarCollapsed && item.badge && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-tight shrink-0 ${
                              isActive
                                ? 'bg-white/20 text-white'
                                : 'knoux-badge-primary'
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

      {/* Footer Branding */}
      <div className="p-3 border-t border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)]">
        <div className="p-2.5 rounded-xl bg-[var(--knoux-surface)] border border-[var(--knoux-border)] text-center">
          {!isSidebarCollapsed ? (
            <>
              <p className="text-sm text-[var(--knoux-text)] font-semibold font-mono">
                Engineered by <span className="text-[var(--knoux-primary)] font-bold">Eng. Sadek Elgazar</span>
              </p>
              <p className="text-xs text-[var(--knoux-text-muted)] font-mono mt-0.5">
                KNOUX ONE Architecture
              </p>
            </>
          ) : (
            <span className="text-sm font-black font-mono text-[var(--knoux-primary)]">K1</span>
          )}
        </div>
      </div>
    </aside>
  );
};

