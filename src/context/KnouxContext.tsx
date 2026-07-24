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
import { 
  INITIAL_SYSTEM_SPECS, 
  ESSENTIAL_APPS_CATALOG, 
  INITIAL_CLEANUP_CATEGORIES, 
  INITIAL_DUPLICATE_GROUPS, 
  INITIAL_SUPPORT_TICKETS 
} from '../data/mockSystemData';

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

export const KnouxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<KnouxTheme>('dark');
  const [language, setLanguage] = useState<KnouxLanguage>('en');
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [runtimeMode, setRuntimeMode] = useState<KnouxRuntime>('desktop');

  const [systemSpecs, setSystemSpecs] = useState<SystemSpecs>(INITIAL_SYSTEM_SPECS);
  const [essentialApps, setEssentialApps] = useState<EssentialApp[]>(ESSENTIAL_APPS_CATALOG);
  const [cleanupCategories, setCleanupCategories] = useState<CleanupCategory[]>(INITIAL_CLEANUP_CATEGORIES);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>(INITIAL_DUPLICATE_GROUPS);
  const [quarantineItems, setQuarantineItems] = useState<QuarantineItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(INITIAL_SUPPORT_TICKETS);

  const [actionLogs, setActionLogs] = useState<ActionLog[]>([
    {
      id: 'log_1',
      timestamp: 'Today, 09:30 AM',
      capabilityId: 'm01_s01',
      capabilityName: 'Smart System Audit',
      status: 'completed',
      details: 'System health verified at 92/100. All security components operational.',
      adminElevated: false
    },
    {
      id: 'log_2',
      timestamp: 'Yesterday',
      capabilityId: 'm02_s01',
      capabilityName: 'Smart Cleanup Preview',
      status: 'completed',
      details: 'Identified 2.14 GB reclaimable temporary data safely.',
      reclaimedSpace: '2.14 GB',
      adminElevated: false
    }
  ]);

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

  const toggleAppInstall = (id: string) => {
    setEssentialApps(prev => prev.map(app => app.id === id ? { ...app, installed: !app.installed } : app));
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
    setActiveScanTitle(language === 'ar' ? 'تنظيف الملفات المختارة...' : 'Executing Smart Cleanup...');
    setScanProgress(0);

    for (let i = 10; i <= 100; i += 15) {
      setScanProgress(i);
      await new Promise(res => setTimeout(res, 180));
    }

    // Process selected categories
    let totalBytesFreed = 0;
    const selectedCats = cleanupCategories.filter(c => c.selected);
    selectedCats.forEach(c => { totalBytesFreed += c.sizeBytes; });

    const freedMB = (totalBytesFreed / (1024 * 1024)).toFixed(1);
    const freedGB = (totalBytesFreed / (1024 * 1024 * 1024)).toFixed(2);
    const formattedFreed = totalBytesFreed > 1024 * 1024 * 1024 ? `${freedGB} GB` : `${freedMB} MB`;

    // Reset selected categories size
    setCleanupCategories(prev => prev.map(cat => cat.selected ? { ...cat, fileCount: 0, sizeBytes: 0, sizeFormatted: '0 B', items: [] } : cat));

    // Update disk space
    setSystemSpecs(prev => ({
      ...prev,
      diskFreeGB: Math.min(prev.diskTotalGB, prev.diskFreeGB + parseFloat(freedGB)),
      diskUsedGB: Math.max(0, prev.diskUsedGB - parseFloat(freedGB))
    }));

    addLog('m02_s01', 'Smart Cleanup', 'completed', `Safely cleaned ${selectedCats.length} categories. Recycled ${formattedFreed}.`, formattedFreed);

    setIsScanning(false);
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
    setActiveScanTitle(language === 'ar' ? 'جاري إجراء الفحص الذكي...' : 'Running Smart System Scan...');
    setScanProgress(0);

    const steps = [
      'Scanning Windows System Integrity...',
      'Analyzing Temporary Files & Caches...',
      'Checking Duplicate Hashes (BLAKE3)...',
      'Auditing Startup Impact & Background Services...',
      'Verifying Defender & Firewall Protection...'
    ];

    for (let index = 0; index < steps.length; index++) {
      setActiveScanTitle(language === 'ar' ? `فحص: ${steps[index]}` : steps[index]);
      for (let p = index * 20; p <= (index + 1) * 20; p += 5) {
        setScanProgress(p);
        await new Promise(res => setTimeout(res, 80));
      }
    }

    setIsScanning(false);
    addLog('m01_s01', 'Smart System Scan', 'completed', 'Smart scan finished successfully. 0 critical vulnerabilities found.');
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
        setRuntimeMode('desktop_elevated');
        onConfirm();
        setElevationRequest(prev => ({ ...prev, isOpen: false }));
      }
    });
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
