/**
 * KNOUX ONE — Global Application State Context
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  KnouxLanguage, 
  KnouxTheme, 
  KnouxRuntime, 
  SystemSpecs, 
  EssentialApp, 
  CleanupCategory, 
  DuplicateGroup, 
  QuarantineItem, 
  ActionLog, 
  SupportTicket,
  RiskLevel
} from '../types';
import { ESSENTIAL_APPS_CATALOG } from '../data/essentialAppsCatalog';
import { NativeClient } from '../services/nativeClient';

interface ElevationRequest {
  isOpen: boolean;
  operationNameEn: string;
  operationNameAr: string;
  reasonEn: string;
  reasonAr: string;
  riskLevel: RiskLevel;
  onConfirm: () => void;
}

interface KnouxContextType {
  theme: KnouxTheme;
  setTheme: (t: KnouxTheme) => void;
  language: KnouxLanguage;
  setLanguage: (l: KnouxLanguage) => void;
  currentRoute: string;
  setCurrentRoute: (r: string) => void;
  runtimeMode: KnouxRuntime;
  setRuntimeMode: (m: KnouxRuntime) => void;
  systemSpecs: SystemSpecs;
  essentialApps: EssentialApp[];
  toggleAppInstall: (id: string) => void;
  cleanupCategories: CleanupCategory[];
  toggleCategorySelect: (id: string) => void;
  executeCleanup: () => Promise<void>;
  duplicateGroups: DuplicateGroup[];
  toggleKeepDuplicateItem: (groupId: string, itemId: string) => void;
  quarantineDuplicates: () => void;
  quarantineItems: QuarantineItem[];
  restoreQuarantineItem: (id: string) => void;
  permanentDeleteQuarantineItem: (id: string) => void;
  actionLogs: ActionLog[];
  addLog: (capabilityId: string, capabilityName: string, status: 'completed' | 'failed' | 'in_progress' | 'cancelled', details: string, reclaimedSpace?: string) => void;
  isScanning: boolean;
  scanProgress: number;
  activeScanTitle: string;
  runSmartScan: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  elevationRequest: ElevationRequest;
  requestElevation: (opEn: string, opAr: string, reasonEn: string, reasonAr: string, risk: RiskLevel, onConfirm: () => void) => void;
  triggerElevation: (capId: string, reasonEn: string, onConfirm: () => void) => void;
  closeElevationModal: () => void;
  supportTickets: SupportTicket[];
  addSupportTicket: (subject: string, category: string, priority: 'low' | 'medium' | 'high') => void;
  isFirstRunWizardCompleted: boolean;
  completeFirstRunWizard: () => void;
  notificationCount: number;
  clearNotifications: () => void;
  t: (keyEn: string, keyAr: string) => string;
}

const KnouxContext = createContext<KnouxContextType | undefined>(undefined);

const INITIAL_UNSCANNED_SPECS: SystemSpecs = {
  computerName: 'KNOUX Host Device',
  processor: 'Awaiting Hardware Scan',
  cpuCores: 0,
  cpuLoadPercentage: 0,
  totalRamGB: 0,
  usedRamGB: 0,
  ramLoadPercentage: 0,
  osEdition: 'Windows Host Environment',
  osVersion: 'Awaiting Scan',
  osBuild: '-',
  architecture: 'x64',
  uptimeHours: 0,
  uptimeFormatted: '0h',
  diskTotalGB: 0,
  diskUsedGB: 0,
  diskFreeGB: 0,
  diskHealth: 'Awaiting Scan',
  networkAdapter: 'Network Adapter',
  networkSpeedMbps: 0,
  ipAddress: '127.0.0.1',
  defenderStatus: false,
  firewallStatus: false,
  healthScore: 0
};

export const KnouxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<KnouxTheme>('dark');
  const [language, setLanguage] = useState<KnouxLanguage>('en');
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [runtimeMode, setRuntimeMode] = useState<KnouxRuntime>(() => NativeClient.isTauriAvailable() ? 'desktop' : 'web');

  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs>(INITIAL_UNSCANNED_SPECS);
  const [essentialApps, setEssentialApps] = useState<EssentialApp[]>(ESSENTIAL_APPS_CATALOG);
  const [cleanupCategories, setCleanupCategories] = useState<CleanupCategory[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [quarantineItems] = useState<QuarantineItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [activeScanTitle, setActiveScanTitle] = useState<string>('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isFirstRunWizardCompleted, setIsFirstRunWizardCompleted] = useState<boolean>(true);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  const [elevationRequest, setElevationRequest] = useState<ElevationRequest>({
    isOpen: false,
    operationNameEn: '',
    operationNameAr: '',
    reasonEn: '',
    reasonAr: '',
    riskLevel: 'moderate',
    onConfirm: () => {}
  });

  const t = (keyEn: string, keyAr: string): string => language === 'ar' ? keyAr : keyEn;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.toggle('light', !window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  const addLog = (capabilityId: string, capabilityName: string, status: 'completed' | 'failed' | 'in_progress' | 'cancelled', details: string, reclaimedSpace?: string) => {
    const newLog: ActionLog = {
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      capabilityId,
      capabilityName,
      status,
      details,
      reclaimedSpace,
      adminElevated: runtimeMode === 'desktop_elevated'
    };
    setActionLogs(prev => [newLog, ...prev]);
  };

  const toggleAppInstall = async (id: string) => {
    const appToInstall = essentialApps.find(app => app.id === id);
    if (!appToInstall || appToInstall.installed) return;
    if (!NativeClient.isTauriAvailable()) {
      addLog('m01_s05', `Install ${appToInstall.name}`, 'cancelled', 'Desktop runtime unavailable. Launch KNOUX ONE Windows Desktop app to install.');
      return;
    }
    setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: true } : app));
    const result = await NativeClient.executeCapability('m01_s05', 'm01.winget.install', { packageId: appToInstall.wingetId });
    const successful = result.status === 'completed' || result.status === 'completed_with_warnings';
    addLog('m01_s05', `Install ${appToInstall.name}`, successful ? 'completed' : 'failed', result.summaryEn);
    if (!successful) setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: false } : app));
  };

  const toggleCategorySelect = (id: string) => {
    setCleanupCategories(prev => prev.map(cat => cat.id === id ? { ...cat, selected: !cat.selected } : cat));
  };

  const executeCleanup = async () => {
    setIsScanning(false);
    setScanProgress(0);
    setActiveScanTitle('');
    addLog('m02_s01', 'Smart Cleanup', 'cancelled', 'Module 02 is planned and exposes no executable native handler in this phase.');
  };

  const toggleKeepDuplicateItem = (groupId: string, itemId: string) => {
    setDuplicateGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      return { ...group, items: group.items.map(item => ({ ...item, keep: item.id === itemId })) };
    }));
  };

  const quarantineDuplicates = () => {
    addLog('m03_s10', 'Duplicate Quarantine', 'cancelled', 'Legacy React-only quarantine is disabled. Use the native Duplicate Control Center.');
  };

  const restoreQuarantineItem = (_id: string) => {
    addLog('m03_s10', 'Quarantine Restore', 'cancelled', 'Legacy React-only restore is disabled. Use the native Duplicate Control Center.');
  };

  const permanentDeleteQuarantineItem = (_id: string) => {
    addLog('m03_s10', 'Quarantine Purge', 'cancelled', 'Legacy React-only purge is disabled. Use the native Duplicate Control Center.');
  };

  const runSmartScan = async () => {
    setIsScanning(true);
    setActiveScanTitle(language === 'ar' ? 'جاري اكتشاف معلومات الجهاز...' : 'Discovering device information...');
    setScanProgress(0);
    if (!NativeClient.isTauriAvailable()) {
      setIsScanning(false);
      addLog('m01_s01', 'Smart System Audit', 'cancelled', 'Desktop runtime unavailable in browser mode.');
      return;
    }
    const result = await NativeClient.executeCapability<Record<string, unknown>>('m01_s01', 'm01.system.discover');
    setIsScanning(false);
    setScanProgress(0);
    addLog('m01_s01', 'Smart System Audit', result.status === 'completed' ? 'completed' : 'failed', result.summaryEn);
    if (result.status === 'completed' && result.data) {
      setSystemSpecs(prev => ({ ...prev, ...result.data } as SystemSpecs));
    }
  };

  const requestElevation = (opEn: string, opAr: string, reasonEn: string, reasonAr: string, risk: RiskLevel, onConfirm: () => void) => {
    setElevationRequest({ isOpen: true, operationNameEn: opEn, operationNameAr: opAr, reasonEn, reasonAr, riskLevel: risk, onConfirm: () => { onConfirm(); setElevationRequest(prev => ({ ...prev, isOpen: false })); } });
  };

  const triggerElevation = (capId: string, reasonEn: string, onConfirm: () => void) => {
    requestElevation(`Capability ${capId}`, `الوظيفة ${capId}`, reasonEn, reasonEn, 'moderate', onConfirm);
  };

  const closeElevationModal = () => setElevationRequest(prev => ({ ...prev, isOpen: false }));

  const addSupportTicket = (subject: string, category: string, priority: 'low' | 'medium' | 'high') => {
    const newTicket: SupportTicket = { id: `LOCAL-${Date.now()}`, subject, category, priority, status: 'Draft', createdAt: new Date().toISOString().split('T')[0], lastUpdate: new Date().toISOString(), messagesCount: 0 };
    setSupportTickets(prev => [newTicket, ...prev]);
    addLog('m19_s06', 'Local Support Draft', 'completed', `Saved local support draft ${newTicket.id}. No cloud request was sent.`);
  };

  const completeFirstRunWizard = () => { setIsFirstRunWizardCompleted(true); setCurrentRoute('dashboard'); };
  const clearNotifications = () => setNotificationCount(0);

  return (
    <KnouxContext.Provider value={{ theme, setTheme, language, setLanguage, currentRoute, setCurrentRoute, runtimeMode, setRuntimeMode, systemSpecs, essentialApps, toggleAppInstall, cleanupCategories, toggleCategorySelect, executeCleanup, duplicateGroups, toggleKeepDuplicateItem, quarantineDuplicates, quarantineItems, restoreQuarantineItem, permanentDeleteQuarantineItem, actionLogs, addLog, isScanning, scanProgress, activeScanTitle, runSmartScan, commandPaletteOpen, setCommandPaletteOpen, elevationRequest, requestElevation, triggerElevation, closeElevationModal, supportTickets, addSupportTicket, isFirstRunWizardCompleted, completeFirstRunWizard, notificationCount, clearNotifications, t }}>
      {children}
    </KnouxContext.Provider>
  );
};

export const useKnoux = () => {
  const context = useContext(KnouxContext);
  if (!context) throw new Error('useKnoux must be used within a KnouxProvider');
  return context;
};
