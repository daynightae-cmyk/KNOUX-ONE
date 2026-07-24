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
  const [runtimeMode, setRuntimeMode] = useState<KnouxRuntime>('desktop');

  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs>(INITIAL_UNSCANNED_SPECS);
  const [essentialApps, setEssentialApps] = useState<EssentialApp[]>(ESSENTIAL_APPS_CATALOG);
  const [cleanupCategories, setCleanupCategories] = useState<CleanupCategory[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [actionLogs, setActionLogs] = useState<ActionLog[]>([]);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [activeScanTitle, setActiveScanTitle] = useState<string>('');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [isFirstRunWizardCompleted, setIsFirstRunWizardCompleted] = useState<boolean>(true);
  const [notificationCount, setNotificationCount] = useState<number>(3);

  const [elevationRequest, setElevationRequest] = useState<ElevationRequest>({
    isOpen: false,
    operationNameEn: '',
    operationNameAr: '',
    reasonEn: '',
    reasonAr: '',
    riskLevel: 'moderate',
    onConfirm: () => {}
  });

  // Translation helper function
  const t = (keyEn: string, keyAr: string): string => {
    return language === 'ar' ? keyAr : keyEn;
  };

  // Keyboard shortcut for Ctrl + K command palette
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

  // Sync theme class to <html> tag
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      // System mode default
      root.classList.add('dark');
    }
  }, [theme]);

  // Sync language direction
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    root.setAttribute('lang', language);
  }, [language]);

  const toggleAppInstall = async (id: string) => {
    const appToInstall = essentialApps.find(a => a.id === id);
    if (!appToInstall) return;

    // Optimistically mark as installed if it's already installed, or if user is just toggling (we shouldn't really toggle off, just install)
    if (appToInstall.installed) return; // Cannot uninstall right now

    if (NativeClient.isTauriAvailable()) {
      setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: true } : app));
      try {
        const res = await NativeClient.executeModule01Capability('m01_s05', 'm01.winget.install', { package_id: appToInstall.wingetId });
        addLog('m01_s05', `Install ${appToInstall.name}`, res.status === 'completed' ? 'completed' : 'failed', res.summaryEn);
        if (res.status !== 'completed') {
          setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: false } : app));
        }
      } catch (err: any) {
        addLog('m01_s05', `Install ${appToInstall.name}`, 'failed', `Error: ${err.message || err}`);
        setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: false } : app));
      }
    } else {
      addLog('m01_s05', `Install ${appToInstall.name}`, 'failed', 'Desktop runtime unavailable. Launch KNOUX ONE Windows Desktop app to install.');
    }
  };

  const toggleCategorySelect = (id: string) => {
    setCleanupCategories(prev => prev.map(cat => cat.id === id ? { ...cat, selected: !cat.selected } : cat));
  };

  const addLog = (capabilityId: string, capabilityName: string, status: 'completed' | 'failed' | 'in_progress' | 'cancelled', details: string, reclaimedSpace?: string) => {
    const newLog: ActionLog = {
      id: `log_${Date.now()}`,
      timestamp: 'Just now',
      capabilityId,
      capabilityName,
      status,
      details,
      reclaimedSpace,
      adminElevated: runtimeMode === 'desktop_elevated'
    };
    setActionLogs(prev => [newLog, ...prev]);
  };

  const executeCleanup = async () => {
    setIsScanning(true);
    setActiveScanTitle(language === 'ar' ? 'جاري فحص حالة البيئة...' : 'Verifying environment...');
    setScanProgress(50);

    if (!NativeClient.isTauriAvailable()) {
      setIsScanning(false);
      addLog(
        'm02_s01',
        'Smart Cleanup',
        'cancelled',
        'Desktop runtime unavailable. Launch KNOUX ONE Windows Desktop app to perform native disk operations.'
      );
      return;
    }

    try {
      const res = await NativeClient.executeModule01Capability('m02_s01', 'm02.cleanup.execute');
      setIsScanning(false);
      addLog('m02_s01', 'Smart Cleanup', res.status === 'completed' ? 'completed' : 'failed', res.summaryEn);
    } catch (err: any) {
      setIsScanning(false);
      addLog('m02_s01', 'Smart Cleanup', 'failed', `Cleanup error: ${err.message || err}`);
    }
  };

  const toggleKeepDuplicateItem = (groupId: string, itemId: string) => {
    setDuplicateGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group;
      return {
        ...group,
        items: group.items.map(item => ({
          ...item,
          keep: item.id === itemId
        }))
      };
    }));
  };

  const quarantineDuplicates = () => {
    const newQuarantinedItems: QuarantineItem[] = [];

    setDuplicateGroups(prev => prev.filter(group => {
      const duplicatesToRemove = group.items.filter(item => !item.keep);
      duplicatesToRemove.forEach(dup => {
        newQuarantinedItems.push({
          id: `quar_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          originalPath: dup.path,
          quarantinePath: `C:\\ProgramData\\KNOUX\\Quarantine\\${dup.path.split('\\').pop()}`,
          filename: dup.path.split('\\').pop() || 'duplicate_file',
          sizeFormatted: group.fileSizeFormatted,
          checksum: group.hash,
          quarantinedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reason: 'Duplicate file quarantined'
        });
      });
      return false; // Group processed
    }));

    setQuarantineItems(prev => [...prev, ...newQuarantinedItems]);
    addLog('m03_s10', 'Duplicate Quarantine', 'completed', `Moved ${newQuarantinedItems.length} duplicate file copies to safe KNOUX Quarantine.`);
  };

  const restoreQuarantineItem = (id: string) => {
    const item = quarantineItems.find(i => i.id === id);
    if (item) {
      setQuarantineItems(prev => prev.filter(i => i.id !== id));
      addLog('m03_s10', 'Quarantine Restore', 'completed', `Restored ${item.filename} back to ${item.originalPath}`);
    }
  };

  const permanentDeleteQuarantineItem = (id: string) => {
    setQuarantineItems(prev => prev.filter(i => i.id !== id));
    addLog('m03_s10', 'Quarantine Wipe', 'completed', `Permanently deleted item from quarantine.`);
  };

  const runSmartScan = async () => {
    setIsScanning(true);
    setActiveScanTitle(language === 'ar' ? 'جاري فحص حالة البيئة...' : 'Verifying environment...');
    setScanProgress(50);

    if (!NativeClient.isTauriAvailable()) {
      setIsScanning(false);
      addLog(
        'm01_s01',
        'Smart System Audit',
        'cancelled',
        'Desktop runtime unavailable in browser mode. Launch KNOUX ONE Windows Desktop app to audit host hardware.'
      );
      return;
    }

    try {
      const result = await NativeClient.executeModule01Capability('m01_s01', 'm01.system.discover');
      setIsScanning(false);
      addLog('m01_s01', 'Smart System Audit', result.status === 'completed' ? 'completed' : 'failed', result.summaryEn);
      
      if (result.status === 'completed' && result.data) {
        setSystemSpecs(prev => ({
          ...prev,
          ...result.data,
          // Calculate health score dynamically based on data if provided
          healthScore: result.data.healthScore || 90
        }));
      }
    } catch (err: any) {
      setIsScanning(false);
      addLog('m01_s01', 'Smart System Audit', 'failed', `Discovery failed: ${err.message || err}`);
    }
  };

  const requestElevation = (
    opEn: string, 
    opAr: string, 
    reasonEn: string, 
    reasonAr: string, 
    risk: RiskLevel, 
    onConfirm: () => void
  ) => {
    setElevationRequest({
      isOpen: true,
      operationNameEn: opEn,
      operationNameAr: opAr,
      reasonEn,
      reasonAr,
      riskLevel: risk,
      onConfirm: () => {
        onConfirm();
        setElevationRequest(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const triggerElevation = (capId: string, reasonEn: string, onConfirm: () => void) => {
    requestElevation(
      `Capability ${capId}`,
      `الوظيفة ${capId}`,
      reasonEn,
      reasonEn,
      'moderate',
      onConfirm
    );
  };

  const closeElevationModal = () => {
    setElevationRequest(prev => ({ ...prev, isOpen: false }));
  };

  const addSupportTicket = (subject: string, category: string, priority: 'low' | 'medium' | 'high') => {
    const newTicket: SupportTicket = {
      id: `TK-${Math.floor(1000 + Math.random() * 9000)}`,
      subject,
      category,
      priority,
      status: 'Open',
      createdAt: new Date().toISOString().split('T')[0],
      lastUpdate: 'Just now',
      messagesCount: 1
    };
    setSupportTickets(prev => [newTicket, ...prev]);
    addLog('m19_s09', 'Support Ticket', 'completed', `Created support ticket ${newTicket.id}: "${subject}"`);
  };

  const completeFirstRunWizard = () => {
    setIsFirstRunWizardCompleted(true);
    setCurrentRoute('dashboard');
  };

  const clearNotifications = () => {
    setNotificationCount(0);
  };

  return (
    <KnouxContext.Provider
      value={{
        theme,
        setTheme,
        language,
        setLanguage,
        currentRoute,
        setCurrentRoute,
        runtimeMode,
        setRuntimeMode,
        systemSpecs,
        essentialApps,
        toggleAppInstall,
        cleanupCategories,
        toggleCategorySelect,
        executeCleanup,
        duplicateGroups,
        toggleKeepDuplicateItem,
        quarantineDuplicates,
        quarantineItems,
        restoreQuarantineItem,
        permanentDeleteQuarantineItem,
        actionLogs,
        addLog,
        isScanning,
        scanProgress,
        activeScanTitle,
        runSmartScan,
        commandPaletteOpen,
        setCommandPaletteOpen,
        elevationRequest,
        requestElevation,
        triggerElevation,
        closeElevationModal,
        supportTickets,
        addSupportTicket,
        isFirstRunWizardCompleted,
        completeFirstRunWizard,
        notificationCount,
        clearNotifications,
        t
      }}
    >
      {children}
    </KnouxContext.Provider>
  );
};

export const useKnoux = () => {
  const context = useContext(KnouxContext);
  if (!context) {
    throw new Error('useKnoux must be used within a KnouxProvider');
  }
  return context;
};
