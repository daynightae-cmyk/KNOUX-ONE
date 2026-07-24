/**
 * KNOUX ONE — Module 11: Backup & Recovery View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const BackupRecoveryView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm11');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={11}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
