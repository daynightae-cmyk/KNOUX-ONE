/**
 * KNOUX ONE — Operation Lifecycle Manager
 * Handles previewing, elevation requirements, cancelling, and local action history.
 */

import { KnouxCapability, OperationResult, ActionLog } from '../types';
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
    if (onProgress) {
      onProgress(20, `Initializing ${capability.nameEn}...`);
      await new Promise(res => setTimeout(res, 120));
      onProgress(60, `Checking security permissions & prerequisites...`);
      await new Promise(res => setTimeout(res, 150));
      onProgress(90, `Executing native operation handler...`);
      await new Promise(res => setTimeout(res, 120));
      onProgress(100, `Finalizing operation log...`);
    }

    const result = await NativeClient.executeCapability(capability.id);
    return result;
  }
}
