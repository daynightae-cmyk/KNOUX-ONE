import { Clock3, PanelRightClose, RotateCcw, ShieldAlert, Terminal, X } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { SERVICE_PRESENTATIONS } from '../../services/servicePresentation';

export function InspectorPanel() {
  const { selectedServiceId, setSelectedServiceId, inspectorOpen, setInspectorOpen, language, t } = useKnoux();
  const service = SERVICE_PRESENTATIONS.find(item => item.id === selectedServiceId);

  if (!inspectorOpen) {
    return (
      <button type="button" className="knoux-inspector-toggle" onClick={() => setInspectorOpen(true)} aria-label={t('Open inspector', 'فتح لوحة التفاصيل')}>
        <Terminal className="h-4 w-4" />
      </button>
    );
  }

  return (
    <aside className="knoux-inspector-shell" aria-label={t('Context inspector', 'لوحة تفاصيل السياق')}>
      <div className="flex items-center justify-between border-b border-[var(--knoux-border)] p-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--knoux-primary-bright)]">{t('Inspector', 'التفاصيل')}</p>
          <h2 className="mt-1 text-[14px] font-black text-[var(--knoux-text)]">{service ? t('Service context', 'سياق الخدمة') : t('Workspace context', 'سياق مساحة العمل')}</h2>
        </div>
        <div className="flex gap-1">
          {service && <button type="button" className="knoux-icon-button" onClick={() => setSelectedServiceId(null)} aria-label={t('Clear selected service', 'إلغاء تحديد الخدمة')}><X className="h-4 w-4" /></button>}
          <button type="button" className="knoux-icon-button" onClick={() => setInspectorOpen(false)} aria-label={t('Collapse inspector', 'طي لوحة التفاصيل')}><PanelRightClose className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        {service ? (
          <div className="space-y-4">
            <div>
              <span className={`knoux-chip ${service.state === 'implemented' ? 'knoux-chip--success' : service.state === 'partial' ? 'knoux-chip--warning' : 'knoux-chip--muted'}`}>
                {service.state === 'implemented' ? t('Statically verified', 'موثقة ساكنًا') : service.state === 'partial' ? t('Partial · limited scope', 'جزئية · نطاق محدود') : t('Planned · non-executable', 'مخططة · غير قابلة للتنفيذ')}
              </span>
              <h3 className="mt-3 text-[17px] font-black leading-6 text-[var(--knoux-text)]">{language === 'ar' ? service.titleAr : service.titleEn}</h3>
              <p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{language === 'ar' ? service.descriptionAr : service.descriptionEn}</p>
            </div>

            <dl className="space-y-2 text-[12px]">
              <div className="knoux-inspector-row"><dt>{t('Module', 'القسم')}</dt><dd dir="ltr">{service.moduleId.toUpperCase()}</dd></div>
              <div className="knoux-inspector-row"><dt>{t('Risk', 'المخاطر')}</dt><dd>{service.risk}</dd></div>
              <div className="knoux-inspector-row"><dt>{t('Administrator', 'المسؤول')}</dt><dd>{service.requiresAdmin ? t('Required', 'مطلوب') : t('Not required', 'غير مطلوب')}</dd></div>
              <div className="knoux-inspector-row"><dt>{t('Handler', 'المعالج')}</dt><dd dir="ltr" title={service.nativeCommand}>{service.handlerId ?? '—'}</dd></div>
            </dl>

            {service.requiresAdmin && <div className="knoux-inspector-notice"><ShieldAlert className="h-4 w-4" /><span>{t('Execution remains behind the module confirmation and elevation flow.', 'يبقى التنفيذ خلف مسار التأكيد ورفع الصلاحيات الخاص بالقسم.')}</span></div>}
            {service.supportsUndo && <div className="knoux-inspector-notice"><RotateCcw className="h-4 w-4" /><span>{t('The native contract declares restore or undo support.', 'يعلن العقد المحلي دعم الاستعادة أو التراجع.')}</span></div>}
            {service.state === 'planned' && <div className="knoux-inspector-notice"><Clock3 className="h-4 w-4" /><span>{language === 'ar' ? service.availabilityReasonAr : service.availabilityReasonEn}</span></div>}

            <p className="border-t border-[var(--knoux-border)] pt-4 text-[11px] leading-5 text-[var(--knoux-text-muted)]">
              {t('Open the module workspace to configure or run this service. The inspector never bypasses native safety checks.', 'افتح مساحة القسم لإعداد هذه الخدمة أو تشغيلها. لا تتجاوز لوحة التفاصيل فحوص الأمان المحلية.')}
            </p>
          </div>
        ) : (
          <div className="flex min-h-[260px] flex-col items-center justify-center text-center">
            <Terminal className="h-8 w-8 text-[var(--knoux-primary-bright)]" />
            <h3 className="mt-4 text-[14px] font-black text-[var(--knoux-text)]">{t('Select a service', 'حدد خدمة')}</h3>
            <p className="mt-2 text-[12px] leading-5 text-[var(--knoux-text-muted)]">{t('Use global search to inspect implementation state, risk, requirements, and native availability.', 'استخدم البحث العام لفحص حالة التنفيذ والمخاطر والمتطلبات والتوفر المحلي.')}</p>
          </div>
        )}
      </div>
    </aside>
  );
}
