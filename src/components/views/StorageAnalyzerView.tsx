import React from 'react';
import { StorageAnalyzerWorkspace } from '../../features/storage/StorageAnalyzerWorkspace';
import { StorageMonitorPanel } from '../../features/storage/StorageMonitorPanel';

export const StorageAnalyzerView: React.FC = () => (
  <div className="space-y-6">
    <StorageAnalyzerWorkspace />
    <StorageMonitorPanel />
  </div>
);
