const fs = require('fs');

function writeView(file, moduleNumber, idString) {
  const code = `import React from 'react';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const ${file.replace('.tsx', '')}: React.FC = () => {
  const moduleData = MODULES_CATALOG.find(m => m.id === '${idString}');
  if (!moduleData) return null;

  return (
    <UniversalServiceWorkspace
      moduleNumber={${moduleNumber}}
      moduleNameEn={moduleData.nameEn}
      moduleNameAr={moduleData.nameAr}
      descriptionEn={moduleData.descriptionEn}
      descriptionAr={moduleData.descriptionAr}
      capabilities={moduleData.services}
    />
  );
};
`;
  fs.writeFileSync(`src/components/views/${file}`, code);
}

writeView('ApplicationsStoreView.tsx', 12, 'm12');
writeView('DeveloperSuiteView.tsx', 15, 'm15');
writeView('DuplicateFinderView.tsx', 3, 'm03');
writeView('NetworkOptimizerView.tsx', 8, 'm08');
writeView('PrivacyTelemetryView.tsx', 9, 'm09');
writeView('SmartCleanupView.tsx', 2, 'm02');
writeView('StorageAnalyzerView.tsx', 4, 'm04');
writeView('SupportPortalView.tsx', 19, 'm19');
writeView('FirstRunView.tsx', 1, 'm01');
writeView('PostFormatView.tsx', 1, 'm01');
