import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  FileJson,
  Gauge,
  Globe2,
  Network,
  Play,
  RefreshCcw,
  Route,
  Router,
  Server,
  ShieldCheck,
  Terminal,
  Wifi,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { networkClient } from './networkClient';
import type { NetworkReport } from './networkContracts';

type ServiceNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

type CardProps = {
  number: ServiceNumber;
  icon: React.ComponentType<{ size?: number }>;
  children?: React.ReactNode;
  actionLabel: string;
  onRun: () => void;
  busy: boolean;
  disabled: boolean;
  warning?: string;
};

function isSuccess(result: OperationResult<NetworkReport>): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export const NetworkOptimizerWorkspace: React.FC = () => {
  const { language } = useKnoux();
  const runtime = networkClient.runtimeState();
  const moduleData = MODULES_CATALOG.find(item => item.id === 'm08');
  const [hostTarget, setHostTarget] = useState('1.1.1.1');
  const [dnsDomain, setDnsDomain] = useState('example.com');
  const [count, setCount] = useState(4);
  const [timeoutMs, setTimeoutMs] = useState(1000);
  const [maxHops, setMaxHops] = useState(12);
  const [renewConfirmation, setRenewConfirmation] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [busyService, setBusyService] = useState<ServiceNumber | null>(null);
  const [result, setResult] = useState<OperationResult<NetworkReport> | null>(null);
  const [error, setError] = useState('');

  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const services = useMemo(() => new Map(moduleData?.services.map(item => [item.serviceNumber, item])), [moduleData]);

  const execute = async (number: ServiceNumber, task: () => Promise<OperationResult<NetworkReport>>) => {
    if (!runtime.available || busyService !== null) return;
    setBusyService(number);
    setError('');
    try {
      const next = await task();
      setResult(next);
      if (!isSuccess(next)) setError(language === 'ar' ? next.summaryAr : next.summaryEn);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusyService(null);
    }
  };

  const ServiceCard: React.FC<CardProps> = ({ number, icon: Icon, children, actionLabel, onRun, busy, disabled, warning }) => {
    const service = services.get(number);
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-lg shadow-black/10">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-2.5 text-sky-300"><Icon size={21} /></div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300/80">M08-S{String(number).padStart(2, '0')}</div>
            <h3 className="mt-1 text-base font-bold text-white">{language === 'ar' ? service?.nameAr : service?.nameEn}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-300">{language === 'ar' ? service?.descriptionAr : service?.descriptionEn}</p>
          </div>
        </div>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        {warning ? <div className="mt-3 flex gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{warning}</div> : null}
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || busy}
          className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <RefreshCcw size={17} className="animate-spin" /> : <Play size={17} />}
          {actionLabel}
        </button>
      </section>
    );
  };

  if (!moduleData) return null;

  return (
    <div className="space-y-5 p-1" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="overflow-hidden rounded-3xl border border-sky-400/15 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 p-6 shadow-2xl shadow-sky-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-300"><Wifi size={18} /> M08 — Network & Internet</div>
            <h1 className="mt-2 text-2xl font-black text-white sm:text-3xl">{tr('إصلاح وتحسين الإنترنت', 'Network Diagnostics & Repair')}</h1>
            <p className="mt-3 leading-7 text-slate-300">{tr(
              'تشخيص محولات الشبكة وعناوين IP وDNS وزمن الاستجابة والمسار والبروكسي وجدار الحماية، ثم تنفيذ إصلاحات ويندوز الرسمية فقط عند طلبك.',
              'Inspect adapters, IP configuration, DNS, latency, routes, proxy and firewall state, then run only explicit official Windows repairs when requested.',
            )}</p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="text-2xl font-black text-white">10</div><div className="mt-1 text-xs text-slate-400">{tr('خدمات حقيقية', 'Native services')}</div></div>
            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4"><ShieldCheck className="mx-auto text-emerald-300" size={25} /><div className="mt-1 text-xs text-emerald-100">{tr('بدون ضبط مخفي', 'No hidden tuning')}</div></div>
          </div>
        </div>
      </header>

      {!runtime.available ? (
        <div className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-100">
          <AlertTriangle className="mt-0.5 shrink-0" size={20} />
          <div><div className="font-bold">{tr('بيئة Windows المحلية غير متاحة', 'Windows desktop runtime unavailable')}</div><p className="mt-1 text-sm opacity-90">{language === 'ar' ? runtime.reasonAr : runtime.reasonEn}</p></div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <ServiceCard number={1} icon={Network} actionLabel={tr('عرض محولات الشبكة', 'Inspect adapters')} onRun={() => void execute(1, networkClient.adapters)} busy={busyService === 1} disabled={!runtime.available} />
        <ServiceCard number={2} icon={Router} actionLabel={tr('عرض إعدادات الاتصال', 'Inspect IP configuration')} onRun={() => void execute(2, networkClient.ipConfiguration)} busy={busyService === 2} disabled={!runtime.available} />

        <ServiceCard number={3} icon={Gauge} actionLabel={tr('بدء اختبار Ping', 'Run ping test')} onRun={() => void execute(3, () => networkClient.ping({ action: 'test', target: hostTarget, count, timeoutMs }))} busy={busyService === 3} disabled={!runtime.available}>
          <TargetFields target={hostTarget} setTarget={setHostTarget} count={count} setCount={setCount} timeoutMs={timeoutMs} setTimeoutMs={setTimeoutMs} tr={tr} />
        </ServiceCard>

        <ServiceCard number={4} icon={Route} actionLabel={tr('تتبع مسار الاتصال', 'Run traceroute')} onRun={() => void execute(4, () => networkClient.traceroute({ action: 'trace', target: hostTarget, timeoutMs, maxHops }))} busy={busyService === 4} disabled={!runtime.available}>
          <label className="block text-xs font-semibold text-slate-300">{tr('المضيف أو عنوان IP', 'Host or IP address')}<input value={hostTarget} onChange={event => setHostTarget(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-sky-400" /></label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField label={tr('أقصى عدد قفزات', 'Maximum hops')} value={maxHops} min={1} max={30} onChange={setMaxHops} />
            <NumberField label={tr('مهلة القفزة بالمللي ثانية', 'Hop timeout (ms)')} value={timeoutMs} min={100} max={3000} onChange={setTimeoutMs} />
          </div>
        </ServiceCard>

        <ServiceCard number={5} icon={Server} actionLabel={tr('اختبار خوادم DNS', 'Benchmark DNS servers')} onRun={() => void execute(5, () => networkClient.dnsBenchmark({ action: 'benchmark', target: dnsDomain }))} busy={busyService === 5} disabled={!runtime.available}>
          <label className="block text-xs font-semibold text-slate-300">{tr('اسم نطاق للاختبار', 'Domain to resolve')}<input value={dnsDomain} onChange={event => setDnsDomain(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-sky-400" /></label>
          <p className="text-xs leading-5 text-slate-400">{tr('يقيس Cloudflare وGoogle وQuad9 دون تغيير خادم DNS الحالي.', 'Measures Cloudflare, Google and Quad9 without changing the configured DNS server.')}</p>
        </ServiceCard>

        <ServiceCard number={6} icon={RefreshCcw} actionLabel={tr('تنظيف ذاكرة DNS', 'Flush DNS cache')} onRun={() => void execute(6, () => networkClient.flushDns({ action: 'flush' }))} busy={busyService === 6} disabled={!runtime.available} warning={tr('يمسح أسماء النطاقات المخزنة مؤقتًا فقط؛ لا يغيّر إعدادات DNS.', 'Clears cached name-resolution entries only; DNS settings are not changed.')} />

        <ServiceCard number={7} icon={Activity} actionLabel={tr('تجديد عنوان IP', 'Renew IP lease')} onRun={() => void execute(7, () => networkClient.renewIp({ action: 'renew', confirmation: renewConfirmation }))} busy={busyService === 7} disabled={!runtime.available || renewConfirmation !== 'RENEW IP LEASE'} warning={tr('قد ينقطع الاتصال مؤقتًا. اكتب RENEW IP LEASE للتأكيد.', 'Connectivity may drop briefly. Type RENEW IP LEASE to confirm.')}>
          <ConfirmationField value={renewConfirmation} onChange={setRenewConfirmation} phrase="RENEW IP LEASE" />
        </ServiceCard>

        <ServiceCard number={8} icon={RefreshCcw} actionLabel={tr('إعادة ضبط الشبكة', 'Reset network stack')} onRun={() => void execute(8, () => networkClient.resetStack({ action: 'reset', confirmation: resetConfirmation }))} busy={busyService === 8} disabled={!runtime.available || resetConfirmation !== 'RESET NETWORK STACK'} warning={tr('يستخدم أوامر Winsock وTCP/IP الرسمية ويتطلب إعادة تشغيل Windows. اكتب RESET NETWORK STACK للتأكيد.', 'Uses official Winsock and TCP/IP reset commands and requires a Windows restart. Type RESET NETWORK STACK to confirm.')}>
          <ConfirmationField value={resetConfirmation} onChange={setResetConfirmation} phrase="RESET NETWORK STACK" />
        </ServiceCard>

        <ServiceCard number={9} icon={ShieldCheck} actionLabel={tr('فحص البروكسي والجدار', 'Inspect proxy and firewall')} onRun={() => void execute(9, networkClient.proxyFirewall)} busy={busyService === 9} disabled={!runtime.available} warning={tr('الخدمة للقراءة فقط ولا تعطل جدار الحماية أو تحذف قواعده.', 'Read-only inspection; firewall profiles and rules are not disabled or removed.')} />

        <ServiceCard number={10} icon={FileJson} actionLabel={tr('إنشاء تقرير الشبكة', 'Export network report')} onRun={() => void execute(10, () => networkClient.exportReport({ action: 'export', target: hostTarget, count, timeoutMs }))} busy={busyService === 10} disabled={!runtime.available}>
          <p className="text-xs leading-5 text-slate-400">{tr('يحفظ تقرير JSON محليًا مع لقطة المحولات وIP وDNS والبروكسي والجدار واختبار Ping محدود.', 'Stores a local JSON report containing adapter, IP, DNS, proxy, firewall and bounded ping evidence.')}</p>
        </ServiceCard>
      </div>

      {error ? <div className="flex gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100"><AlertTriangle size={18} className="shrink-0" />{error}</div> : null}

      {result ? <ResultPanel result={result} language={language} /> : (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm text-slate-400"><Terminal className="mx-auto mb-2" size={24} />{tr('اختر خدمة لعرض النتائج والأدلة الأصلية هنا.', 'Run a service to view its native results and evidence here.')}</div>
      )}
    </div>
  );
};

const TargetFields: React.FC<{
  target: string;
  setTarget: (value: string) => void;
  count: number;
  setCount: (value: number) => void;
  timeoutMs: number;
  setTimeoutMs: (value: number) => void;
  tr: (ar: string, en: string) => string;
}> = ({ target, setTarget, count, setCount, timeoutMs, setTimeoutMs, tr }) => (
  <>
    <label className="block text-xs font-semibold text-slate-300">{tr('المضيف أو عنوان IP', 'Host or IP address')}<input value={target} onChange={event => setTarget(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-sky-400" /></label>
    <div className="grid grid-cols-2 gap-3">
      <NumberField label={tr('عدد المحاولات', 'Request count')} value={count} min={1} max={10} onChange={setCount} />
      <NumberField label={tr('المهلة بالمللي ثانية', 'Timeout (ms)')} value={timeoutMs} min={100} max={5000} onChange={setTimeoutMs} />
    </div>
  </>
);

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (value: number) => void }> = ({ label, value, min, max, onChange }) => (
  <label className="block text-xs font-semibold text-slate-300">{label}<input type="number" value={value} min={min} max={max} onChange={event => onChange(Number(event.target.value))} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-sm text-white outline-none focus:border-sky-400" /></label>
);

const ConfirmationField: React.FC<{ value: string; onChange: (value: string) => void; phrase: string }> = ({ value, onChange, phrase }) => (
  <label className="block text-xs font-semibold text-slate-300">{phrase}<input value={value} onChange={event => onChange(event.target.value)} autoComplete="off" spellCheck={false} className="mt-1 min-h-11 w-full rounded-xl border border-amber-400/20 bg-slate-950/70 px-3 font-mono text-sm text-white outline-none focus:border-amber-300" /></label>
);

const ResultPanel: React.FC<{ result: OperationResult<NetworkReport>; language: string }> = ({ result, language }) => {
  const ok = isSuccess(result);
  const data = result.data;
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {ok ? <CheckCircle2 className="mt-0.5 text-emerald-300" size={22} /> : <AlertTriangle className="mt-0.5 text-rose-300" size={22} />}
          <div><div className="font-bold text-white">{language === 'ar' ? result.summaryAr : result.summaryEn}</div><div className="mt-1 text-xs text-slate-400">{result.status} · {data?.measuredAt ?? result.completedAt}</div></div>
        </div>
        {data?.requiresRestart ? <div className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-100">{language === 'ar' ? 'يلزم إعادة تشغيل Windows' : 'Windows restart required'}</div> : null}
      </div>

      {data?.evidencePath ? <div className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/5 p-3 text-xs text-sky-100"><span className="font-bold">Evidence:</span> <span className="break-all font-mono">{data.evidencePath}</span></div> : null}
      {data?.artifacts?.length ? <div className="mt-3 space-y-2">{data.artifacts.map(item => <div key={`${item.kind}-${item.path}`} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-xs text-slate-300"><span className="font-bold text-white">{item.kind}:</span> <span className="break-all font-mono">{item.path}</span> · {item.exists ? `${item.sizeBytes} B` : 'not created'}</div>)}</div> : null}

      {data?.details !== undefined ? <div className="mt-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Globe2 size={15} /> Details</div><pre className="max-h-[420px] overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-left text-xs leading-6 text-slate-200" dir="ltr">{pretty(data.details)}</pre></div> : null}

      {data?.commands?.length ? <div className="mt-4 space-y-3"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400"><Terminal size={15} /> Native command evidence</div>{data.commands.map((command, index) => <details key={`${command.program}-${index}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><summary className="cursor-pointer text-sm font-semibold text-white">{command.success ? '✓' : '✕'} {command.program} {command.arguments.join(' ')}</summary><div className="mt-3 grid gap-3 lg:grid-cols-2"><pre className="max-h-72 overflow-auto rounded-xl bg-black/30 p-3 text-left text-xs text-slate-200" dir="ltr">{command.stdout || '(no stdout)'}</pre><pre className="max-h-72 overflow-auto rounded-xl bg-black/30 p-3 text-left text-xs text-rose-200" dir="ltr">{command.stderr || '(no stderr)'}</pre></div><div className="mt-2 text-xs text-slate-500">exit={String(command.exitCode ?? 'none')} · {command.durationMs} ms</div></details>)}</div> : null}
    </section>
  );
};
