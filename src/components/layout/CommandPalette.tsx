import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Clock3, Search, ShieldAlert, X } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { searchServices } from '../../services/servicePresentation';
import type { ImplementationState } from '../../types';
import { MODULE_WORKSPACES, SHELL_WORKSPACES } from '../../shell/workspaceRegistry';

type SearchFilter = 'all' | Extract<ImplementationState, 'implemented' | 'planned'>;

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setCurrentRoute, setSelectedServiceId, setInspectorOpen, language, t } = useKnoux();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    setQuery('');
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCommandPaletteOpen(false);
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current
        ? [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')]
        : [];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  const services = useMemo(() => searchServices(query, filter).slice(0, 40), [filter, query]);
  const workspaces = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return [...SHELL_WORKSPACES.slice(0, 3), ...MODULE_WORKSPACES.slice(0, 5)];
    return [...SHELL_WORKSPACES, ...MODULE_WORKSPACES].filter(item => [item.titleEn, item.titleAr, item.descriptionEn, item.descriptionAr].some(value => value.toLocaleLowerCase().includes(needle))).slice(0, 10);
  }, [query]);

  if (!commandPaletteOpen) return null;

  const openService = (id: string, route: string) => {
    setCurrentRoute(route);
    setSelectedServiceId(id);
    setInspectorOpen(true);
    setCommandPaletteOpen(false);
  };

  return (
    <div className="knoux-command-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setCommandPaletteOpen(false)}>
      <section ref={dialogRef} className="knoux-command-dialog" role="dialog" aria-modal="true" aria-label={t('Global search and command palette', 'البحث العام ولوحة الأوامر')}>
        <div className="flex items-center gap-3 border-b border-[var(--knoux-border)] p-4">
          <Search className="h-5 w-5 shrink-0 text-[var(--knoux-primary-bright)]" />
          <input autoFocus type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search modules and services in Arabic or English…', 'ابحث في الأقسام والخدمات بالعربية أو الإنجليزية…')} className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold text-[var(--knoux-text)] outline-none placeholder:text-[var(--knoux-text-muted)]" />
          <button type="button" className="knoux-icon-button" onClick={() => setCommandPaletteOpen(false)} aria-label={t('Close command palette', 'إغلاق لوحة الأوامر')}><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-2 border-b border-[var(--knoux-border)] p-3">
          {(['all', 'implemented', 'planned'] as SearchFilter[]).map(value => <button type="button" key={value} onClick={() => setFilter(value)} className={`knoux-chip ${filter === value ? 'knoux-chip--accent' : ''}`}>{value === 'all' ? t('All', 'الكل') : value === 'implemented' ? t('Implemented', 'منفذة') : t('Planned', 'مخططة')}</button>)}
          <span className="ms-auto self-center text-[10px] font-semibold text-[var(--knoux-text-muted)]">{t('Services open safely in their workspace', 'تفتح الخدمات بأمان داخل مساحة القسم')}</span>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
          {workspaces.length > 0 && <div className="mb-4"><p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.1em] text-[var(--knoux-text-muted)]">{t('Workspaces', 'مساحات العمل')}</p><div className="grid gap-1 md:grid-cols-2">{workspaces.map(item => { const Icon = item.icon; return <button type="button" key={item.id} onClick={() => { setCurrentRoute(item.route); setCommandPaletteOpen(false); }} className="knoux-command-result"><Icon className="h-4 w-4 text-[var(--knoux-primary-bright)]" /><span className="min-w-0 flex-1 text-start"><strong className="block truncate text-[12px] text-[var(--knoux-text)]">{language === 'ar' ? item.titleAr : item.titleEn}</strong><span className="block truncate text-[10px] text-[var(--knoux-text-muted)]">{language === 'ar' ? item.descriptionAr : item.descriptionEn}</span></span><ArrowUpRight className="h-3.5 w-3.5 text-[var(--knoux-text-muted)] rtl:-scale-x-100" /></button>; })}</div></div>}

          <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[.1em] text-[var(--knoux-text-muted)]">{t('Services', 'الخدمات')} · {services.length}</p>
          <div className="space-y-1">
            {services.map(service => (
              <button type="button" key={service.id} onClick={() => openService(service.id, service.route)} className="knoux-command-result w-full">
                {service.executable ? <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--knoux-success)]" /> : <Clock3 className="h-4 w-4 shrink-0 text-[var(--knoux-text-muted)]" />}
                <span className="min-w-0 flex-1 text-start"><span className="flex items-center gap-2"><strong className="truncate text-[12px] text-[var(--knoux-text)]">{language === 'ar' ? service.titleAr : service.titleEn}</strong>{service.requiresAdmin && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[var(--knoux-warning)]" />}</span><span className="mt-0.5 block truncate text-[10px] text-[var(--knoux-text-muted)]">{service.moduleId.toUpperCase()} · {service.state === 'implemented' ? t('Statically verified', 'موثقة ساكنًا') : service.state === 'partial' ? t('Partial · limited scope', 'جزئية · نطاق محدود') : t('Planned · non-executable', 'مخططة · غير قابلة للتنفيذ')}</span></span>
                <span className="text-[10px] font-bold text-[var(--knoux-primary-bright)]">{t('Open', 'فتح')}</span>
              </button>
            ))}
            {services.length === 0 && <p className="py-10 text-center text-[12px] text-[var(--knoux-text-muted)]">{t('No matching services.', 'لا توجد خدمات مطابقة.')}</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
