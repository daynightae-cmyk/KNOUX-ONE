import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { PARTIAL_SERVICE_IDS } from '../data/serviceVerification';
import type { ImplementationState, KnouxCapability, RiskLevel } from '../types';
import { resolveNativeCommand } from './nativeCommandRegistry';
import { getWorkspaceForModule } from '../shell/workspaceRegistry';

export interface ServicePresentation {
  id: string;
  moduleId: string;
  route: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  state: ImplementationState;
  risk: RiskLevel;
  requiresAdmin: boolean;
  executable: boolean;
  handlerId?: string;
  nativeCommand?: string;
  supportsCancel: boolean;
  supportsUndo: boolean;
  supportsQuarantine: boolean;
  availabilityReasonEn?: string;
  availabilityReasonAr?: string;
}

export function getServiceEvidenceState(service: KnouxCapability): ImplementationState {
  return PARTIAL_SERVICE_IDS.has(service.id) ? 'partial' : service.implementationState ?? 'planned';
}

export function presentService(service: KnouxCapability): ServicePresentation {
  const state = getServiceEvidenceState(service);
  const nativeCommand = service.handlerId ? resolveNativeCommand(service.handlerId) ?? undefined : undefined;
  return {
    id: service.id,
    moduleId: service.moduleId,
    route: getWorkspaceForModule(service.moduleId)?.route ?? 'catalog',
    titleEn: service.nameEn,
    titleAr: service.nameAr,
    descriptionEn: service.descriptionEn,
    descriptionAr: service.descriptionAr,
    state,
    risk: service.riskLevel,
    requiresAdmin: service.requiresAdmin,
    executable: service.implementationState === 'implemented' && service.status === 'available' && Boolean(nativeCommand),
    handlerId: service.handlerId,
    nativeCommand,
    supportsCancel: service.supportsCancel,
    supportsUndo: service.supportsUndo,
    supportsQuarantine: service.supportsQuarantine,
    availabilityReasonEn: service.availabilityReasonEn,
    availabilityReasonAr: service.availabilityReasonAr,
  };
}

export const SERVICE_PRESENTATIONS = ALL_CAPABILITIES.map(presentService);

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function searchServices(query: string, state: ImplementationState | 'all' = 'all'): ServicePresentation[] {
  const needle = normalize(query);
  return SERVICE_PRESENTATIONS.filter(service => {
    if (state !== 'all' && service.state !== state) return false;
    if (!needle) return true;
    const module = MODULES_CATALOG.find(item => item.id === service.moduleId);
    return [
      service.id, service.titleEn, service.titleAr, service.descriptionEn, service.descriptionAr,
      module?.nameEn ?? '', module?.nameAr ?? '', module?.descriptionEn ?? '', module?.descriptionAr ?? '',
    ].some(value => normalize(value).includes(needle));
  });
}
