/**
 * KNOUX ONE — Native Client Bridge
 * Allowlisted Tauri IPC commands and Native Execution Contract bridge.
 */

import { OperationResult } from '../types';
import { invoke } from '@tauri-apps/api/core';

export interface NativeRuntimeState {
  available: boolean;
  platform: string;
  reasonEn?: string;
  reasonAr?: string;
}

export type NativeCapabilityData = Record<string, any>;
export type NativeCapabilityResult = OperationResult<NativeCapabilityData>;

export class NativeClient {
  /**
   * Check if running inside real Tauri desktop environment
   */
  static isTauriAvailable(): boolean {
    return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
  }

  static getRuntimeState(): NativeRuntimeState {
    const available = this.isTauriAvailable();
    return {
      available,
      platform: available ? 'tauri_desktop' : 'web_preview',
      reasonEn: available ? undefined : 'Desktop runtime unavailable. Open KNOUX ONE Desktop to read this device.',
      reasonAr: available ? undefined : 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لقراءة بيانات هذا الجهاز.'
    };
  }

  /**
   * Safe Tauri invoke helper with typed payload using official @tauri-apps/api/core
   */
  static async invokeNative<T>(cmd: string, args: Record<string, unknown> = {}): Promise<T> {
    if (this.isTauriAvailable()) {
      try {
        return await invoke<T>(cmd, args);
      } catch (err: any) {
        console.warn(`[Tauri Native Error] ${cmd}:`, err);
        throw err;
      }
    }
    throw new Error('desktop_runtime_unavailable');
  }

  /**
   * Execute explicit Module 01 capability handler
   */
  static async executeModule01Capability(
    capabilityId: string,
    handlerId: string,
    parameters: Record<string, any> = {},
  ): Promise<NativeCapabilityResult> {
    const startedAt = new Date().toISOString();
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (!this.isTauriAvailable()) {
      return {
        operationId: opId,
        capabilityId,
        handlerId,
        status: 'unavailable',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        requiresRestart: false,
        exitCode: 1,
        stdout: undefined,
        stderr: 'Desktop runtime unavailable. Native operations require KNOUX ONE Desktop container.',
        summaryEn: 'Desktop runtime unavailable. Open KNOUX ONE Desktop to execute native commands.',
        summaryAr: 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لتشغيل العمليات المحلية.',
        warnings: ['Web preview environment detected. Native execution disabled.'],
        errorCode: 'desktop_runtime_unavailable',
      };
    }

    const commandName = handlerId.replace(/\./g, '_');

    try {
      return await this.invokeNative<NativeCapabilityResult>(commandName, { op_id: opId, ...parameters });
    } catch (err: any) {
      return {
        operationId: opId,
        capabilityId,
        handlerId,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        requiresRestart: false,
        exitCode: 1,
        summaryEn: `Native command ${commandName} failed: ${err.message || 'Unknown error'}`,
        summaryAr: `فشلت العملية المحلية ${commandName}: ${err.message || 'خطأ غير معروف'}`,
        warnings: [err.toString()],
        errorCode: 'native_execution_failed',
      };
    }
  }
}
