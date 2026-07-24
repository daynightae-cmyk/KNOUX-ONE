import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const ApplicationsStoreView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm12');
  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={12}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
