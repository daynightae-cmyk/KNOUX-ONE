/**
 * KNOUX ONE — Typed Native Client Bridge
 * Strict allowlist: no dynamic handler-to-command construction.
 */
import { invoke } from '@tauri-apps/api/core';
import type { OperationResult } from '../types';
import { resolveNativeCommand } from './nativeCommandRegistry';

export interface NativeRuntimeState {
  available: boolean;
  platform: 'tauri_desktop' | 'web_preview';
  reasonEn?: string;
  reasonAr?: string;
}

export type NativeCapabilityData = Record<string, unknown>;
export type NativeCapabilityResult<T = NativeCapabilityData> = OperationResult<T>;

function operationId(): string {
  const suffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `op_${Date.now()}_${suffix}`;
}

export class NativeClient {
  static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  static getRuntimeState(): NativeRuntimeState {
    const available = this.isTauriAvailable();
    return {
      available,
      platform: available ? 'tauri_desktop' : 'web_preview',
      reasonEn: available ? undefined : 'Desktop runtime unavailable. Open KNOUX ONE Desktop to read this device.',
      reasonAr: available ? undefined : 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لقراءة بيانات هذا الجهاز.',
    };
  }

  static async invokeNative<T>(commandName: string, args: Record<string, unknown> = {}): Promise<T> {
    if (!this.isTauriAvailable()) throw new Error('desktop_runtime_unavailable');
    return invoke<T>(commandName, args);
  }

  static async invokeHandler<T>(handlerId: string, args: Record<string, unknown> = {}): Promise<T> {
    const commandName = resolveNativeCommand(handlerId);
    if (!commandName) throw new Error(`unsupported_handler:${handlerId}`);
    return this.invokeNative<T>(commandName, args);
  }

  static async executeCapability<T = NativeCapabilityData>(capabilityId: string, handlerId: string, parameters: Record<string, unknown> = {}): Promise<NativeCapabilityResult<T>> {
    const startedAt = new Date().toISOString();
    const opId = operationId();
    const commandName = resolveNativeCommand(handlerId);

    if (!commandName) {
      return { operationId: opId, capabilityId, handlerId, status: 'unsupported', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, summaryEn: `No allowlisted native command is registered for ${handlerId}.`, summaryAr: `لا يوجد أمر محلي مسموح ومسجل للمعالج ${handlerId}.`, warnings: [], errorCode: 'unsupported_handler' };
    }

    if (!this.isTauriAvailable()) {
      return { operationId: opId, capabilityId, handlerId, status: 'unavailable', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, stderr: 'Desktop runtime unavailable.', summaryEn: 'Desktop runtime unavailable. Open KNOUX ONE Desktop to execute native commands.', summaryAr: 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لتشغيل العمليات المحلية.', warnings: ['Web preview environment detected. Native execution disabled.'], errorCode: 'desktop_runtime_unavailable' };
    }

    try {
      return await this.invokeNative<NativeCapabilityResult<T>>(commandName, { opId, ...parameters });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { operationId: opId, capabilityId, handlerId, status: 'failed', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, summaryEn: `Native command ${commandName} failed: ${message}`, summaryAr: `فشل الأمر المحلي ${commandName}: ${message}`, warnings: [message], errorCode: 'native_execution_failed' };
    }
  }

  /** Backward-compatible alias while legacy modules are migrated. */
  static executeModule01Capability<T = NativeCapabilityData>(capabilityId: string, handlerId: string, parameters: Record<string, unknown> = {}): Promise<NativeCapabilityResult<T>> {
    return this.executeCapability<T>(capabilityId, handlerId, parameters);
  }
}
