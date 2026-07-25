/**
 * KNOUX ONE — Operation Lifecycle Manager
 * Strict honesty: no fake simulation loops or simulated success states.
 */
import { KnouxCapability, OperationResult } from '../types';
import { NativeClient } from './nativeClient';

export class OperationService {
  static getCapabilityPreview(capability: KnouxCapability): {
    readsEn: string; readsAr: string; changesEn: string; changesAr: string;
    requiresElevation: boolean; estimatedTime: string;
  } {
    return {
      readsEn: capability.readsEn || `Scans local system registry, file headers, and configuration states for ${capability.nameEn}.`,
      readsAr: capability.readsAr || `يفحص سجلات النظام ومسارات التخزين الخاصة بـ ${capability.nameAr}.`,
      changesEn: capability.changesEn || `Modifies targeted system settings and caches according to ${capability.nameEn} parameters.`,
      changesAr: capability.changesAr || `يحدث إعدادات النظام المحددة لـ ${capability.nameAr}.`,
      requiresElevation: capability.requiresAdmin,
      estimatedTime: capability.riskLevel === 'high' ? '1-3 minutes' : '< 10 seconds',
    };
  }

  static async executeCapability(capability: KnouxCapability, onProgress?: (progress: number, logMessage: string) => void): Promise<OperationResult> {
    const startedAt = new Date().toISOString();
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const handlerId = capability.handlerId;
    onProgress?.(0, `[INIT] Preparing execution for ${capability.nameEn} (${capability.id})...`);

    if (!handlerId || capability.implementationState === 'planned') {
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'planned', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 0, summaryEn: capability.availabilityReasonEn || 'Native implementation scheduled for subsequent phase.', summaryAr: capability.availabilityReasonAr || 'المحرك المحلي لهذه الخدمة مخطط له في المرحلة التالية.', warnings: ['Capability execution disabled: planned capability.'], errorCode: 'capability_planned' };
    }

    if (!NativeClient.isTauriAvailable()) {
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'unavailable', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, stderr: 'Desktop runtime unavailable. Native operations require KNOUX ONE Desktop container.', summaryEn: 'Desktop runtime unavailable. Open KNOUX ONE Desktop to execute native commands.', summaryAr: 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لتشغيل العمليات المحلية.', warnings: ['Web preview environment detected. Native execution disabled.'], errorCode: 'desktop_runtime_unavailable' };
    }

    onProgress?.(10, `Invoking native handler ${handlerId}...`);
    try {
      const result = await NativeClient.executeCapability(capability.id, handlerId);
      onProgress?.(100, `Native operation completed with status: ${result.status}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(100, `Native operation failed: ${message}`);
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'failed', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, summaryEn: `Native command execution failed: ${message}`, summaryAr: `فشلت عملية التنفيذ المحلية: ${message}`, warnings: [message], errorCode: 'native_execution_failed' };
    }
  }
}
