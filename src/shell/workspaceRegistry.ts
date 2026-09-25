import type { LucideIcon } from 'lucide-react';
import { History, Info, LayoutDashboard, Settings } from 'lucide-react';
import { MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { MODULE_ICONS, MODULE_ROUTE_MAP } from '../components/workspace/workspaceMeta';

export interface WorkspaceDescriptor {
  id: string;
  route: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: LucideIcon;
  moduleId?: string;
}

export interface WorkspaceGroup {
  id: string;
  titleEn: string;
  titleAr: string;
  moduleIds: string[];
}

export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  { id: 'system', titleEn: 'System', titleAr: 'النظام', moduleIds: ['m01', 'm02', 'm03', 'm04', 'm05', 'm06'] },
  { id: 'recovery', titleEn: 'Recovery & network', titleAr: 'الاستعادة والشبكة', moduleIds: ['m07', 'm08', 'm09', 'm10', 'm11'] },
  { id: 'tools', titleEn: 'Applications & automation', titleAr: 'التطبيقات والأتمتة', moduleIds: ['m12', 'm13', 'm14'] },
  { id: 'developer', titleEn: 'Developer', titleAr: 'المطور', moduleIds: ['m15', 'm16', 'm17'] },
  { id: 'intelligence', titleEn: 'Device intelligence', titleAr: 'ذكاء الجهاز', moduleIds: ['m18', 'm19'] },
];

export const MODULE_WORKSPACES: WorkspaceDescriptor[] = MODULES_CATALOG.map(module => ({
  id: module.id,
  moduleId: module.id,
  route: MODULE_ROUTE_MAP[module.id],
  titleEn: module.nameEn,
  titleAr: module.nameAr,
  descriptionEn: module.descriptionEn,
  descriptionAr: module.descriptionAr,
  icon: MODULE_ICONS[module.id],
}));

export const SHELL_WORKSPACES: WorkspaceDescriptor[] = [
  {
    id: 'dashboard', route: 'dashboard', titleEn: 'Machine command center', titleAr: 'مركز قيادة الجهاز',
    descriptionEn: 'Measured device state and verified actions', descriptionAr: 'حالة الجهاز المقاسة والإجراءات الموثقة', icon: LayoutDashboard,
  },
  {
    id: 'operations', route: 'support', titleEn: 'Operations & history', titleAr: 'العمليات والسجل',
    descriptionEn: 'Local operation evidence and support drafts', descriptionAr: 'أدلة العمليات المحلية ومسودات الدعم', icon: History,
  },
  {
    id: 'settings', route: 'settings', titleEn: 'Settings', titleAr: 'الإعدادات',
    descriptionEn: 'Appearance, language, and updates', descriptionAr: 'المظهر واللغة والتحديثات', icon: Settings,
  },
  {
    id: 'about', route: 'about', titleEn: 'About KNOUX ONE', titleAr: 'عن كنوكس ون',
    descriptionEn: 'Product and architecture information', descriptionAr: 'معلومات المنتج والمعمارية', icon: Info,
  },
];

export const WORKSPACE_BY_ROUTE = new Map(
  [...SHELL_WORKSPACES, ...MODULE_WORKSPACES].map(workspace => [workspace.route, workspace]),
);

export function getWorkspaceForModule(moduleId: string): WorkspaceDescriptor | undefined {
  return MODULE_WORKSPACES.find(workspace => workspace.moduleId === moduleId);
}
