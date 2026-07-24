/**
 * KNOUX ONE — Module 18: Hardware & Device Health View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const HardwareHealthView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm18');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={18}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
