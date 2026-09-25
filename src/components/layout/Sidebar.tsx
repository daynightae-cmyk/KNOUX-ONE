import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { getOfficialKnouxLogo } from '../../data/officialBrand';
import { MODULE_WORKSPACES, SHELL_WORKSPACES, WORKSPACE_GROUPS } from '../../shell/workspaceRegistry';

export function Sidebar() {
  const { currentRoute, setCurrentRoute, t, theme } = useKnoux();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('knoux.sidebar.collapsed');
    setCollapsed(saved === null ? window.innerWidth < 1600 : saved === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('knoux.sidebar.collapsed', String(collapsed));
  }, [collapsed]);

  const activeModuleId = useMemo(
    () => MODULE_WORKSPACES.find(item => item.route === currentRoute)?.moduleId,
    [currentRoute],
  );

  const renderItem = (item: (typeof MODULE_WORKSPACES)[number]) => {
    const Icon = item.icon;
    const active = currentRoute === item.route;
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => setCurrentRoute(item.route)}
        title={t(item.titleEn, item.titleAr)}
        aria-current={active ? 'page' : undefined}
        className={`group relative flex w-full items-center rounded-xl border text-start transition ${collapsed ? 'h-10 justify-center px-2' : 'min-h-[44px] gap-3 px-3 py-2'} ${active ? 'border-[var(--knoux-primary)]/35 bg-[var(--knoux-primary)]/12 text-[var(--knoux-text)]' : 'border-transparent text-[var(--knoux-text-secondary)] hover:border-[var(--knoux-border)] hover:bg-[var(--knoux-surface-muted)]'}`}
      >
        {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-[var(--knoux-primary-bright)]" />}
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${active ? 'bg-[var(--knoux-primary)]/20 text-[var(--knoux-primary-bright)]' : 'text-[var(--knoux-text-muted)] group-hover:text-[var(--knoux-primary-bright)]'}`}><Icon className="h-[17px] w-[17px]" /></span>
        {!collapsed && <span className="min-w-0"><span className="line-clamp-2 block text-[11px] font-extrabold leading-4">{t(item.titleEn, item.titleAr)}</span>{item.moduleId && <span className="block text-[9px] font-bold uppercase tracking-wider text-[var(--knoux-text-muted)]">{item.moduleId}</span>}</span>}
      </button>
    );
  };

  return (
    <aside className={`knoux-sidebar-shell flex h-full shrink-0 flex-col transition-[width] duration-200 ${collapsed ? 'w-[72px]' : 'w-[248px]'}`} aria-label={t('Primary navigation', 'التنقل الرئيسي')}>
      <div className="border-b border-[var(--knoux-border)] p-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
          <button type="button" onClick={() => setCurrentRoute('dashboard')} className={`flex min-w-0 items-center ${collapsed ? '' : 'gap-3'} text-start`} aria-label={t('Open machine command center', 'فتح مركز قيادة الجهاز')}>
            <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--knoux-glass-border-strong)] bg-[var(--knoux-surface-elevated)]">
              {!logoFailed ? <img src={getOfficialKnouxLogo(theme)} alt="KNOUX ONE" className="h-full w-full object-cover" onError={() => setLogoFailed(true)} /> : <span className="font-black text-[var(--knoux-primary-bright)]">K</span>}
            </div>
            {!collapsed && <div className="min-w-0"><p className="truncate text-[14px] font-black text-[var(--knoux-text)]">KNOUX ONE</p><p className="truncate text-[10px] font-semibold text-[var(--knoux-text-muted)]">{t('Windows workspace', 'مساحة عمل ويندوز')}</p></div>}
          </button>
          {!collapsed && <button type="button" className="knoux-icon-button" onClick={() => setCollapsed(true)} aria-label={t('Collapse navigation', 'طي القائمة')}><PanelLeftClose className="h-4 w-4" /></button>}
        </div>
        {collapsed && <button type="button" className="knoux-icon-button mt-3 w-full" onClick={() => setCollapsed(false)} aria-label={t('Expand navigation', 'توسيع القائمة')}><PanelLeftOpen className="h-4 w-4" /></button>}
      </div>

      <nav className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        <div className="space-y-1">{renderItem(SHELL_WORKSPACES[0])}</div>
        <div className="mt-3 space-y-3">
          {WORKSPACE_GROUPS.map(group => {
            const active = group.moduleIds.includes(activeModuleId ?? '');
            const groupCollapsed = collapsedGroups[group.id];
            const items = group.moduleIds.map(id => MODULE_WORKSPACES.find(item => item.moduleId === id)).filter(Boolean) as typeof MODULE_WORKSPACES;
            return (
              <section key={group.id}>
                {!collapsed && <button type="button" onClick={() => setCollapsedGroups(value => ({ ...value, [group.id]: !value[group.id] }))} className={`mb-1 flex w-full items-center justify-between px-2 py-1 text-[10px] font-black uppercase tracking-[.1em] ${active ? 'text-[var(--knoux-primary-bright)]' : 'text-[var(--knoux-text-muted)]'}`} aria-expanded={!groupCollapsed}><span>{t(group.titleEn, group.titleAr)}</span>{groupCollapsed ? <ChevronRight className="h-3 w-3 rtl:rotate-180" /> : <ChevronDown className="h-3 w-3" />}</button>}
                {(!groupCollapsed || collapsed) && <div className="space-y-1">{items.map(renderItem)}</div>}
              </section>
            );
          })}
        </div>
      </nav>

      <div className="space-y-1 border-t border-[var(--knoux-border)] p-3">
        {SHELL_WORKSPACES.slice(1).map(renderItem)}
      </div>
    </aside>
  );
}
