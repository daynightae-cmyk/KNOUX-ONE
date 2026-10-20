/**
 * KNOUX ONE — Premium Application Workspace & Router
 *
 * All route views are loaded lazily behind a single Suspense boundary so the
 * initial JavaScript chunk stays small; the shell, header, sidebar and shared
 * layout parse first and views stream in on navigation.
 */

import React, { Suspense, useEffect } from 'react';
import { KnouxProvider, useKnoux } from './context/KnouxContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { InspectorPanel } from './components/layout/InspectorPanel';
import { OperationDrawer } from './components/layout/OperationDrawer';
import { ElevationModal } from './components/common/ElevationModal';

import { SERVICE_PRESENTATIONS } from './services/servicePresentation';

const lazyView = (modulePath: string, exportName: string) =>
  React.lazy(() => import(modulePath).then((mod) => ({ default: mod[exportName] })));

const DashboardView = lazyView('./components/views/DashboardView', 'DashboardView');
const FirstRunView = lazyView('./components/views/FirstRunView', 'FirstRunView');
const PostFormatView = lazyView('./components/views/PostFormatView', 'PostFormatView');
const SmartCleanupView = lazyView('./components/views/SmartCleanupView', 'SmartCleanupView');
const DuplicateFinderView = lazyView('./components/views/DuplicateFinderView', 'DuplicateFinderView');
const StorageAnalyzerView = lazyView('./components/views/StorageAnalyzerView', 'StorageAnalyzerView');
const StartupServicesView = lazyView('./components/views/StartupServicesView', 'StartupServicesView');
const PerformanceCenterView = lazyView('./components/views/PerformanceCenterView', 'PerformanceCenterView');
const WindowsRepairView = lazyView('./components/views/WindowsRepairView', 'WindowsRepairView');
const NetworkOptimizerView = lazyView('./components/views/NetworkOptimizerView', 'NetworkOptimizerView');
const PrivacyTelemetryView = lazyView('./components/views/PrivacyTelemetryView', 'PrivacyTelemetryView');
const SecurityCenterView = lazyView('./components/views/SecurityCenterView', 'SecurityCenterView');
const BackupRecoveryView = lazyView('./components/views/BackupRecoveryView', 'BackupRecoveryView');
const ApplicationsStoreView = lazyView('./components/views/ApplicationsStoreView', 'ApplicationsStoreView');
const FileUtilitiesView = lazyView('./components/views/FileUtilitiesView', 'FileUtilitiesView');
const AutomationProductivityView = lazyView('./components/views/AutomationProductivityView', 'AutomationProductivityView');
const DeveloperSuiteView = lazyView('./components/views/DeveloperSuiteView', 'DeveloperSuiteView');
const CodeProjectToolsView = lazyView('./components/views/CodeProjectToolsView', 'CodeProjectToolsView');
const LogsDiagnosticsView = lazyView('./components/views/LogsDiagnosticsView', 'LogsDiagnosticsView');
const HardwareHealthView = lazyView('./components/views/HardwareHealthView', 'HardwareHealthView');
const CloudSupportView = lazyView('./components/views/CloudSupportView', 'CloudSupportView');
const CapabilitiesCatalogView = lazyView('./components/views/CapabilitiesCatalogView', 'CapabilitiesCatalogView');
const WebLandingView = lazyView('./components/views/WebLandingView', 'WebLandingView');
const SupportPortalView = lazyView('./components/views/SupportPortalView', 'SupportPortalView');
const SettingsView = lazyView('./components/views/SettingsView', 'SettingsView');
const AboutView = lazyView('./components/views/AboutView', 'AboutView');
const BrandGalleryView = lazyView('./components/views/BrandGalleryView', 'BrandGalleryView');

const AppContent: React.FC = () => {
  const { currentRoute, selectedServiceId, setSelectedServiceId, t } = useKnoux();

  useEffect(() => {
    const selected = SERVICE_PRESENTATIONS.find(service => service.id === selectedServiceId);
    if (selected && selected.route !== currentRoute) setSelectedServiceId(null);
  }, [currentRoute, selectedServiceId, setSelectedServiceId]);

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
      case 'support': return <SupportPortalView />;
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
