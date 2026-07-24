import React, { useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Monitor,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import type { KnouxCapability } from '../../types';
import { useKnoux } from '../../context/KnouxContext';
import {
  MODULE_ACCENTS,
  getActionLabel,
  getImplementationIcon,
  getImplementationLabel,
  getServiceIcon,
} from '../workspace/workspaceMeta';

interface CapabilityCardProps {
  capability: KnouxCapability;
  onOpen?: (capability: KnouxCapability) => void;
  featured?: boolean;
}

export const CapabilityCard: React.FC<CapabilityCardProps> = ({ capability, onOpen, featured = false }) => {
  const { language, t } = useKnoux();
  const [expanded, setExpanded] = useState(false);
  const Icon = getServiceIcon(capability);
  const StateIcon = getImplementationIcon(capability.implementationState);
  const accent = MODULE_ACCENTS[capability.moduleId] ?? 'violet';
  const executable = capability.implementationState === 'implemented' && capability.status === 'available' && Boolean(capability.handlerId);

  const openDetails = () => {
    if (onOpen) {
      onOpen(capability);
      return;
    }
    setExpanded(previous => !previous);
  };

  return (
    <article className={`knoux-service-card group flex flex-col p-5 ${featured ? 'min-h-[270px]' : 'min-h-[230px]'}`} data-accent={accent}>
      <div className="flex items-start justify-between gap-3">
        <div className="knoux-icon-plate">
          <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
        </div>
        <span className={`knoux-chip ${capability.implementationState === 'implemented' ? 'knoux-chip--success' : capability.implementationState === 'requires_configuration' ? 'knoux-chip--warning' : capability.implementationState === 'partial' ? 'knoux-chip--accent' : 'knoux-chip--muted'}`}>
          <StateIcon className="h-3.5 w-3.5" />
          {getImplementationLabel(capability.implementationState, language)}
        </span>
      </div>

      <div className="mt-5 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[.09em] text-[var(--card-accent)]">
          {t(capability.moduleNameEn, capability.moduleNameAr)}
        </p>
        <h3 className="mt-2 text-[17px] font-black leading-6 tracking-[-.02em] text-[var(--knoux-text)] transition group-hover:text-[var(--card-accent)]">
          {t(capability.nameEn, capability.nameAr)}
        </h3>
        <p className="mt-2 line-clamp-3 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">
          {t(capability.descriptionEn, capability.descriptionAr)}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--knoux-border)] pt-4">
        <span className="knoux-chip">
          <Monitor className="h-3.5 w-3.5" />
          {capability.runtime === 'desktop_elevated' ? t('Desktop + Admin', 'سطح المكتب + مسؤول') : t('Desktop', 'سطح المكتب')}
        </span>
        {capability.requiresAdmin && (
          <span className="knoux-chip knoux-chip--warning">
            <ShieldAlert className="h-3.5 w-3.5" />
            {t('Administrator', 'صلاحية مسؤول')}
          </span>
        )}
        <span className="knoux-chip knoux-chip--muted">
          <Settings2 className="h-3.5 w-3.5" />
          {t(`${capability.riskLevel} risk`, `مخاطر ${capability.riskLevel}`)}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--knoux-text-muted)]">{t('What it reads', 'ما الذي تقرؤه')}</p>
              <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-secondary)]">{t(capability.readsEn || capability.descriptionEn, capability.readsAr || capability.descriptionAr)}</p>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--knoux-text-muted)]">{t('What it changes', 'ما الذي ستغيره')}</p>
              <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-secondary)]">{t(capability.changesEn || 'No change occurs before explicit confirmation.', capability.changesAr || 'لا يحدث أي تغيير قبل التأكيد الصريح.')}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 rtl:flex-row-reverse">
        <button type="button" onClick={openDetails} className="knoux-card-action flex-1">
          {onOpen ? <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" /> : expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {onOpen ? t('Open service', 'فتح الخدمة') : expanded ? t('Hide details', 'إخفاء التفاصيل') : t('View details', 'عرض التفاصيل')}
        </button>
        <span className={`grid h-[42px] w-[42px] place-items-center rounded-xl border ${executable ? 'border-[var(--knoux-success)]/30 bg-[var(--knoux-success)]/10 text-[var(--knoux-success)]' : 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)]'}`} title={getActionLabel(capability, language)}>
          {executable ? <CheckCircle2 className="h-[18px] w-[18px]" /> : <Clock3 className="h-[18px] w-[18px]" />}
        </span>
      </div>
    </article>
  );
};
