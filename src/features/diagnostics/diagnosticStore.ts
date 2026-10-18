/**
 * KNOUX ONE — Module 17 Logs & Diagnostics Store
 *
 * Every action calls a native handler through the capability registry and keeps
 * only measured evidence. Exports assemble the sections that were actually read
 * in this session: nothing is invented, and an export with no evidence is sent
 * as an empty object the native side will hash and store as-is.
 */

import { useCallback, useMemo, useState } from 'react';
import { NativeClient } from '../../services/nativeClient';
import type {
  BsodTriageResult,
  CrashCorrelationResult,
  DiagnosticExportFormat,
  DiagnosticExportResult,
  DiagnosticStoreError,
  EventQueryResult,
  HardwareWarningsResult,
  NetworkDiagnosticsResult,
  ReliabilityResult,
  ServiceDiagnosticsResult,
  UpdateDiagnosticsResult,
} from './diagnosticContracts';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useDiagnosticStore() {
  const runtime = useMemo(() => NativeClient.getRuntimeState(), []);
  const [events, setEvents] = useState<EventQueryResult | null>(null);
  const [crashes, setCrashes] = useState<CrashCorrelationResult | null>(null);
  const [bsod, setBsod] = useState<BsodTriageResult | null>(null);
  const [reliability, setReliability] = useState<ReliabilityResult | null>(null);
  const [services, setServices] = useState<ServiceDiagnosticsResult | null>(null);
  const [updates, setUpdates] = useState<UpdateDiagnosticsResult | null>(null);
  const [hardware, setHardware] = useState<HardwareWarningsResult | null>(null);
  const [network, setNetwork] = useState<NetworkDiagnosticsResult | null>(null);
  const [exportResult, setExportResult] = useState<DiagnosticExportResult | null>(null);
  const [collectedSections, setCollectedSections] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState<DiagnosticStoreError | null>(null);

  const requireDesktop = useCallback(() => {
    if (runtime.available) return true;
    setError({
      code: 'desktop_runtime_unavailable',
      message: runtime.reasonEn ?? 'Open KNOUX ONE Desktop to read local Windows diagnostics.',
    });
    return false;
  }, [runtime]);

  const run = useCallback(
    async <T,>(
      action: string,
      capabilityId: string,
      handlerId: string,
      parameters: Record<string, unknown>,
    ): Promise<T | null> => {
      if (!requireDesktop()) return null;
      setLoadingAction(action);
      setError(null);
      try {
        const result = await NativeClient.executeCapability<T>(capabilityId, handlerId, parameters);
        if ((result.status === 'completed' || result.status === 'completed_with_warnings') && result.data) {
          if (result.warnings.length) {
            setError({ code: 'completed_with_warnings', message: result.warnings.join('\n') });
          }
          return result.data;
        }
        setError({ code: result.errorCode ?? result.status, message: result.summaryEn });
        return null;
      } catch (cause) {
        setError({ code: 'native_execution_failed', message: errorMessage(cause) });
        return null;
      } finally {
        setLoadingAction(null);
      }
    },
    [requireDesktop],
  );

  const markCollected = useCallback((section: string) => {
    setCollectedSections(previous => (previous.includes(section) ? previous : [...previous, section]));
  }, []);

  const buildEvidence = useCallback((): Record<string, unknown> => {
    const evidence: Record<string, unknown> = {};
    if (events) evidence.events = events;
    if (crashes) evidence.crashCorrelation = crashes;
    if (bsod) evidence.bsodTriage = bsod;
    if (reliability) evidence.reliability = reliability;
    if (services) evidence.serviceDiagnostics = services;
    if (updates) evidence.updateDiagnostics = updates;
    if (hardware) evidence.hardwareWarnings = hardware;
    if (network) evidence.networkDiagnostics = network;
    return evidence;
  }, [events, crashes, bsod, reliability, services, updates, hardware, network]);

  const queryEvents = useCallback(
    async (hours = 72, limit = 250, channels: string[] = [], levels: number[] = []) => {
      const data = await run<EventQueryResult>('events', 'm17_s01', 'm17.events.query', {
        request: { hours, limit, channels, providers: [], levels },
      });
      if (data) {
        setEvents(data);
        markCollected('events');
      }
      return data;
    },
    [run, markCollected],
  );

  const correlateCrashes = useCallback(
    async (hours = 72, limit = 250) => {
      const data = await run<CrashCorrelationResult>('crashes', 'm17_s02', 'm17.crashes.correlate', {
        request: { hours, limit },
      });
      if (data) {
        setCrashes(data);
        markCollected('crashes');
      }
      return data;
    },
    [run, markCollected],
  );

  const triageBsod = useCallback(
    async (hours = 72, includeMinidumpInventory = true) => {
      const data = await run<BsodTriageResult>('bsod', 'm17_s03', 'm17.bsod.triage', {
        request: { hours, includeMinidumpInventory },
      });
      if (data) {
        setBsod(data);
        markCollected('bsod');
      }
      return data;
    },
    [run, markCollected],
  );

  const loadReliability = useCallback(
    async (hours = 72, limit = 250) => {
      const data = await run<ReliabilityResult>('reliability', 'm17_s04', 'm17.reliability.timeline', {
        request: { hours, limit },
      });
      if (data) {
        setReliability(data);
        markCollected('reliability');
      }
      return data;
    },
    [run, markCollected],
  );

  const diagnoseServices = useCallback(
    async (hours = 72) => {
      const data = await run<ServiceDiagnosticsResult>('services', 'm17_s05', 'm17.services.diagnose', {
        request: { hours },
      });
      if (data) {
        setServices(data);
        markCollected('services');
      }
      return data;
    },
    [run, markCollected],
  );

  const analyzeUpdates = useCallback(
    async (hours = 72, limit = 250) => {
      const data = await run<UpdateDiagnosticsResult>('updates', 'm17_s06', 'm17.updates.analyze', {
        request: { hours, limit },
      });
      if (data) {
        setUpdates(data);
        markCollected('updates');
      }
      return data;
    },
    [run, markCollected],
  );

  const loadHardwareWarnings = useCallback(
    async (hours = 72, limit = 250) => {
      const data = await run<HardwareWarningsResult>('hardware', 'm17_s07', 'm17.hardware.warnings', {
        request: { hours, limit },
      });
      if (data) {
        setHardware(data);
        markCollected('hardware');
      }
      return data;
    },
    [run, markCollected],
  );

  const diagnoseNetwork = useCallback(
    async (hours = 72, target?: string) => {
      const data = await run<NetworkDiagnosticsResult>('network', 'm17_s08', 'm17.network.diagnose', {
        request: { hours, target: target?.trim() ? target.trim() : null },
      });
      if (data) {
        setNetwork(data);
        markCollected('network');
      }
      return data;
    },
    [run, markCollected],
  );

  const exportReport = useCallback(
    async (
      title: string,
      format: DiagnosticExportFormat = 'json',
      redact = true,
      includeSystemSummary = false,
    ) => {
      const data = await run<DiagnosticExportResult>('export-report', 'm17_s10', 'm17.report.export', {
        request: {
          title: title.trim() || 'KNOUX ONE diagnostic report',
          format,
          evidence: buildEvidence(),
          redact,
          includeSystemSummary,
        },
      });
      if (data) setExportResult(data);
      return data;
    },
    [run, buildEvidence],
  );

  const exportBundle = useCallback(
    async (
      title: string,
      redact = true,
      includeSystemSummary = true,
    ) => {
      const data = await run<DiagnosticExportResult>('export-bundle', 'm17_s09', 'm17.bundle.export', {
        request: {
          title: title.trim() || 'KNOUX ONE support bundle',
          format: 'zip',
          evidence: buildEvidence(),
          redact,
          includeSystemSummary,
        },
      });
      if (data) setExportResult(data);
      return data;
    },
    [run, buildEvidence],
  );

  return {
    runtime,
    events,
    crashes,
    bsod,
    reliability,
    services,
    updates,
    hardware,
    network,
    exportResult,
    collectedSections,
    loadingAction,
    error,
    setError,
    queryEvents,
    correlateCrashes,
    triageBsod,
    loadReliability,
    diagnoseServices,
    analyzeUpdates,
    loadHardwareWarnings,
    diagnoseNetwork,
    exportReport,
    exportBundle,
  };
}
