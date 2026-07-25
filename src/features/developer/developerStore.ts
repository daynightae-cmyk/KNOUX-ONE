/**
 * Module 15 is intentionally non-executable during Phase 04A.
 * No sample toolchains or ports are exposed as device facts.
 */
import { useCallback, useState } from 'react';
import type { ActivePortProcess, ToolchainItem } from './developerContracts';

export function useDeveloperStore() {
  const [toolchains] = useState<ToolchainItem[]>([]);
  const [activePorts] = useState<ActivePortProcess[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'path' | 'git' | 'runtimes' | 'ports' | 'health'>('overview');
  const [isLoading] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    throw new Error('capability_planned:m15');
  }, []);

  const killProcessByPort = useCallback(async (_port: number) => {
    throw new Error('capability_planned:m15');
  }, []);

  return {
    toolchains,
    activePorts,
    activeTab,
    setActiveTab,
    isLoading,
    refreshDiagnostics,
    killProcessByPort,
  };
}
