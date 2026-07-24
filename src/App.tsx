/**
 * KNOUX ONE — Premium Application Workspace & Router
 */

import React from 'react';
import { KnouxProvider, useKnoux } from './context/KnouxContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { CommandPalette } from './components/layout/CommandPalette';
import { ElevationModal } from './components/common/ElevationModal';

import { DashboardView } from './components/views/DashboardView';
import { FirstRunView } from './components/views/FirstRunView';
import { PostFormatView } from './components/views/PostFormatView';
import { SmartCleanupView } from './components/views/SmartCleanupView';
import { DuplicateFinderView } from './components/views/DuplicateFinderView';
import { StorageAnalyzerView } from './components/views/StorageAnalyzerView';
import { StartupServicesView } from './components/views/StartupServicesView';
import { PerformanceCenterView } from './components/views/PerformanceCenterView';
import { WindowsRepairView } from './components/views/WindowsRepairView';
import { NetworkOptimizerView } from './components/views/NetworkOptimizerView';
import { PrivacyTelemetryView } from './components/views/PrivacyTelemetryView';
import { SecurityCenterView } from './components/views/SecurityCenterView';
import { BackupRecoveryView } from './components/views/BackupRecoveryView';
import { ApplicationsStoreView } from './components/views/ApplicationsStoreView';
import { FileUtilitiesView } from './components/views/FileUtilitiesView';
import { AutomationProductivityView } from './components/views/AutomationProductivityView';
import { DeveloperSuiteView } from './components/views/DeveloperSuiteView';
import { CodeProjectToolsView } from './components/views/CodeProjectToolsView';
import { LogsDiagnosticsView } from './components/views/LogsDiagnosticsView';
import { HardwareHealthView } from './components/views/HardwareHealthView';
import { CloudSupportView } from './components/views/CloudSupportView';
import { CapabilitiesCatalogView } from './components/views/CapabilitiesCatalogView';
import { WebLandingView } from './components/views/WebLandingView';
import { SupportPortalView } from './components/views/SupportPortalView';
import { SettingsAboutView } from './components/views/SettingsAboutView';
import { BrandGalleryView } from './components/views/BrandGalleryView';

const AppContent: React.FC = () => {
  const { currentRoute } = useKnoux();

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
      case 'settings':
      case 'about': return <SettingsAboutView />;
      default: return <DashboardView />;
    }
  };

  return (
    <div className="knoux-workspace-canvas text-[var(--knoux-text)] font-sans antialiased selection:bg-[var(--knoux-primary)] selection:text-white">
      <div className="knoux-ambient-orb knoux-ambient-orb--one" aria-hidden="true" />
      <div className="knoux-ambient-orb knoux-ambient-orb--two" aria-hidden="true" />

      <div className="knoux-workspace-frame">
        <Header />

        <div className="flex flex-1 min-h-0 gap-3 p-3 pt-2">
          <Sidebar />
          <main className="knoux-content-shell flex-1 custom-scrollbar">
            {renderRoute()}
          </main>
        </div>

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
