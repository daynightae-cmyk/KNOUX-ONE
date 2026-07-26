import React from 'react';
import { DownloadQuarantinePanel } from '../../features/cleanup/DownloadQuarantinePanel';
import { SmartCleanupWorkspace } from '../../features/cleanup/SmartCleanupWorkspace';

export const SmartCleanupView: React.FC = () => (
  <div className="space-y-6">
    <SmartCleanupWorkspace />
    <DownloadQuarantinePanel />
  </div>
);
