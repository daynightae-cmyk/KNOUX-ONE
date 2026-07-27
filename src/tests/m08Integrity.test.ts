import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const main = fs.readFileSync(path.resolve('src-tauri/src/main.rs'), 'utf8');
const native = fs.readFileSync(path.resolve('src-tauri/src/network_optimizer/mod.rs'), 'utf8');
const workspace = fs.readFileSync(path.resolve('src/features/network/NetworkOptimizerWorkspace.tsx'), 'utf8');
const view = fs.readFileSync(path.resolve('src/components/views/NetworkOptimizerView.tsx'), 'utf8');

const handlers = {
  'm08.adapters.inspect': 'm08_adapter_inventory',
  'm08.ip.inspect': 'm08_ip_configuration',
  'm08.ping.test': 'm08_ping_test',
  'm08.traceroute.run': 'm08_traceroute',
  'm08.dns.benchmark': 'm08_dns_benchmark',
  'm08.dns.flush': 'm08_flush_dns',
  'm08.ip.renew': 'm08_renew_ip',
  'm08.stack.reset': 'm08_stack_reset',
  'm08.proxy_firewall.inspect': 'm08_proxy_firewall_status',
  'm08.report.export': 'm08_report_export',
} as const;

describe('Module 08 network and internet completion gate', () => {
  it('publishes ten implemented services and honest global totals', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm08');
    expect(module).toBeDefined();
    expect(module!.services).toHaveLength(10);
    expect(module!.services.every(service => service.status === 'available')).toBe(true);
    expect(module!.services.every(service => service.implementationState === 'implemented')).toBe(true);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(80);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(110);
  });

  it('maps every service to one explicit registered Rust command', () => {
    for (const [handler, command] of Object.entries(handlers)) {
      expect(NATIVE_COMMANDS[handler as keyof typeof NATIVE_COMMANDS], handler).toBe(command);
      expect(main, command).toContain(`network_optimizer::${command}`);
      expect(native, command).toContain(`pub fn ${command}`);
    }
  });

  it('uses real bounded Windows network evidence', () => {
    expect(native).toContain('Get-CimInstance Win32_NetworkAdapter');
    expect(native).toContain('Get-NetIPConfiguration');
    expect(native).toContain('System.Net.NetworkInformation.Ping');
    expect(native).toContain('tracert.exe');
    expect(native).toContain('Resolve-DnsName');
    expect(native).toContain('/flushdns');
    expect(native).toContain('/release');
    expect(native).toContain('/renew');
    expect(native).toContain('winsock');
    expect(native).toContain('Get-NetFirewallProfile');
    expect(native).toContain('winhttp');
    expect(native).toContain('network-report-');
  });

  it('enforces input validation and disruptive-action confirmation', () => {
    expect(native).toContain('validate_target');
    expect(native).toContain('RENEW IP LEASE');
    expect(native).toContain('RESET NETWORK STACK');
    expect(native).toContain('.clamp(1, 10)');
    expect(native).toContain('.clamp(1, 30)');
    expect(native).not.toContain('Set-DnsClientServerAddress');
    expect(native).not.toContain('Set-NetFirewallProfile');
    expect(native).not.toContain('Remove-NetFirewallRule');
    expect(native).not.toContain('Math.random');
    expect(native).not.toContain('setTimeout(');
  });

  it('uses a dedicated understandable Arabic and English workspace', () => {
    expect(view).toContain('NetworkOptimizerWorkspace');
    expect(view).not.toContain('UniversalServiceWorkspace');
    expect(workspace).toContain('إصلاح وتحسين الإنترنت');
    expect(workspace).toContain('تجديد عنوان IP');
    expect(workspace).toContain('إعادة ضبط الشبكة');
    expect(workspace).toContain('فحص البروكسي والجدار');
    expect(workspace).not.toContain('Math.random');
    expect(workspace).not.toContain('setTimeout(');
  });
});
