import React from 'react';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';

export const DeveloperSuiteView: React.FC = () => {
  const module = MODULES_CATALOG.find(item => item.id === 'm15');
  if (!module) return null;
  return (
    <UniversalServiceWorkspace
      moduleNumber={module.number}
      moduleNameEn={module.nameEn}
      moduleNameAr={module.nameAr}
      descriptionEn={module.descriptionEn}
      descriptionAr={module.descriptionAr}
      capabilities={module.services}
    />
  );
};
