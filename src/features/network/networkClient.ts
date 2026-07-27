import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type { NetworkReport, NetworkRequest } from './networkContracts';

export const networkClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  adapters: (): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s01', 'm08.adapters.inspect'),

  ipConfiguration: (): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s02', 'm08.ip.inspect'),

  ping: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s03', 'm08.ping.test', { request }),

  traceroute: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s04', 'm08.traceroute.run', { request }),

  dnsBenchmark: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s05', 'm08.dns.benchmark', { request }),

  flushDns: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s06', 'm08.dns.flush', { request }),

  renewIp: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s07', 'm08.ip.renew', { request }),

  resetStack: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s08', 'm08.stack.reset', { request }),

  proxyFirewall: (): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s09', 'm08.proxy_firewall.inspect'),

  exportReport: (request: NetworkRequest): Promise<OperationResult<NetworkReport>> =>
    NativeClient.executeCapability('m08_s10', 'm08.report.export', { request }),
};
