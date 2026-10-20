/**
 * KNOUX ONE — Premium Application Workspace & Router
 *
 * All route views are loaded lazily behind a single Suspense boundary so the
 * initial JavaScript chunk stays small; the shell, header, sidebar and shared
 * layout parse first and views stream in on navigation.
 */

import React, { Suspense, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { KnouxProvider, useKnoux } from './context/KnouxContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { OperationDrawer } from './components/layout/OperationDrawer';
import { ElevationModal } from './components/common/ElevationModal';

import { SERVICE_PRESENTATIONS } from './services/servicePresentation';

const lazyView = (loader: () => Promise<Record<string, unknown>>, exportName: string) =>
  React.lazy(() => loader().then((mod) => ({ default: mod[exportName] as React.ComponentType })));

const DashboardView = lazyView(() => import('./components/views/DashboardView'), 'DashboardView');
const FirstRunView = lazyView(() => import('./components/views/FirstRunView'), 'FirstRunView');
const PostFormatView = lazyView(() => import('./components/views/PostFormatView'), 'PostFormatView');
const SmartCleanupView = lazyView(() => import('./components/views/SmartCleanupView'), 'SmartCleanupView');
const DuplicateFinderView = lazyView(() => import('./components/views/DuplicateFinderView'), 'DuplicateFinderView');
const StorageAnalyzerView = lazyView(() => import('./components/views/StorageAnalyzerView'), 'StorageAnalyzerView');
const StartupServicesView = lazyView(() => import('./components/views/StartupServicesView'), 'StartupServicesView');
const PerformanceCenterView = lazyView(() => import('./components/views/PerformanceCenterView'), 'PerformanceCenterView');
const WindowsRepairView = lazyView(() => import('./components/views/WindowsRepairView'), 'WindowsRepairView');
const NetworkOptimizerView = lazyView(() => import('./components/views/NetworkOptimizerView'), 'NetworkOptimizerView');
const CloudSupportView = lazyView(() => import('./components/views/CloudSupportView'), 'CloudSupportView');
const PrivacyTelemetryView = lazyView(() => import('./components/views/PrivacyTelemetryView'), 'PrivacyTelemetryView');
const SecurityCenterView = lazyView(() => import('./components/views/SecurityCenterView'), 'SecurityCenterView');
const BackupRecoveryView = lazyView(() => import('./components/views/BackupRecoveryView'), 'BackupRecoveryView');
const ApplicationsStoreView = lazyView(() => import('./components/views/ApplicationsStoreView'), 'ApplicationsStoreView');
const FileUtilitiesView = lazyView(() => import('./components/views/FileUtilitiesView'), 'FileUtilitiesView');
const AutomationProductivityView = lazyView(() => import('./components/views/AutomationProductivityView'), 'AutomationProductivityView');
const DeveloperSuiteView = lazyView(() => import('./components/views/DeveloperSuiteView'), 'DeveloperSuiteView');
const CodeProjectToolsView = lazyView(() => import('./components/views/CodeProjectToolsView'), 'CodeProjectToolsView');
const LogsDiagnosticsView = lazyView(() => import('./components/views/LogsDiagnosticsView'), 'LogsDiagnosticsView');
const HardwareHealthView = lazyView(() => import('./components/views/HardwareHealthView'), 'HardwareHealthView');
const OperationsHistoryView = lazyView(() => import('./components/views/OperationsHistoryView'), 'OperationsHistoryView');
const CapabilitiesCatalogView = lazyView(() => import('./components/views/CapabilitiesCatalogView'), 'CapabilitiesCatalogView');
const WebLandingView = lazyView(() => import('./components/views/WebLandingView'), 'WebLandingView');
const SupportPortalView = lazyView(() => import('./components/views/SupportPortalView'), 'SupportPortalView');
const SettingsView = lazyView(() => import('./components/views/SettingsView'), 'SettingsView');
const AboutView = lazyView(() => import('./components/views/AboutView'), 'AboutView');
const BrandGalleryView = lazyView(() => import('./components/views/BrandGalleryView'), 'BrandGalleryView');

const AppContent: React.FC = () => {
  const { currentRoute, selectedServiceId, setSelectedServiceId, t } = useKnoux();

  useEffect(() => {
    const selected = SERVICE_PRESENTATIONS.find(service => service.id === selectedServiceId);
    if (selected && selected.route !== currentRoute) setSelectedServiceId(null);
  }, [currentRoute, selectedServiceId, setSelectedServiceId]);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    const timer = window.setTimeout(() => {
      invoke('close_splashscreen').catch(() => {});
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  const renderRoute = () => {
    switch (currentRoute) {
      case 'dashboard': return <DashboardView />;
      case 'first-run': return <FirstRunView />;
      case 'post-format': return <PostFormatView />;
      case 'cleanup': return <SmartCleanupView />;
      case 'duplicates': return <DuplicateFinderView />;
      case 'storage': return <StorageAnalyzerView />;
      case 'startup': return <StartupServicesView />;
      case 'performance': return <PerformanceCenterView />;
      case 'repair': return <WindowsRepairView />;
      case 'network': return <NetworkOptimizerView />;
      case 'privacy': return <PrivacyTelemetryView />;
      case 'security': return <SecurityCenterView />;
      case 'backup': return <BackupRecoveryView />;
      case 'applications': return <ApplicationsStoreView />;
      case 'file-tools': return <FileUtilitiesView />;
      case 'automation': return <AutomationProductivityView />;
      case 'developer': return <DeveloperSuiteView />;
      case 'project-tools': return <CodeProjectToolsView />;
      case 'diagnostics': return <LogsDiagnosticsView />;
      case 'hardware': return <HardwareHealthView />;
      case 'cloud': return <CloudSupportView />;
      case 'catalog': return <CapabilitiesCatalogView />;
      case 'web-landing': return <WebLandingView />;
      case 'support': return <OperationsHistoryView />;
      case 'brand-gallery': return <BrandGalleryView />;
      case 'settings': return <SettingsView />;
      case 'about': return <AboutView />;
      default: return <DashboardView />;
    }
  };

  const fallback = (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-[var(--knoux-text-muted)]">
      {t('Loading workspace…', 'جاري تحميل مساحة العمل…')}
    </div>
  );

  return (
    <div className="knoux-workspace-canvas text-[var(--knoux-text)] font-sans antialiased selection:bg-[var(--knoux-primary)] selection:text-white">
      <div className="knoux-ambient-orb knoux-ambient-orb--one" aria-hidden="true" />
      <div className="knoux-ambient-orb knoux-ambient-orb--two" aria-hidden="true" />

      <div className="knoux-workspace-frame">
        <Header />

        <div className="flex flex-1 min-h-0 gap-3 p-3 pt-2">
          <Sidebar />
          <main className="knoux-content-shell flex-1 custom-scrollbar">
            <Suspense fallback={fallback}>{renderRoute()}</Suspense>
          </main>
          <InspectorPanel />
        </div>

        <OperationDrawer />

        <CommandPalette />
        <ElevationModal />
      </div>
    </div>
  );
};

export function App() {
  return (
    <KnouxProvider>
      <AppContent />
    </KnouxProvider>
  );
}

export default App;
