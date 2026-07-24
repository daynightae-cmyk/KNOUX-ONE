/**
 * KNOUX ONE — Windows Repair & SFC/DISM Suite
 */

import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';

export const WindowsRepairView: React.FC = () => {
  const { t } = useKnoux();

  const repairModule = MODULES_CATALOG.find(m => m.id === 'm07');
  const repairCapabilities = repairModule?.services || [];

  return (
    <UniversalServiceWorkspace
      moduleNumber={7}
      moduleNameEn="Windows Repair & Image Integrity"
      moduleNameAr="أدوات صيانة وتصحيح نظام ويندوز"
      descriptionEn="Execute official Windows diagnostics: System File Checker (SFC), DISM Component Repair, and Windows Update Agent reset."
      descriptionAr="فحص وتصحيح الملفات التالفة لنظام ويندوز باستخدام أدوات SFC و DISM الرسمية وإعادة تشغيل التحديثات."
      capabilities={repairCapabilities}
    />
  );
};
