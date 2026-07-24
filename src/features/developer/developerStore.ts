/**
 * KNOUX ONE — Module 15 Developer Store
 */
import { useState, useCallback, useEffect } from 'react';
import { ToolchainItem, PathEntry, ActivePortProcess, DeveloperHealthIssue } from './developerContracts';
import { NativeClient } from '../../services/nativeClient';

const SAMPLE_TOOLCHAIN: ToolchainItem[] = [
  { id: 'node', name: 'Node.js', category: 'runtime', installed: true, version: 'v20.11.1', path: 'C:\\Program Files\\nodejs\\node.exe', recommendedVersion: 'v20.x LTS', status: 'healthy' },
  { id: 'npm', name: 'npm', category: 'package_manager', installed: true, version: '10.2.4', path: 'C:\\Program Files\\nodejs\\npm.cmd', status: 'healthy' },
  { id: 'git', name: 'Git', category: 'vcs', installed: true, version: '2.43.0.windows.1', path: 'C:\\Program Files\\Git\\cmd\\git.exe', status: 'healthy' },
  { id: 'python', name: 'Python', category: 'runtime', installed: true, version: '3.11.8', path: 'C:\\Users\\User\\AppData\\Local\\Programs\\Python\\Python311\\python.exe', recommendedVersion: '3.11.x', status: 'healthy' },
  { id: 'rust', name: 'Rust (rustc)', category: 'compiler', installed: true, version: '1.77.0', path: 'C:\\Users\\User\\.cargo\\bin\\rustc.exe', status: 'healthy' },
  { id: 'cargo', name: 'Cargo', category: 'package_manager', installed: true, version: '1.77.0', path: 'C:\\Users\\User\\.cargo\\bin\\cargo.exe', status: 'healthy' },
  { id: 'docker', name: 'Docker Desktop', category: 'container', installed: false, recommendedVersion: 'v25.x', status: 'missing' },
  { id: 'dotnet', name: '.NET SDK', category: 'runtime', installed: true, version: '8.0.201', path: 'C:\\Program Files\\dotnet\\dotnet.exe', status: 'healthy' },
];

const SAMPLE_PORTS: ActivePortProcess[] = [
  { pid: 3000, processName: 'node.exe', port: 3000, protocol: 'TCP', state: 'LISTEN', commandLine: 'node server.js' },
  { pid: 5173, processName: 'vite.exe', port: 5173, protocol: 'TCP', state: 'LISTEN', commandLine: 'vite --port 5173' },
  { pid: 5432, processName: 'postgres.exe', port: 5432, protocol: 'TCP', state: 'LISTEN', commandLine: 'postgres -D data' },
  { pid: 6379, processName: 'redis-server.exe', port: 6379, protocol: 'TCP', state: 'LISTEN', commandLine: 'redis-server' },
];

export function useDeveloperStore() {
  const [toolchains, setToolchains] = useState<ToolchainItem[]>(SAMPLE_TOOLCHAIN);
  const [activePorts, setActivePorts] = useState<ActivePortProcess[]>(SAMPLE_PORTS);
  const [activeTab, setActiveTab] = useState<'overview' | 'path' | 'git' | 'runtimes' | 'ports' | 'health'>('overview');
  const [isLoading, setIsLoading] = useState(false);

  const refreshDiagnostics = useCallback(async () => {
    setIsLoading(true);
    if (NativeClient.isTauriAvailable()) {
      try {
        const res = await NativeClient.executeModule01Capability('m15_s01', 'm15.environment.discover');
        if (res.status === 'completed' && res.data?.toolchains) {
          setToolchains(res.data.toolchains);
        }
      } catch (err) {
        console.error('Environment discover error:', err);
      } finally {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  const killProcessByPort = useCallback(async (port: number) => {
    if (NativeClient.isTauriAvailable()) {
      try {
        await NativeClient.executeModule01Capability('m15_s09', 'm15.process.control', { action: 'kill_port', port });
      } catch (err) {
        console.error('Kill port error:', err);
      }
    }
    setActivePorts(prev => prev.filter(p => p.port !== port));
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
