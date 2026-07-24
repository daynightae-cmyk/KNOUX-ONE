/**
 * KNOUX ONE — Module 14: Automation & Productivity View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const AutomationProductivityView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm14');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={14}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
