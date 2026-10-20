/**
 * KNOUX ONE — runtime verification driver.
 *
 * Drives the real desktop application through the Chrome DevTools Protocol that
 * WebView2 exposes when the process is started with `--remote-debugging-port`.
 * This is the same renderer the user sees, so a click here is a real click in
 * the real window: it crosses the Tauri IPC boundary, runs the native Rust
 * command against real Windows, and renders the measured result back into the
 * same DOM that is read afterwards.
 *
 * It never fabricates a result. Every record states what was observed: the
 * control that was clicked, whether the expected text appeared, and the text
 * that came back. A step that cannot find its control is recorded as
 * `control_not_found`, never as a pass.
 *
 * Usage:
 *   bun scripts/verify-runtime.ts --port 9222 --plan scripts/runtime-plan.json
 */

import { readFileSync, writeFileSync } from 'node:fs';

type Target = {
  id: string;
  type: string;
  title: string;
  url: string;
  webSocketDebuggerUrl: string;
};

type PlanStep = {
  serviceId: string;
  handlerId: string;
  nativeCommand: string;
  /** Display name of the service card to act on. */
  service: string;
  /** Optional action-button text inside that card. */
  action?: string;
  /** Optional navigation click performed before the service action. */
  navigate?: string;
  /** Text that must appear in the rendered result for the step to pass. */
  expect?: string;
  /** Milliseconds to wait for the native result to render. */
  waitMs?: number;
};

type Args = { port: number; planPath: string; outPath: string };

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const index = argv.indexOf(flag);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  return {
    port: Number(get('--port', '9222')),
    planPath: get('--plan', 'scripts/runtime-plan.json'),
    outPath: get('--out', 'docs/evidence/runtime-records.json'),
  };
}

class Cdp {
  private socket: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  private constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', event => {
      const message = JSON.parse(String((event as MessageEvent).data));
      if (message.id && this.pending.has(message.id)) {
        const entry = this.pending.get(message.id)!;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
        else entry.resolve(message.result);
      }
    });
  }

  static async connect(url: string): Promise<Cdp> {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error(`cannot connect to ${url}`)), { once: true });
    });
    return new Cdp(socket);
  }

  send(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate<T>(expression: string): Promise<T> {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`page threw: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result.value as T;
  }

  close(): void {
    this.socket.close();
  }
}

async function findTarget(port: number, titlePart: string): Promise<Target> {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = (await response.json()) as Target[];
  const page = targets.find(
    target => target.type === 'page' && target.title.toLowerCase().includes(titlePart.toLowerCase()),
  );
  if (!page) {
    throw new Error(
      `no page target titled like "${titlePart}". Targets: ${targets.map(t => `${t.type}:${t.title}`).join(' | ')}`,
    );
  }
  return page;
}

const CARD_CLICK_SCRIPT = (service: string, action: string | null): string => `(() => {
  const wanted = ${JSON.stringify(service)}.toLowerCase();
  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
  const heading = headings.find(h => (h.innerText || '').trim().toLowerCase().includes(wanted));
  if (!heading) {
    return { ok: false, reason: 'no heading matched', available: headings.map(h => (h.innerText || '').trim()).filter(Boolean).slice(0, 60) };
  }
  const card = heading.closest('article, li, section, div.knoux-service-card, div.knoux-module-card') || heading.parentElement;
  const buttons = Array.from(card.querySelectorAll('button')).filter(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  if (buttons.length === 0) return { ok: false, reason: 'card has no visible button' };
  const actionText = ${JSON.stringify(action)};
  let target = null;
  if (actionText) {
    target = buttons.find(b => (b.innerText || '').trim().toLowerCase().includes(actionText.toLowerCase()));
  }
  if (!target) target = buttons[buttons.length - 1];
  const label = (target.innerText || target.getAttribute('aria-label') || '').trim();
  if (target.disabled) return { ok: false, reason: 'control is disabled', label, disabled: true };
  target.scrollIntoView({ block: 'center' });
  target.click();
  return { ok: true, label: label.slice(0, 120), heading: (heading.innerText || '').trim().slice(0, 120) };
})()`;

const TEXT_CLICK_SCRIPT = (label: string): string => `(() => {
  const wanted = ${JSON.stringify(label)}.toLowerCase();
  const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
  for (const node of nodes) {
    const text = (node.innerText || node.textContent || '').trim().toLowerCase();
    if (!text.includes(wanted)) continue;
    const r = node.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    node.scrollIntoView({ block: 'center' });
    node.click();
    return { ok: true, label: (node.innerText || '').trim().slice(0, 120) };
  }
  return { ok: false, reason: 'no visible control matched' };
})()`;

const BODY_TEXT_SCRIPT = `(() => {
  const main = document.querySelector('main') || document.body;
  return (main.innerText || '').replace(/\\s+/g, ' ').trim();
})()`;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(readFileSync(args.planPath, 'utf8')) as PlanStep[];

  const target = await findTarget(args.port, 'KNOUX');
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const records: any[] = [];

  for (const step of plan) {
    const startedAt = new Date().toISOString();

    if (step.navigate) {
      const nav = await cdp.evaluate<{ ok: boolean; label?: string }>(TEXT_CLICK_SCRIPT(step.navigate));
      if (!nav.ok) {
        records.push({
          serviceId: step.serviceId,
          handlerId: step.handlerId,
          nativeCommand: step.nativeCommand,
          status: 'navigation_not_found',
          startedAt,
          detail: `Could not reach "${step.navigate}".`,
        });
        console.log(`NAV   ${step.serviceId}: navigation "${step.navigate}" not found`);
        continue;
      }
      await sleep(1200);
    }

    const before = await cdp.evaluate<string>(BODY_TEXT_SCRIPT);
    const click = await cdp.evaluate<{
      ok: boolean;
      reason?: string;
      label?: string;
      heading?: string;
      disabled?: boolean;
      available?: string[];
    }>(CARD_CLICK_SCRIPT(step.service, step.action ?? null));

    if (!click.ok) {
      records.push({
        serviceId: step.serviceId,
        handlerId: step.handlerId,
        nativeCommand: step.nativeCommand,
        status: 'control_not_found',
        startedAt,
        detail: click.reason ?? 'control not found',
        availableHeadings: click.available ?? [],
      });
      console.log(`SKIP  ${step.serviceId}: ${click.reason}`);
      continue;
    }

    await sleep(step.waitMs ?? 4000);

    const after = await cdp.evaluate<string>(BODY_TEXT_SCRIPT);
    // Only text that appeared after the click counts as the rendered result.
    // The service card name is already on the page, so a whole-page match would
    // pass even when nothing was measured.
    const delta = after.startsWith(before) ? after.slice(before.length).trim() : after;
    const expectationMet = step.expect ? delta.toLowerCase().includes(step.expect.toLowerCase()) : null;
    const failureMarker = /powershell_command_failed|desktop_runtime_unavailable|command_failed|failed to|error:/i.exec(delta);

    records.push({
      serviceId: step.serviceId,
      handlerId: step.handlerId,
      nativeCommand: step.nativeCommand,
      status: failureMarker ? 'rendered_with_error' : delta.length === 0 ? 'no_visible_change' : 'completed',
      startedAt,
      capturedAt: new Date().toISOString(),
      controlText: click.label,
      cardHeading: click.heading,
      expectation: step.expect ?? null,
      expectationMet,
      failureMarker: failureMarker ? failureMarker[0] : null,
      renderedEvidence: delta.slice(0, 1500),
    });

    console.log(
      `${failureMarker || delta.length === 0 || expectationMet === false ? 'CHECK' : 'OK   '} ${step.serviceId} (${step.nativeCommand})`,
    );
  }

  writeFileSync(args.outPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${records.length} records to ${args.outPath}`);
  cdp.close();
}

await main();
