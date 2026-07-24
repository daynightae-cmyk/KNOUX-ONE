import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const FirstRunView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm01');
  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={1}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
