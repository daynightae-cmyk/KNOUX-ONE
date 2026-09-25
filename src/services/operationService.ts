/**
 * KNOUX ONE — Operation Lifecycle Manager
 * Strict honesty: no fake simulation loops or simulated success states.
 */
import { KnouxCapability, OperationResult } from '../types';
import { NativeClient } from './nativeClient';

export class OperationService {
  static getCapabilityPreview(capability: KnouxCapability): {
    readsEn: string; readsAr: string; changesEn: string; changesAr: string;
    requiresElevation: boolean;
  } {
    return {
      readsEn: capability.readsEn || 'No additional read-scope metadata is published. Review the verified service description.',
      readsAr: capability.readsAr || 'لا توجد بيانات إضافية منشورة لنطاق القراءة. راجع وصف الخدمة الموثق.',
      changesEn: capability.changesEn || 'No additional change-scope metadata is published. The native contract remains authoritative.',
      changesAr: capability.changesAr || 'لا توجد بيانات إضافية منشورة لنطاق التغيير. يبقى العقد المحلي هو المرجع.',
      requiresElevation: capability.requiresAdmin,
    };
  }

  static async executeCapability(capability: KnouxCapability, onProgress?: (progress: number, logMessage: string) => void): Promise<OperationResult> {
    const startedAt = new Date().toISOString();
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const handlerId = capability.handlerId;
    onProgress?.(-1, `[INIT] Preparing execution for ${capability.nameEn} (${capability.id})...`);

    if (!handlerId || capability.implementationState === 'planned') {
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'planned', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 0, summaryEn: capability.availabilityReasonEn || 'Native implementation scheduled for subsequent phase.', summaryAr: capability.availabilityReasonAr || 'المحرك المحلي لهذه الخدمة مخطط له في المرحلة التالية.', warnings: ['Capability execution disabled: planned capability.'], errorCode: 'capability_planned' };
    }

    if (!NativeClient.isTauriAvailable()) {
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'unavailable', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, stderr: 'Desktop runtime unavailable. Native operations require KNOUX ONE Desktop container.', summaryEn: 'Desktop runtime unavailable. Open KNOUX ONE Desktop to execute native commands.', summaryAr: 'بيئة سطح المكتب غير متاحة. افتح تطبيق KNOUX ONE Desktop لتشغيل العمليات المحلية.', warnings: ['Web preview environment detected. Native execution disabled.'], errorCode: 'desktop_runtime_unavailable' };
    }

    onProgress?.(-1, `Invoking native handler ${handlerId}...`);
    try {
      const result = await NativeClient.executeCapability(capability.id, handlerId);
      onProgress?.(-1, `Native operation completed with status: ${result.status}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onProgress?.(-1, `Native operation failed: ${message}`);
      return { operationId: opId, capabilityId: capability.id, handlerId, status: 'failed', startedAt, completedAt: new Date().toISOString(), durationMs: 0, requiresRestart: false, exitCode: 1, summaryEn: `Native command execution failed: ${message}`, summaryAr: `فشلت عملية التنفيذ المحلية: ${message}`, warnings: [message], errorCode: 'native_execution_failed' };
    }
  }
}
