import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';
import { PrivacyStatusPanels } from '../../features/privacy/PrivacyStatusPanels';
import { NativeClient } from '../../services/nativeClient';

export const PrivacyTelemetryView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm09');
  if (!moduleData) return null;

  return (
    <>
      <PrivacyStatusPanels available={NativeClient.isTauriAvailable()} />
      <UniversalServiceWorkspace
        moduleNumber={9}
        moduleNameEn={moduleData.nameEn}
        moduleNameAr={moduleData.nameAr}
        descriptionEn={moduleData.descriptionEn}
        descriptionAr={moduleData.descriptionAr}
        capabilities={moduleData.services}
      />
    </>
  );
};
