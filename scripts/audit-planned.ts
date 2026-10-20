import { readFileSync } from 'node:fs';
import { NATIVE_COMMANDS } from '../src/services/nativeCommandRegistry';

const baseline = JSON.parse(readFileSync('docs/services/service-reality-baseline.json', 'utf8'));
const services = baseline.services as Array<{
  moduleId: string;
  serviceId: string;
  name: string;
  state: string;
  handlerId?: string;
}>;
const registry = NATIVE_COMMANDS as Record<string, string>;
const bound = new Set(services.map(s => s.handlerId).filter(Boolean) as string[]);

const focus = ['M01', 'M02', 'M03', 'M04', 'M05', 'M15', 'M16'];
for (const moduleId of focus) {
  console.log(`\n===== ${moduleId} =====`);
  for (const s of services.filter(x => x.moduleId === moduleId)) {
    const handler = s.handlerId ?? '(none)';
    const mark = s.state === 'PLANNED' ? 'PLANNED ' : s.state === 'RUNTIME_VERIFIED' ? 'RUNTIME  ' : 'STATIC   ';
    console.log(`  ${mark} ${s.serviceId} ${s.name}`);
    console.log(`            handler: ${handler}`);
    if (!s.handlerId) {
      const candidates = Object.keys(registry).filter(h => h.startsWith(moduleId.toLowerCase()) && !bound.has(h));
      if (candidates.length) console.log(`            unbound native in module: ${candidates.join(', ')}`);
    }
  }
}
