/**
 * KNOUX ONE — Operation Lifecycle Manager
 * Handles previewing, elevation requirements, and native execution contracts.
 * Strict honesty: No fake simulation loops or simulated success states.
 */
import { KnouxCapability, OperationResult } from '../types';
import { NativeClient } from './nativeClient';

export class OperationService {
  /**
   * Generates a preview result for a capability
   */
  static getCapabilityPreview(capability: KnouxCapability): {
    readsEn: string;
    readsAr: string;
    changesEn: string;
    changesAr: string;
    requiresElevation: boolean;
    estimatedTime: string;
  } {
    return {
      readsEn: capability.readsEn || `Scans local system registry, file headers, and configuration states for ${capability.nameEn}.`,
      readsAr: capability.readsAr || `يفحص سجلات النظام ومسارات التخزين الخاصة بـ ${capability.nameAr}.`,
      changesEn: capability.changesEn || `Modifies targeted system settings and caches according to ${capability.nameEn} parameters.`,
      changesAr: capability.changesAr || `يحدث إعدادات النظام المحددة لـ ${capability.nameAr}.`,
      requiresElevation: capability.requiresAdmin,
      estimatedTime: capability.riskLevel === 'high' ? '1-3 minutes' : '< 10 seconds'
    };
  }

  /**
   * Runs capability execution through NativeClient or returns desktop_runtime_unavailable in web preview.
   */
  static async executeCapability(
    capability: KnouxCapability,
    onProgress?: (progress: number, logMessage: string) => void
  ): Promise<OperationResult> {
    const startedAt = new Date().toISOString();
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const handlerId = capability.handlerId || capability.id.replace('_', '.');

    if (onProgress) {
      onProgress(0, `[INIT] Preparing execution for ${capability.nameEn} (${capability.id})...`);
    }

    if (!capability.handlerId || capability.implementationState === 'planned') {
      if (onProgress) {
        onProgress(0, `Capability ${capability.id} is currently planned for a future phase.`);
      }
      return {
        operationId: opId,
        capabilityId: capability.id,
        handlerId,
        status: 'planned',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        requiresRestart: false,
        exitCode: 0,
        summaryEn: capability.availabilityReasonEn || 'Native implementation scheduled for subsequent phase.',
        summaryAr: capability.availabilityReasonAr || 'المحرك المحلي لهذه الخدمة مخطط له في المرحلة التالية.',
        warnings: ['Capability execution disabled: planned capability.'],
        errorCode: 'capability_planned'
      };
    }

    // Check if running in Desktop Tauri runtime
    if (!NativeClient.isTauriAvailable()) {
      if (onProgress) {
        onProgress(0, `Desktop runtime unavailable in web preview environment.`);
      }
      return {
        operationId: opId,
        capabilityId: capability.id,
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

    // Execute via Native Tauri Bridge
    if (onProgress) {
      onProgress(10, `Invoking native handler ${handlerId}...`);
    }

    try {
      const result = await NativeClient.executeModule01Capability(capability.id, handlerId);
      if (onProgress) {
        onProgress(100, `Native operation completed with status: ${result.status}`);
      }
      return result;
    } catch (err: any) {
      if (onProgress) {
        onProgress(100, `Native operation failed: ${err.message || 'Unknown native error'}`);
      }
      return {
        operationId: opId,
        capabilityId: capability.id,
        handlerId,
        status: 'failed',
        startedAt,
        completedAt: new Date().toISOString(),
        durationMs: 0,
        requiresRestart: false,
        exitCode: 1,
        summaryEn: `Native command execution failed: ${err.message || 'Unknown error'}`,
        summaryAr: `فشلت عملية التنفيذ المحلية: ${err.message || 'خطأ غير معروف'}`,
        warnings: [err.toString()],
        errorCode: 'native_execution_failed',
      };
    }
  }
}
