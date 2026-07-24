/**
 * KNOUX ONE — Windows Intelligence & Developer Suite
 * Main Application Shell & Router
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
      case 'dashboard':
        return <DashboardView />;
      case 'first-run':
        return <FirstRunView />;
      case 'post-format':
        return <PostFormatView />;
      case 'cleanup':
        return <SmartCleanupView />;
      case 'duplicates':
        return <DuplicateFinderView />;
      case 'storage':
        return <StorageAnalyzerView />;
      case 'startup':
        return <StartupServicesView />;
      case 'performance':
        return <PerformanceCenterView />;
      case 'repair':
        return <WindowsRepairView />;
      case 'network':
        return <NetworkOptimizerView />;
      case 'privacy':
        return <PrivacyTelemetryView />;
      case 'security':
        return <SecurityCenterView />;
      case 'backup':
        return <BackupRecoveryView />;
      case 'applications':
        return <ApplicationsStoreView />;
      case 'file-tools':
        return <FileUtilitiesView />;
      case 'automation':
        return <AutomationProductivityView />;
      case 'developer':
        return <DeveloperSuiteView />;
      case 'project-tools':
        return <CodeProjectToolsView />;
      case 'diagnostics':
        return <LogsDiagnosticsView />;
      case 'hardware':
        return <HardwareHealthView />;
      case 'cloud':
        return <CloudSupportView />;
      case 'catalog':
        return <CapabilitiesCatalogView />;
      case 'web-landing':
        return <WebLandingView />;
      case 'support':
        return <SupportPortalView />;
      case 'brand-gallery':
        return <BrandGalleryView />;
      case 'settings':
      case 'about':
        return <SettingsAboutView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="min-h-screen knoux-app-bg text-[var(--knoux-text)] flex flex-col font-sans antialiased selection:bg-[#8226EE] selection:text-white transition-colors duration-200">
      {/* Header / Titlebar */}
      <Header />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Route View Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar knoux-app-bg transition-colors duration-200">
          {renderRoute()}
        </main>
      </div>

      {/* Modals & Command Palette Overlays */}
      <CommandPalette />
      <ElevationModal />
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
