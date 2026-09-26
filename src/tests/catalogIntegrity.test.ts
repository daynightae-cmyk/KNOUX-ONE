import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_CAPABILITIES, MODULES_CATALOG } from '../data/capabilitiesCatalog';
import { NATIVE_COMMANDS } from '../services/nativeCommandRegistry';

const read = (relative: string) => fs.readFileSync(path.resolve(relative), 'utf8');

describe('KNOUX ONE honest capability catalog', () => {
  it('contains exactly 19 modules and 190 services with the verified totals', () => {
    expect(MODULES_CATALOG).toHaveLength(19);
    for (const module of MODULES_CATALOG) expect(module.services, module.id).toHaveLength(10);
    expect(ALL_CAPABILITIES).toHaveLength(190);
    expect(new Set(ALL_CAPABILITIES.map(item => item.id)).size).toBe(190);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'implemented')).toHaveLength(101);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'partial')).toHaveLength(0);
    expect(ALL_CAPABILITIES.filter(item => item.implementationState === 'planned')).toHaveLength(89);
  });

  it('never exposes a planned service as an executable handler', () => {
    for (const capability of ALL_CAPABILITIES) {
      if (capability.implementationState === 'planned') {
        expect(capability.handlerId, capability.id).toBeUndefined();
        expect(capability.status, capability.id).toBe('planned');
      }
    }
  });

  it('maps every executable service to an explicit allowlisted native command', () => {
    for (const capability of ALL_CAPABILITIES) {
      if (capability.handlerId) {
        expect(Object.prototype.hasOwnProperty.call(NATIVE_COMMANDS, capability.handlerId), `${capability.id}/${capability.handlerId}`).toBe(true);
      }
      if (capability.implementationState === 'implemented') expect(capability.handlerId, capability.id).toBeTruthy();
    }
  });

  it('keeps Module 16 honestly planned', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm16');
    expect(module).toBeDefined();
    for (const service of module!.services) {
      expect(service.implementationState, service.id).toBe('planned');
      expect(service.handlerId, service.id).toBeUndefined();
    }
  });

  it('publishes ten completed Module 03 services', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm03');
    expect(module).toBeDefined();
    for (const service of module!.services) {
      expect(service.implementationState, service.id).toBe('implemented');
      expect(service.status, service.id).toBe('available');
      expect(service.handlerId, service.id).toBeTruthy();
    }
  });

  it('publishes ten completed Module 05 services', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm05');
    expect(module).toBeDefined();
    expect(module!.services.map(service => service.handlerId)).toEqual([
      'm05.registry.inspect', 'm05.folders.inspect', 'm05.tasks.inspect', 'm05.services.inspect',
      'm05.impact.assess', 'm05.recommendations.generate', 'm05.delay.manage',
      'm05.profiles.manage', 'm05.restore.manage', 'm05.boot.history',
    ]);
    for (const service of module!.services) {
      expect(service.status).toBe('available');
      expect(service.implementationState).toBe('implemented');
    }
  });

  it('publishes ten completed Module 06 services', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm06');
    expect(module).toBeDefined();
    expect(module!.services.map(service => service.handlerId)).toEqual([
      'm06.cpu.monitor', 'm06.memory.monitor', 'm06.disk.activity', 'm06.network.activity',
      'm06.process.explorer', 'm06.process.heavy', 'm06.priority.manage', 'm06.power.manage',
      'm06.profiles.manage', 'm06.benchmark.report',
    ]);
    for (const service of module!.services) {
      expect(service.status).toBe('available');
      expect(service.implementationState).toBe('implemented');
    }
  });

  /**
   * Module 15 is asserted by service *number*, never by array position.
   *
   * The previous gate compared `services.map(handlerId)` against a flat literal
   * array. That is a positional assertion, and because the catalog itself
   * assigned handlers positionally the two agreed with each other even though the
   * pairing was semantically wrong: `m15_git_audit` (git configuration) was
   * published as "Node & package-manager status", and `m15_runtime_inspect`
   * (package-manager homes) was published as "Git configuration". Asserting a
   * number-keyed map forces the gate to state which command serves which named
   * service, so re-introducing the drift now fails here.
   */
  it('binds every Module 15 service to the command that actually measures it', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm15');
    expect(module).toBeDefined();

    const byServiceNumber = new Map(module!.services.map(service => [service.serviceNumber, service]));
    expect(byServiceNumber.size, 'service numbers must be unique').toBe(10);

    const expected: Record<number, string | undefined> = {
      1: 'm15.environment.discover',
      2: 'm15.path.audit',
      3: 'm15.git.audit',
      4: 'm15.runtime.inspect',
      // 5 (virtualenv paths / pip state), 6 (dotnet --list-sdks) and
      // 7 (JAVA_HOME, JDK, Android SDK tools) have no native implementation.
      5: undefined,
      6: undefined,
      7: undefined,
      8: 'm15.ports.manage',
      9: 'm15.ports.manage',
      10: 'm15.report.export',
    };

    for (const [serviceNumber, handlerId] of Object.entries(expected)) {
      const service = byServiceNumber.get(Number(serviceNumber));
      expect(service, `m15 service ${serviceNumber} exists`).toBeDefined();
      expect(service!.handlerId, `m15 service ${serviceNumber} (${service!.nameEn})`).toBe(handlerId);
      expect(service!.implementationState, `m15 service ${serviceNumber} state`).toBe(
        handlerId ? 'implemented' : 'planned',
      );
    }
  });

  it('keeps the three unimplemented Module 15 services honestly planned', () => {
    const module = MODULES_CATALOG.find(item => item.id === 'm15');
    expect(module).toBeDefined();
    for (const serviceNumber of [5, 6, 7]) {
      const service = module!.services.find(item => item.serviceNumber === serviceNumber);
      expect(service, `m15_s0${serviceNumber} exists`).toBeDefined();
      expect(service!.handlerId, service!.id).toBeUndefined();
      expect(service!.status, service!.id).toBe('planned');
      expect(service!.implementationState, service!.id).toBe('planned');
      expect(service!.availabilityReasonEn, service!.id).toMatch(/not implemented|stays planned/i);
    }
  });

  /**
   * `m15_ports_manage` legitimately serves two catalog services, so the allowlist
   * mapping alone cannot prove the Rust envelope names the right one. The Rust
   * source is the only place that truth lives, so it is asserted directly.
   */
  it('derives the Module 15 port capability id from the request action', () => {
    const developer = read('src-tauri/src/developer/mod.rs');
    expect(developer).toContain('const M15_PORT_VIEWER_SERVICE: &str = "m15_s08";');
    expect(developer).toContain('const M15_PORT_TERMINATION_SERVICE: &str = "m15_s09";');
    expect(developer).toContain('PortManageRequest::Inspect => M15_PORT_VIEWER_SERVICE');
    expect(developer).toContain('PortManageRequest::Terminate { .. } => M15_PORT_TERMINATION_SERVICE');
  });

  it('never lets a Module 15 command claim a service id it does not serve', () => {
    const developer = read('src-tauri/src/developer/mod.rs');
    // Git configuration is S03 and package managers are S04. These two were swapped.
    expect(developer).toContain('const M15_GIT_CONFIGURATION_SERVICE: &str = "m15_s03";');
    expect(developer).toContain('const M15_NODE_PACKAGE_MANAGER_SERVICE: &str = "m15_s04";');
    expect(developer).toMatch(/M15_GIT_CONFIGURATION_SERVICE,\s*\n\s*"m15\.git\.audit"/);
    expect(developer).toMatch(/M15_NODE_PACKAGE_MANAGER_SERVICE,\s*\n\s*"m15\.runtime\.inspect"/);

    // Commands with no catalog service must not borrow another service's identity.
    expect(developer).toContain('const M15_UNEXPOSED_SERVICE: &str = "m15_unexposed";');
    for (const unexposed of ['m15.repositories.scan', 'm15.projects.audit', 'm15.caches.manage', 'm15.http.execute']) {
      expect(developer, `${unexposed} reports M15_UNEXPOSED_SERVICE`).toMatch(
        new RegExp(`M15_UNEXPOSED_SERVICE,\\s*\\n\\s*"${unexposed.replaceAll('.', '\\.')}"`),
      );
    }
  });
});
