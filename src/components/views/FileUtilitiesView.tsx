/**
 * KNOUX ONE — Module 13: File Utilities View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const FileUtilitiesView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm13');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={13}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
