import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const native = fs.readFileSync(path.resolve('src-tauri/src/performance_center/mod.rs'), 'utf8');
const workspace = fs.readFileSync(path.resolve('src/features/performance/PerformanceCenterWorkspace.tsx'), 'utf8');
const view = fs.readFileSync(path.resolve('src/components/views/PerformanceCenterView.tsx'), 'utf8');

const handlers = {
  'm06.cpu.monitor': 'm06_cpu_monitor',
  'm06.memory.monitor': 'm06_memory_monitor',
  'm06.disk.activity': 'm06_disk_activity',
  'm06.network.activity': 'm06_network_activity',
  'm06.process.explorer': 'm06_process_explorer',
  'm06.process.heavy': 'm06_heavy_processes',
  'm06.priority.manage': 'm06_priority_manage',
  'm06.power.manage': 'm06_power_plans_manage',
  'm06.profiles.manage': 'm06_profiles_manage',
  'm06.benchmark.report': 'm06_benchmark_report',
} as const;

describe('Module 06 performance center completion gate', () => {
  it('publishes exactly ten implemented Module 06 services and honest global totals', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm06');
    expect(module).toBeDefined();
    expect(module!.services).toHaveLength(10);
    expect(module!.services.every(service => service.implementationState === 'implemented')).toBe(true);
    expect(module!.services.every(service => service.status === 'available')).toBe(true);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(60);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(130);
  });

  it('maps each service to an explicit registered Rust command', () => {
    for (const [handler, command] of Object.entries(handlers)) {
      expect(NATIVE_COMMANDS[handler as keyof typeof NATIVE_COMMANDS], handler).toBe(command);
      expect(main, command).toContain(`performance_center::${command}`);
      expect(native, command).toContain(`pub fn ${command}`);
    }
  });

  it('uses real Windows performance and process evidence', () => {
    expect(native).toContain('Win32_PerfFormattedData_PerfOS_Processor');
    expect(native).toContain('Win32_PerfFormattedData_PerfOS_Memory');
    expect(native).toContain('Win32_PerfFormattedData_PerfDisk_PhysicalDisk');
    expect(native).toContain('Win32_PerfFormattedData_Tcpip_NetworkInterface');
    expect(native).toContain('Get-NetTCPConnection');
    expect(native).toContain('Get-CimInstance Win32_Process');
    expect(native).toContain('Get-Process');
    expect(native).toContain('Start-Sleep -Milliseconds');
  });

  it('protects system processes and journals reversible changes', () => {
    expect(native).toContain('protected_process_priority_change_blocked');
    expect(native).toContain('unsupported_priority_or_realtime_blocked');
    expect(native).toContain('pid_reused_by_different_process');
    expect(native).toContain('format!("PRIORITY {pid}")');
    expect(native).toContain('RESTORE PRIORITY');
    expect(native).toContain('priority-changes.json');
    expect(native).toContain('power-changes.json');
    expect(native).toContain('CHANGE POWER PLAN');
    expect(native).toContain('RESTORE POWER PLAN');
    expect(native).toContain('powercfg.exe');
    expect(native).not.toContain('RealTime');
  });

  it('keeps profiles transparent and the benchmark bounded', () => {
    expect(native).toContain('profiles.json');
    expect(native).toContain('active-profile.json');
    expect(native).toContain('APPLY PROFILE');
    expect(native).toContain('DELETE PROFILE');
    expect(native).toContain('8 * 1024 * 1024u64');
    expect(native).toContain('Sha256::new');
    expect(native).toContain('temporary_file_removed');
    expect(native).toContain('fs::remove_file');
    expect(native).toContain('not a universal hardware score');
  });

  it('uses a dedicated workspace and only polls real native measurements', () => {
    expect(view).toContain('PerformanceCenterWorkspace');
    expect(view).not.toContain('UniversalServiceWorkspace');
    expect(workspace).toContain('performanceClient.cpu()');
    expect(workspace).toContain('performanceClient.memory()');
    expect(workspace).toContain('performanceClient.disk()');
    expect(workspace).toContain('performanceClient.network()');
    expect(workspace).toContain('performanceClient.heavyProcesses()');
    expect(workspace).toContain('window.setInterval');
    expect(workspace).not.toContain('setTimeout');
    expect(workspace).not.toContain('Math.random');
    expect(native).not.toContain('Math.random');
    expect(native).not.toContain('setTimeout');
  });
});
