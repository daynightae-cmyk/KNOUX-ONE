/**
 * KNOUX ONE — Module 16: Code & Project Tools View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const CodeProjectToolsView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm16');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={16}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
