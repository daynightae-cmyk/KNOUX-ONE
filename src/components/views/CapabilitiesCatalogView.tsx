import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Filter,
  Layers3,
  Monitor,
  Search,
  Settings2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { KnouxCapability } from '../../types';
import { CapabilityCard } from '../common/CapabilityCard';
import {
  MODULE_ACCENTS,
  MODULE_ICONS,
  MODULE_ROUTE_MAP,
  getImplementationIcon,
  getImplementationLabel,
  getModuleSummary,
  getServiceIcon,
} from '../workspace/workspaceMeta';

type LibraryFilter = 'all' | 'ready' | 'preview' | 'roadmap' | 'admin';

export const CapabilitiesCatalogView: React.FC = () => {
  const { language, setCurrentRoute, t } = useKnoux();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<KnouxCapability | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const selectedModule = MODULES_CATALOG.find(module => module.id === selectedModuleId) ?? null;

  const matchesFilter = (service: KnouxCapability) => {
    if (filter === 'ready') return service.implementationState === 'implemented';
    if (filter === 'preview') return service.implementationState === 'partial';
    if (filter === 'roadmap') return service.implementationState === 'planned';
    if (filter === 'admin') return service.requiresAdmin;
    return true;
  };

  const matchingServices = useMemo(() => {
    const source = selectedModule ? selectedModule.services : ALL_CAPABILITIES;
    return source.filter(service => {
      const matchesQuery = !normalizedQuery || [
        service.nameEn,
        service.nameAr,
        service.descriptionEn,
        service.descriptionAr,
        service.moduleNameEn,
        service.moduleNameAr,
      ].some(value => value.toLowerCase().includes(normalizedQuery));
      return matchesQuery && matchesFilter(service);
    });
  }, [filter, normalizedQuery, selectedModule]);

  const filteredModules = useMemo(() => {
    if (!normalizedQuery) return MODULES_CATALOG;
    return MODULES_CATALOG.filter(module => {
      const ownText = `${module.nameEn} ${module.nameAr} ${module.descriptionEn} ${module.descriptionAr}`.toLowerCase();
      return ownText.includes(normalizedQuery) || module.services.some(service => `${service.nameEn} ${service.nameAr} ${service.descriptionEn} ${service.descriptionAr}`.toLowerCase().includes(normalizedQuery));
    });
  }, [normalizedQuery]);

  const globalCounts = useMemo(() => {
    return ALL_CAPABILITIES.reduce(
      (counts, service) => {
        const state = service.implementationState ?? 'planned';
        counts[state] += 1;
        if (service.requiresAdmin) counts.admin += 1;
        return counts;
      },
      { implemented: 0, partial: 0, planned: 0, requires_configuration: 0, unsupported: 0, admin: 0 } as Record<string, number>,
    );
  }, []);

  const filters: Array<{ id: LibraryFilter; en: string; ar: string; count: number }> = [
    { id: 'all', en: 'All services', ar: 'جميع الخدمات', count: ALL_CAPABILITIES.length },
    { id: 'ready', en: 'Ready', ar: 'جاهزة', count: globalCounts.implemented },
    { id: 'preview', en: 'Desktop previews', ar: 'معاينات سطح المكتب', count: globalCounts.partial },
    { id: 'roadmap', en: 'Roadmap', ar: 'ضمن الخطة', count: globalCounts.planned },
    { id: 'admin', en: 'Administrator', ar: 'صلاحية مسؤول', count: globalCounts.admin },
  ];

  const openModuleWorkspace = (moduleId: string) => {
    setCurrentRoute(MODULE_ROUTE_MAP[moduleId] ?? 'catalog');
  };

  return (
    <div className="knoux-page-container space-y-7">
      <section className="knoux-glass-panel overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[38%] bg-[radial-gradient(circle_at_center,rgba(139,92,246,.16),transparent_67%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl">
            <div className="knoux-eyebrow"><Layers3 className="h-4 w-4" />{t('Workspace library', 'مكتبة مساحات العمل')}</div>
            <h1 className="mt-3 text-[clamp(2rem,4vw,3.25rem)] font-black leading-[1.08] tracking-[-.045em] text-[var(--knoux-text)]">
              {t('Choose the result you need', 'اختر النتيجة التي تحتاجها')}
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] font-medium leading-7 text-[var(--knoux-text-secondary)]">
              {t('KNOUX ONE organizes 190 services inside 19 professional workspaces. Module codes remain internal; the interface presents clear tasks such as install, update, scan, repair, export, and manage.', 'ينظم كنوكس ون 190 خدمة داخل 19 مساحة عمل احترافية. تبقى رموز الأقسام داخلية، بينما تعرض الواجهة مهامًا واضحة مثل التثبيت والتحديث والفحص والإصلاح والتصدير والإدارة.')}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="knoux-chip knoux-chip--accent">19 {t('workspaces', 'مساحة عمل')}</span>
              <span className="knoux-chip">190 {t('services', 'خدمة')}</span>
              <span className="knoux-chip knoux-chip--success">{globalCounts.implemented} {t('ready', 'جاهزة')}</span>
              <span className="knoux-chip">{globalCounts.partial} {t('desktop previews', 'معاينات سطح المكتب')}</span>
            </div>
          </div>

          <div className="w-full xl:max-w-[460px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--knoux-primary-bright)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                placeholder={t('Search by task, service, or workspace…', 'ابحث بالمهمة أو الخدمة أو مساحة العمل…')}
                className="knoux-search-field ps-11 pe-4 text-[13px] font-semibold"
              />
            </label>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-2">
        <span className="flex items-center gap-2 px-2 text-[12px] font-extrabold text-[var(--knoux-text-muted)] rtl:flex-row-reverse">
          <Filter className="h-4 w-4" />{t('Filter', 'تصفية')}
        </span>
        {filters.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`min-h-[38px] rounded-xl px-3 text-[12px] font-extrabold transition ${filter === item.id ? 'bg-[linear-gradient(135deg,var(--knoux-primary),var(--knoux-primary-hover))] text-white shadow-[0_8px_22px_rgba(139,92,246,.2)]' : 'text-[var(--knoux-text-muted)] hover:bg-[var(--knoux-surface-elevated)] hover:text-[var(--knoux-text)]'}`}
          >
            {t(item.en, item.ar)} <span className="ms-1 opacity-70">{item.count}</span>
          </button>
        ))}
      </section>

      {!selectedModule && !normalizedQuery && filter === 'all' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="knoux-eyebrow"><Sparkles className="h-4 w-4" />{t('Professional workspaces', 'مساحات العمل الاحترافية')}</div>
              <h2 className="mt-2 text-[25px] font-black tracking-[-.03em] text-[var(--knoux-text)]">{t('Open a complete area of work', 'افتح مجال عمل متكاملًا')}</h2>
            </div>
            <p className="max-w-xl text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t('Each card contains ten related services and opens a dedicated workspace instead of exposing technical module codes.', 'كل بطاقة تضم عشر خدمات مترابطة وتفتح مساحة عمل مخصصة بدل عرض رموز تقنية غير مفهومة.')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredModules.map(module => {
              const Icon = MODULE_ICONS[module.id] ?? Layers3;
              const accent = MODULE_ACCENTS[module.id] ?? 'violet';
              const stateCounts = module.services.reduce(
                (counts, service) => {
                  const state = service.implementationState ?? 'planned';
                  counts[state] += 1;
                  return counts;
                },
                { implemented: 0, partial: 0, planned: 0, requires_configuration: 0, unsupported: 0 } as Record<string, number>,
              );
              const previewServices = module.services.slice(0, 3);

              return (
                <article key={module.id} className="knoux-module-card flex min-h-[310px] flex-col p-5" data-accent={accent}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="knoux-icon-plate"><Icon className="h-[23px] w-[23px]" /></div>
                    <span className="knoux-chip">10 {t('services', 'خدمات')}</span>
                  </div>

                  <div className="mt-5 flex-1">
                    <h3 className="text-[19px] font-black leading-7 tracking-[-.025em] text-[var(--knoux-text)]">{t(module.nameEn, module.nameAr)}</h3>
                    <p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{getModuleSummary(module.id, language)}</p>

                    <div className="mt-4 space-y-2 border-t border-[var(--knoux-border)] pt-4">
                      {previewServices.map(service => (
                        <button key={service.id} type="button" onClick={() => setSelectedService(service)} className="flex w-full items-center gap-2 text-start text-[12px] font-semibold text-[var(--knoux-text-secondary)] transition hover:text-[var(--card-accent)] rtl:flex-row-reverse">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[var(--card-accent)]" />
                          <span className="truncate">{t(service.nameEn, service.nameAr)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2 rtl:flex-row-reverse">
                    <button type="button" onClick={() => setSelectedModuleId(module.id)} className="knoux-card-action flex-1">
                      {t('Explore services', 'استعراض الخدمات')}<ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                    <button type="button" onClick={() => openModuleWorkspace(module.id)} className="knoux-card-action knoux-card-action--primary h-[42px] w-[46px] px-0" title={t('Open workspace', 'فتح مساحة العمل')}>
                      <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {stateCounts.implemented > 0 && <span className="knoux-chip knoux-chip--success">{stateCounts.implemented} {t('ready', 'جاهزة')}</span>}
                    {stateCounts.partial > 0 && <span className="knoux-chip knoux-chip--accent">{stateCounts.partial} {t('preview', 'معاينة')}</span>}
                    {stateCounts.planned > 0 && <span className="knoux-chip knoux-chip--muted">{stateCounts.planned} {t('roadmap', 'بالخطة')}</span>}
                    {stateCounts.requires_configuration > 0 && <span className="knoux-chip knoux-chip--warning">{stateCounts.requires_configuration} {t('setup', 'إعداد')}</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {selectedModule && (
        <section className="space-y-5">
          <div className="knoux-glass-panel p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4 rtl:flex-row-reverse">
                <button type="button" onClick={() => setSelectedModuleId(null)} className="knoux-card-action h-[44px] w-[44px] shrink-0 px-0" title={t('Back to workspaces', 'العودة لمساحات العمل')}>
                  {language === 'ar' ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                </button>
                <div>
                  <div className="knoux-eyebrow">{t('Selected workspace', 'مساحة العمل المختارة')}</div>
                  <h2 className="mt-2 text-[27px] font-black tracking-[-.035em] text-[var(--knoux-text)]">{t(selectedModule.nameEn, selectedModule.nameAr)}</h2>
                  <p className="mt-2 max-w-3xl text-[13px] font-medium leading-6 text-[var(--knoux-text-muted)]">{getModuleSummary(selectedModule.id, language)}</p>
                </div>
              </div>
              <button type="button" onClick={() => openModuleWorkspace(selectedModule.id)} className="knoux-card-action knoux-card-action--primary">
                {t('Open full workspace', 'فتح مساحة العمل كاملة')}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-[var(--knoux-text-secondary)]">{matchingServices.length} {t('matching services', 'خدمة مطابقة')}</p>
            <button type="button" onClick={() => { setSelectedModuleId(null); setSearchQuery(''); setFilter('all'); }} className="text-[12px] font-extrabold text-[var(--knoux-primary-bright)] hover:underline">{t('Show all workspaces', 'عرض كل مساحات العمل')}</button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {matchingServices.map(service => <CapabilityCard key={service.id} capability={service} onOpen={setSelectedService} />)}
          </div>
        </section>
      )}

      {(!selectedModule && (normalizedQuery || filter !== 'all')) && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="knoux-eyebrow"><Search className="h-4 w-4" />{t('Service results', 'نتائج الخدمات')}</div>
              <h2 className="mt-2 text-[24px] font-black text-[var(--knoux-text)]">{matchingServices.length} {t('matching services', 'خدمة مطابقة')}</h2>
            </div>
            <button type="button" onClick={() => { setSearchQuery(''); setFilter('all'); }} className="knoux-card-action">{t('Clear filters', 'مسح التصفية')}<X className="h-4 w-4" /></button>
          </div>
          {matchingServices.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matchingServices.map(service => <CapabilityCard key={service.id} capability={service} onOpen={setSelectedService} />)}
            </div>
          ) : (
            <div className="knoux-glass-panel flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
              <Search className="h-10 w-10 text-[var(--knoux-text-muted)]" />
              <h3 className="mt-4 text-[17px] font-black text-[var(--knoux-text)]">{t('No services match this search', 'لا توجد خدمات مطابقة لهذا البحث')}</h3>
              <p className="mt-2 text-[13px] text-[var(--knoux-text-muted)]">{t('Try a natural task name such as install, update, cleanup, repair, backup, or network.', 'جرّب اسم مهمة طبيعيًا مثل تثبيت أو تحديث أو تنظيف أو إصلاح أو نسخ احتياطي أو شبكة.')}</p>
            </div>
          )}
        </section>
      )}

      {selectedService && (
        <div className="knoux-drawer-backdrop" role="presentation" onMouseDown={event => { if (event.currentTarget === event.target) setSelectedService(null); }}>
          <aside className="knoux-drawer" role="dialog" aria-modal="true" aria-label={t(selectedService.nameEn, selectedService.nameAr)}>
            <div className="flex items-start justify-between gap-4 border-b border-[var(--knoux-border)] p-5">
              <div className="flex items-start gap-3 rtl:flex-row-reverse">
                <div className="knoux-icon-plate" data-accent={MODULE_ACCENTS[selectedService.moduleId] ?? 'violet'}>
                  {React.createElement(getServiceIcon(selectedService), { className: 'h-[22px] w-[22px]' })}
                </div>
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[.09em] text-[var(--knoux-primary-bright)]">{t(selectedService.moduleNameEn, selectedService.moduleNameAr)}</p>
                  <h2 className="mt-1 text-[20px] font-black leading-7 text-[var(--knoux-text)]">{t(selectedService.nameEn, selectedService.nameAr)}</h2>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedService(null)} className="knoux-card-action h-10 w-10 shrink-0 px-0" title={t('Close', 'إغلاق')}><X className="h-[18px] w-[18px]" /></button>
            </div>

            <div className="custom-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2">
                <span className={`knoux-chip ${selectedService.implementationState === 'implemented' ? 'knoux-chip--success' : selectedService.implementationState === 'partial' ? 'knoux-chip--accent' : selectedService.implementationState === 'requires_configuration' ? 'knoux-chip--warning' : 'knoux-chip--muted'}`}>
                  {React.createElement(getImplementationIcon(selectedService.implementationState), { className: 'h-3.5 w-3.5' })}
                  {getImplementationLabel(selectedService.implementationState, language)}
                </span>
                <span className="knoux-chip"><Monitor className="h-3.5 w-3.5" />{selectedService.runtime === 'desktop_elevated' ? t('Desktop + Admin', 'سطح المكتب + مسؤول') : t('Desktop', 'سطح المكتب')}</span>
                {selectedService.requiresAdmin && <span className="knoux-chip knoux-chip--warning"><ShieldAlert className="h-3.5 w-3.5" />{t('Administrator required', 'تتطلب صلاحية مسؤول')}</span>}
              </div>

              <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
                <h3 className="text-[12px] font-extrabold uppercase tracking-[.08em] text-[var(--knoux-text-muted)]">{t('Service overview', 'نظرة عامة على الخدمة')}</h3>
                <p className="mt-2 text-[13px] font-medium leading-6 text-[var(--knoux-text-secondary)]">{t(selectedService.descriptionEn, selectedService.descriptionAr)}</p>
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
                  <h3 className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('What it reads', 'ما الذي تقرؤه')}</h3>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedService.readsEn || selectedService.descriptionEn, selectedService.readsAr || selectedService.descriptionAr)}</p>
                </section>
                <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
                  <h3 className="text-[12px] font-extrabold text-[var(--knoux-text)]">{t('What it changes', 'ما الذي ستغيره')}</h3>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedService.changesEn || 'No change occurs before explicit confirmation.', selectedService.changesAr || 'لا يحدث أي تغيير قبل التأكيد الصريح.')}</p>
                </section>
              </div>

              <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-[12px] font-extrabold text-[var(--knoux-text)] rtl:flex-row-reverse"><Settings2 className="h-4 w-4 text-[var(--knoux-primary-bright)]" />{t('Availability and verification', 'التوفر وطريقة التحقق')}</div>
                <p className="mt-2 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t(selectedService.availabilityReasonEn || 'Open the dedicated workspace for current availability.', selectedService.availabilityReasonAr || 'افتح مساحة العمل المخصصة لمعرفة حالة التوفر الحالية.')}</p>
                {selectedService.verificationStrategy && <p className="mt-3 border-t border-[var(--knoux-border)] pt-3 text-[12px] font-medium leading-5 text-[var(--knoux-text-secondary)]">{selectedService.verificationStrategy}</p>}
              </section>

              {selectedService.implementationState !== 'implemented' && (
                <section className="flex items-start gap-3 rounded-2xl border border-[var(--knoux-warning)]/30 bg-[var(--knoux-warning)]/8 p-4 rtl:flex-row-reverse">
                  <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--knoux-warning)]" />
                  <div>
                    <h3 className="text-[13px] font-extrabold text-[var(--knoux-text)]">{t('Execution is not presented as complete', 'لا تظهر الخدمة كأن تنفيذها مكتمل')}</h3>
                    <p className="mt-1 text-[12px] font-medium leading-5 text-[var(--knoux-text-muted)]">{t('This workspace keeps the service visible and documented without claiming a successful native operation.', 'تحافظ مساحة العمل على ظهور الخدمة وتوثيقها دون ادعاء نجاح عملية محلية غير مكتملة.')}</p>
                  </div>
                </section>
              )}
            </div>

            <div className="flex gap-3 border-t border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 rtl:flex-row-reverse">
              <button type="button" onClick={() => setSelectedService(null)} className="knoux-card-action flex-1">{t('Close', 'إغلاق')}</button>
              <button type="button" onClick={() => { setSelectedService(null); openModuleWorkspace(selectedService.moduleId); }} className="knoux-card-action knoux-card-action--primary flex-1">
                {t('Open workspace', 'فتح مساحة العمل')}<ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
