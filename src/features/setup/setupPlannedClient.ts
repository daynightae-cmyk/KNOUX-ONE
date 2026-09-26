import type { OperationResult } from '../../types';
import { NativeClient } from '../../services/nativeClient';
import type {
  CatalogFilter,
  CatalogScope,
  EssentialCatalogReport,
  InventoryFormat,
  PostFormatProfile,
  PostFormatProfileList,
  ProfileStep,
  WingetRepairGuidance,
  WingetRepairScope,
  WingetRepairTarget,
} from './setupPlannedContracts';

/**
 * Clients for the M01 planned services that now have a real native command.
 *
 * M01-S03 is named "repair guidance", so there is deliberately no `repair()` call here:
 * the only thing the UI can do is read the diagnosis and show the literal commands for
 * the user to run themselves.
 */
export const setupPlannedClient = {
  runtimeState: () => NativeClient.getRuntimeState(),

  wingetRepairGuidance(
    scope: WingetRepairScope,
    repairTarget: WingetRepairTarget,
  ): Promise<OperationResult<WingetRepairGuidance>> {
    return NativeClient.executeCapability<WingetRepairGuidance>('m01_s03', 'm01.winget.repair', {
      request: { scope, repairTarget },
    });
  },

  essentialCatalog(
    scope: CatalogScope,
    filter: CatalogFilter,
    verifyPackageIds: boolean,
  ): Promise<OperationResult<EssentialCatalogReport>> {
    return NativeClient.executeCapability<EssentialCatalogReport>('m01_s04', 'm01.catalog.essential', {
      request: { scope, filter, verifyPackageIds },
    });
  },

  exportInventory(
    format: InventoryFormat,
    options: {
      includeVersion: boolean;
      includeInstallPath: boolean;
      destinationDirectory?: string;
      fileName?: string;
    },
  ): Promise<OperationResult<import('./setupPlannedContracts').InventoryExport>> {
    return NativeClient.executeCapability('m01_s07', 'm01.apps.inventory.export', {
      request: { format, ...options },
    });
  },

  createPostFormatProfile(input: {
    profileName: string;
    targetPaths: string[];
    steps: ProfileStep[];
    runAfterFormatScan: boolean;
    intervalDays?: number | null;
  }): Promise<OperationResult<PostFormatProfile>> {
    return NativeClient.executeCapability<PostFormatProfile>('m01_s08', 'm01.profiles.postformat.create', {
      request: input,
    });
  },

  postFormatProfiles(): Promise<OperationResult<PostFormatProfileList>> {
    return NativeClient.executeCapability<PostFormatProfileList>('m01_s08', 'm01.profiles.postformat.list');
  },
};
