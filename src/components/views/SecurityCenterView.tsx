/**
 * KNOUX ONE - Module 10: Security Center View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';
import { SecurityStatusPanels } from '../../features/security/SecurityStatusPanels';
import { NativeClient } from '../../services/nativeClient';

export const SecurityCenterView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm10');

  if (!moduleData) return null;

  return (
    <>
      <SecurityStatusPanels available={NativeClient.isTauriAvailable()} />
      <UniversalServiceWorkspace
        moduleNumber={10}
        moduleNameEn={moduleData.nameEn}
        moduleNameAr={moduleData.nameAr}
        descriptionEn={moduleData.descriptionEn}
        descriptionAr={moduleData.descriptionAr}
        capabilities={moduleData.services}
      />
    </>
  );
};
