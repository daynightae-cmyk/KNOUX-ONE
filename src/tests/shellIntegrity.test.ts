import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { MODULE_WORKSPACES, WORKSPACE_GROUPS } from '../shell/workspaceRegistry';
import { SERVICE_PRESENTATIONS, searchServices } from '../services/servicePresentation';

describe('unified workspace shell integrity', () => {
  it('resolves every canonical module to one navigation destination', () => {
    expect(MODULES_CATALOG).toHaveLength(19);
    expect(MODULE_WORKSPACES).toHaveLength(19);
    expect(new Set(MODULE_WORKSPACES.map(item => item.route)).size).toBe(19);
    expect(WORKSPACE_GROUPS.flatMap(group => group.moduleIds).sort()).toEqual(MODULES_CATALOG.map(module => module.id).sort());
    expect(MODULE_WORKSPACES.every(item => item.route && item.icon)).toBe(true);
  });

  it('derives truthful presentation state without making planned services executable', () => {
    expect(SERVICE_PRESENTATIONS).toHaveLength(ALL_CAPABILITIES.length);
    expect(SERVICE_PRESENTATIONS.filter(item => item.state === 'implemented')).toHaveLength(104);
    expect(SERVICE_PRESENTATIONS.filter(item => item.state === 'partial')).toHaveLength(0);
    expect(SERVICE_PRESENTATIONS.filter(item => item.state === 'planned')).toHaveLength(86);
    expect(SERVICE_PRESENTATIONS.filter(item => item.state === 'planned').every(item => !item.executable && !item.nativeCommand)).toBe(true);
    expect(SERVICE_PRESENTATIONS.filter(item => item.state === 'implemented').every(item => item.executable && item.nativeCommand)).toBe(true);
  });

  it('searches canonical Arabic and English service metadata', () => {
    expect(searchServices('Windows Update').some(item => item.id === 'm07_s05')).toBe(true);
    expect(searchServices('إصلاح مشاكل Windows').some(item => item.moduleId === 'm07')).toBe(true);
    expect(searchServices('Winget', 'planned').every(item => item.state === 'planned')).toBe(true);
  });

  it('keeps navigation state separate from service truth', () => {
    const before = SERVICE_PRESENTATIONS.map(item => [item.id, item.state, item.executable]);
    for (const workspace of MODULE_WORKSPACES) expect(workspace.route).toBeTruthy();
    expect(SERVICE_PRESENTATIONS.map(item => [item.id, item.state, item.executable])).toEqual(before);
  });

  it('uses the command palette for safe navigation instead of generic execution', () => {
    const source = readFileSync(new URL('../components/layout/CommandPalette.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('executeCapability(');
    expect(source).not.toContain('addLog(');
    expect(source).not.toContain('requestElevation(');
    expect(source).toContain('setCurrentRoute(route)');
    expect(source).toContain('setSelectedServiceId(id)');
  });

  it('sets RTL at the application root and contains no generated fake handlers', () => {
    const context = readFileSync(new URL('../context/KnouxContext.tsx', import.meta.url), 'utf8');
    const registry = readFileSync(new URL('../services/nativeCommandRegistry.ts', import.meta.url), 'utf8');
    expect(context).toContain("root.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr')");
    expect(registry).not.toMatch(/m\d{2}\.service\.\d+/);
  });
});
