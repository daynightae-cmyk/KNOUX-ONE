import React from 'react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { UniversalServiceWorkspace } from '../common/UniversalServiceWorkspace';
import { PrivacyStatusPanels } from '../../features/privacy/PrivacyStatusPanels';
import { NativeClient } from '../../services/nativeClient';

export const PrivacyTelemetryView: React.FC = () => {
  const { t } = useKnoux();
  const moduleData = MODULES_CATALOG.find(m => m.id === 'm09');
  if (!moduleData) return null;

  return (
    <>
      <PrivacyStatusPanels available={NativeClient.isTauriAvailable()} />
      <p className="mt-4 text-[11px] leading-5 text-[var(--knoux-text-muted)]">
        {t('Telemetry and diagnostics remain on this device. Nothing is uploaded to a remote server.', 'تظل بيانات القياس والتشخيص على هذا الجهاز؛ لا يُرفع أي شيء إلى خادم بعيد.')}
      </p>
      <UniversalServiceWorkspace
        moduleNumber={9}
        moduleNameEn={moduleData.nameEn}
        moduleNameAr={moduleData.nameAr}
        descriptionEn={moduleData.descriptionEn}
        descriptionAr={moduleData.descriptionAr}
        capabilities={moduleData.services}
      />
    </>
  );
};
