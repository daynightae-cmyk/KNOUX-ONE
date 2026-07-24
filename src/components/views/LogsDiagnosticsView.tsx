/**
 * KNOUX ONE — Module 17: Logs & Diagnostics View
 */

import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const LogsDiagnosticsView: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm17');

  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={17}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
