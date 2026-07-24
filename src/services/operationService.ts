/**
 * KNOUX ONE — Operation Lifecycle Manager
 * Handles previewing, elevation requirements, cancelling, and local action history.
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
   * Runs capability execution through NativeClient and logs result
   */
  static async executeCapability(
    capability: KnouxCapability,
    onProgress?: (progress: number, logMessage: string) => void
  ): Promise<OperationResult> {
    const startedAt = new Date().toISOString();
    const opId = `op_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Check if capability has an actual implemented handlerId
    if (!capability.handlerId || capability.implementationState !== 'implemented') {
      if (onProgress) {
        onProgress(0, `Capability ${capability.id} is currently planned.`);
      }

      return {
        operationId: opId,
        capabilityId: capability.id,
        handlerId: capability.handlerId || 'none',
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

    if (onProgress) {
      onProgress(0, `Starting native handler for ${capability.nameEn}...`);
    }

    const result = await NativeClient.executeModule01Capability(
      capability.id,
      capability.handlerId
    );

    if (onProgress) {
      onProgress(100, `Operation completed with status: ${result.status}`);
    }

    return result;
  }
}
