/**
 * KNOUX ONE — Module 06: Performance Center View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const PerformanceCenterView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm06');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={6}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
