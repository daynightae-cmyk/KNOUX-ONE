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
import { WindowsRepairView } from './components/views/WindowsRepairView';
import { NetworkOptimizerView } from './components/views/NetworkOptimizerView';
import { PrivacyTelemetryView } from './components/views/PrivacyTelemetryView';
import { ApplicationsStoreView } from './components/views/ApplicationsStoreView';
import { DeveloperSuiteView } from './components/views/DeveloperSuiteView';
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
      case 'repair':
      case 'security':
        return <WindowsRepairView />;
      case 'network':
        return <NetworkOptimizerView />;
      case 'privacy':
        return <PrivacyTelemetryView />;
      case 'applications':
        return <ApplicationsStoreView />;
      case 'developer':
      case 'project-tools':
        return <DeveloperSuiteView />;
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
    <div className="min-h-screen bg-[#0A0322] text-gray-100 flex flex-col font-sans antialiased selection:bg-[#8226EE] selection:text-white">
      {/* Header / Titlebar */}
      <Header />

      {/* Main Layout Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Dynamic Route View Content Area */}
        <main className="flex-1 overflow-y-auto custom-scrollbar bg-[#08021B]">
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
