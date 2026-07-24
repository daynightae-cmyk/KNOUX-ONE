/**
 * KNOUX ONE — Module 10: Security Center View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const SecurityCenterView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm10');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={10}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
