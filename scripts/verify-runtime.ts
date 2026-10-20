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
  /** Display name of the service card to act on (card-scoped click). */
  service?: string;
  /** Exact text of a control to click (used when the workspace has no cards). */
  click?: string;
  /** Optional action-button text inside that card. */
  action?: string;
  /** Optional navigation click performed before the service action. */
  navigate?: string;
  /** Optional click that leaves the current workspace first, so the target
   *  workspace remounts and its measurement is rendered from empty. */
  reset?: string;
  /** Capture the page text before navigating, so the delta contains the whole
   *  rendered workspace rather than only the part that changed in place. */
  beforeNavigate?: boolean;
  /** Optional sequence of clicks performed before the service action. */
  prepare?: string[];
  /** Service ids this single control drives. A workspace control can start a
   *  monitor that produces several measurements at once. */
  services?: string[];
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

/**
 * Text of the panel the clicked control belongs to.
 *
 * The whole-page diff is unreliable: the service card name is already on screen,
 * and a workspace that re-renders identical content produces no diff at all.
 * Reading the panel that actually received the control is what proves the
 * measurement was rendered.
 *
 * For a card-scoped step the panel is found through the service heading, because
 * several cards can carry a button with the same text.
 */
const PANEL_TEXT_SCRIPT = (heading: string | null, label: string | null): string => `(() => {
  let panel = null;
  if (${JSON.stringify(heading)}) {
    const wanted = ${JSON.stringify(heading)}.toLowerCase();
    const found = Array.from(document.querySelectorAll('h1,h2,h3,h4')).find(h => (h.innerText || '').trim().toLowerCase().includes(wanted));
    if (found) panel = found.closest('article, section, li') || found.parentElement;
  }
  if (!panel && ${JSON.stringify(label)}) {
    const wanted = ${JSON.stringify(label)}.toLowerCase();
    const control = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]')).find(n => {
      const text = (n.innerText || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      return text.includes(wanted) && n.getBoundingClientRect().width > 0;
    });
    if (control) panel = control.closest('article, section, li') || document.querySelector('main') || document.body;
  }
  return panel ? (panel.innerText || '').replace(/\\s+/g, ' ').trim() : null;
})()`;

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const parsed = JSON.parse(readFileSync(args.planPath, 'utf8')) as PlanStep[] | { comment?: string; steps: PlanStep[] };
  let plan: PlanStep[];
  if (Array.isArray(parsed)) {
    // A plan file is either a flat list of steps or a single wrapper object
    // that carries a comment plus the list.
    const only = parsed[0] as PlanStep & { steps?: PlanStep[] } | undefined;
    plan = only && !only.serviceId && Array.isArray(only.steps) ? only.steps : parsed;
  } else {
    plan = parsed.steps;
  }
  if (plan.length === 0) {
    throw new Error(`No steps found in ${args.planPath}`);
  }

  const target = await findTarget(args.port, 'KNOUX');
  const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  const records: any[] = [];

  for (const step of plan) {
    const startedAt = new Date().toISOString();

    // When the step wants the whole rendered workspace as evidence, the page
    // text has to be captured before the workspace is entered.
    let before = '';
    if (step.beforeNavigate) {
      before = await cdp.evaluate<string>(BODY_TEXT_SCRIPT);
    }

    if (step.reset) {
      await cdp.evaluate(TEXT_CLICK_SCRIPT(step.reset));
      await sleep(1400);
    }

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

    for (const prepare of step.prepare ?? []) {
      await cdp.evaluate(TEXT_CLICK_SCRIPT(prepare));
      await sleep(1400);
    }

    const clickScript = step.click
      ? TEXT_CLICK_SCRIPT(step.click)
      : CARD_CLICK_SCRIPT(step.service ?? '', step.action ?? null);
    if (!step.click && !step.service) {
      records.push({
        serviceId: step.serviceId,
        handlerId: step.handlerId,
        nativeCommand: step.nativeCommand,
        status: 'control_not_specified',
        startedAt,
        detail: 'The step names neither a control nor a service card.',
      });
      console.log(`SKIP  ${step.serviceId}: no control specified`);
      continue;
    }
    const beforeClick = await cdp.evaluate<string>(BODY_TEXT_SCRIPT);
    const click = await cdp.evaluate<{
      ok: boolean;
      reason?: string;
      label?: string;
      heading?: string;
      disabled?: boolean;
      available?: string[];
    }>(clickScript);

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

    const beforeSnapshot = step.beforeNavigate ? before : beforeClick;
    const after = await cdp.evaluate<string>(BODY_TEXT_SCRIPT);
    // Only text that appeared after the click counts as the rendered result.
    // The service card name is already on the page, so a whole-page match would
    // pass even when nothing was measured. Compare on the longest common prefix
    // so a re-rendered page still yields the text that changed.
    let common = 0;
    const limit = Math.min(beforeSnapshot.length, after.length);
    while (common < limit && beforeSnapshot[common] === after[common]) common += 1;
    const delta = after.slice(common).trim();

    // The panel that owns the clicked control is the fallback evidence: it is
    // the area the user actually sees after the command runs.
    const panelText = await cdp.evaluate<string | null>(
      PANEL_TEXT_SCRIPT(step.service ?? null, click.label ?? null),
    );
    const evidence = (delta.length > 0 ? delta : (panelText ?? '')).trim();

    const expectationMet = step.expect ? evidence.toLowerCase().includes(step.expect.toLowerCase()) : null;
    // A failure banner is rendered in the workspace, not necessarily in the card,
    // so the whole page is searched for it.
    const failureMarker = /powershell_command_failed|powershell_json_failed|powershell_json_invalid|desktop_runtime_unavailable|command_failed|operation_failed|error_code|errorCode/i.exec(
      `${evidence} ${after}`,
    );

    for (const serviceId of step.services ?? [step.serviceId]) {
      records.push({
        serviceId,
        handlerId: step.handlerId,
        nativeCommand: step.nativeCommand,
        status: failureMarker ? 'rendered_with_error' : evidence.length === 0 ? 'no_visible_change' : 'completed',
        startedAt,
        capturedAt: new Date().toISOString(),
        controlText: click.label,
        cardHeading: click.heading,
        expectation: step.expect ?? null,
        expectationMet,
        failureMarker: failureMarker ? failureMarker[0] : null,
        renderedEvidence: evidence.slice(0, 1500),
      });
    }

    console.log(
      `${failureMarker || evidence.length === 0 || expectationMet === false ? 'CHECK' : 'OK   '} ${step.serviceId} (${step.nativeCommand})`,
    );
  }

  writeFileSync(args.outPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  console.log(`\nWrote ${records.length} records to ${args.outPath}`);
  cdp.close();
}

await main();
