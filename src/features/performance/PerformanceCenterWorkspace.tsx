import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BatteryCharging,
  CheckCircle2,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Wifi,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { performanceClient } from './performanceClient';
import type {
  BenchmarkReport,
  CpuSnapshot,
  DiskActivitySnapshot,
  HeavyProcessReport,
  MemorySnapshot,
  NetworkActivitySnapshot,
  PerformanceProfile,
  PowerPlanChange,
  PowerPlanResult,
  PriorityChange,
  ProcessExplorerSnapshot,
  ProcessItem,
  ProfileResult,
} from './performanceContracts';

type Tab = 'monitor' | 'processes' | 'controls' | 'benchmark';
type Priority = 'Idle' | 'BelowNormal' | 'Normal' | 'AboveNormal' | 'High';

function succeeded(result: OperationResult): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

function formatBytes(value = 0): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatRate(value = 0): string {
  return `${formatBytes(value)}/s`;
}

function clampPercent(value = 0): number {
  return Math.max(0, Math.min(100, value));
}

const tabs: Array<{ id: Tab; ar: string; en: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'monitor', ar: 'المراقبة الحية', en: 'Live Monitor', icon: Activity },
  { id: 'processes', ar: 'البرامج النشطة', en: 'Processes', icon: Cpu },
  { id: 'controls', ar: 'التحكم الآمن', en: 'Safe Controls', icon: SlidersHorizontal },
  { id: 'benchmark', ar: 'تقرير الأداء', en: 'Benchmark', icon: BarChart3 },
];

export const PerformanceCenterWorkspace: React.FC = () => {
  const { language } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm06');
  const runtime = performanceClient.runtimeState();
  const [tab, setTab] = useState<Tab>('monitor');
  const [cpu, setCpu] = useState<CpuSnapshot | null>(null);
  const [memory, setMemory] = useState<MemorySnapshot | null>(null);
  const [disk, setDisk] = useState<DiskActivitySnapshot | null>(null);
  const [network, setNetwork] = useState<NetworkActivitySnapshot | null>(null);
  const [heavy, setHeavy] = useState<HeavyProcessReport | null>(null);
  const [processes, setProcesses] = useState<ProcessExplorerSnapshot | null>(null);
  const [power, setPower] = useState<PowerPlanResult | null>(null);
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null);
  const [priorityChanges, setPriorityChanges] = useState<PriorityChange[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkReport | null>(null);
  const [selectedProcess, setSelectedProcess] = useState<ProcessItem | null>(null);
  const [priority, setPriority] = useState<Priority>('Normal');
  const [priorityConfirmation, setPriorityConfirmation] = useState('');
  const [selectedPowerGuid, setSelectedPowerGuid] = useState('');
  const [powerConfirmation, setPowerConfirmation] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileCpuThreshold, setProfileCpuThreshold] = useState(25);
  const [profileMemoryThreshold, setProfileMemoryThreshold] = useState(75);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const failure = (result: OperationResult) => setError(language === 'ar' ? result.summaryAr : result.summaryEn);

  const refreshMetrics = async () => {
    if (!runtime.available) return;
    setBusy(true);
    setError('');
    const results = await Promise.all([
      performanceClient.cpu(),
      performanceClient.memory(),
      performanceClient.disk(),
      performanceClient.network(),
      performanceClient.heavyProcesses(),
    ]);
    const [cpuResult, memoryResult, diskResult, networkResult, heavyResult] = results;
    if (succeeded(cpuResult) && cpuResult.data) setCpu(cpuResult.data);
    if (succeeded(memoryResult) && memoryResult.data) setMemory(memoryResult.data);
    if (succeeded(diskResult) && diskResult.data) setDisk(diskResult.data);
    if (succeeded(networkResult) && networkResult.data) setNetwork(networkResult.data);
    if (succeeded(heavyResult) && heavyResult.data) setHeavy(heavyResult.data);
    const failed = results.find(result => !succeeded(result));
    if (failed) failure(failed);
    setBusy(false);
  };

  const loadProcesses = async () => {
    if (!runtime.available) return;
    setBusy(true);
    setError('');
    const result = await performanceClient.processes(250);
    if (succeeded(result) && result.data) setProcesses(result.data);
    else failure(result);
    setBusy(false);
  };

  const loadControls = async () => {
    if (!runtime.available) return;
    const [priorityResult, powerResult, profilesResult] = await Promise.all([
      performanceClient.priority({ action: 'list' }),
      performanceClient.powerPlans({ action: 'list' }),
      performanceClient.profiles({ action: 'list' }),
    ]);
    if (succeeded(priorityResult) && priorityResult.data) setPriorityChanges(priorityResult.data.activeChanges);
    if (succeeded(powerResult) && powerResult.data) {
      setPower(powerResult.data);
      setSelectedPowerGuid(current => current || powerResult.data!.snapshot.activeGuid);
    }
    if (succeeded(profilesResult) && profilesResult.data) setProfileResult(profilesResult.data);
    const failed = [priorityResult, powerResult, profilesResult].find(result => !succeeded(result));
    if (failed) failure(failed);
  };

  useEffect(() => {
    if (!runtime.available) return;
    void refreshMetrics();
    void loadControls();
  }, [runtime.available]);

  useEffect(() => {
    if (!live || !runtime.available) return;
    const timer = window.setInterval(() => void refreshMetrics(), 4_000);
    return () => window.clearInterval(timer);
  }, [live, runtime.available]);

  const changePriority = async () => {
    if (!selectedProcess || selectedProcess.protected || busy) return;
    setBusy(true);
    setError('');
    const result = await performanceClient.priority({
      action: 'set',
      pid: selectedProcess.pid,
      priority,
      confirmation: priorityConfirmation,
    });
    if (succeeded(result) && result.data) {
      setPriorityChanges(result.data.activeChanges);
      setPriorityConfirmation('');
      await loadProcesses();
    } else failure(result);
    setBusy(false);
  };

  const restorePriority = async (change: PriorityChange) => {
    const confirmation = window.prompt(tr('اكتب RESTORE PRIORITY للاستعادة', 'Type RESTORE PRIORITY to restore')) ?? '';
    if (!confirmation) return;
    setBusy(true);
    const result = await performanceClient.priority({ action: 'restore', changeId: change.id, confirmation });
    if (succeeded(result) && result.data) setPriorityChanges(result.data.activeChanges);
    else failure(result);
    setBusy(false);
  };

  const changePower = async () => {
    if (!selectedPowerGuid || busy) return;
    setBusy(true);
    const result = await performanceClient.powerPlans({
      action: 'set',
      guid: selectedPowerGuid,
      confirmation: powerConfirmation,
    });
    if (succeeded(result) && result.data) {
      setPower(result.data);
      setPowerConfirmation('');
    } else failure(result);
    setBusy(false);
  };

  const restorePower = async (change: PowerPlanChange) => {
    const confirmation = window.prompt(tr('اكتب RESTORE POWER PLAN للاستعادة', 'Type RESTORE POWER PLAN to restore')) ?? '';
    if (!confirmation) return;
    setBusy(true);
    const result = await performanceClient.powerPlans({ action: 'restore', changeId: change.id, confirmation });
    if (succeeded(result) && result.data) setPower(result.data);
    else failure(result);
    setBusy(false);
  };

  const createProfile = async () => {
    if (!profileName.trim() || !selectedPowerGuid || busy) return;
    setBusy(true);
    const result = await performanceClient.profiles({
      action: 'create',
      name: profileName,
      powerSchemeGuid: selectedPowerGuid,
      cpuAttentionPercent: profileCpuThreshold,
      memoryAttentionPercent: profileMemoryThreshold,
    });
    if (succeeded(result) && result.data) {
      setProfileResult(result.data);
      setProfileName('');
    } else failure(result);
    setBusy(false);
  };

  const applyProfile = async (profile: PerformanceProfile) => {
    const confirmation = window.prompt(tr('اكتب APPLY PROFILE للتطبيق', 'Type APPLY PROFILE to apply')) ?? '';
    if (!confirmation) return;
    setBusy(true);
    const result = await performanceClient.profiles({ action: 'apply', profileId: profile.id, confirmation });
    if (succeeded(result) && result.data) {
      setProfileResult(result.data);
      await loadControls();
    } else failure(result);
    setBusy(false);
  };

  const deleteProfile = async (profile: PerformanceProfile) => {
    const confirmation = window.prompt(tr('اكتب DELETE PROFILE للحذف', 'Type DELETE PROFILE to delete')) ?? '';
    if (!confirmation) return;
    setBusy(true);
    const result = await performanceClient.profiles({ action: 'delete', profileId: profile.id, confirmation });
    if (succeeded(result) && result.data) setProfileResult(result.data);
    else failure(result);
    setBusy(false);
  };

  const runBenchmark = async () => {
    if (!runtime.available || busy) return;
    setBusy(true);
    setError('');
    const result = await performanceClient.benchmark();
    if (succeeded(result) && result.data) setBenchmark(result.data);
    else failure(result);
    setBusy(false);
  };

  const selectedPower = power?.snapshot.plans.find(item => item.guid === selectedPowerGuid);
  const totalDiskRead = useMemo(() => disk?.disks.reduce((sum, item) => sum + item.readBytesPerSec, 0) ?? 0, [disk]);
  const totalDiskWrite = useMemo(() => disk?.disks.reduce((sum, item) => sum + item.writeBytesPerSec, 0) ?? 0, [disk]);
  const totalNetwork = useMemo(() => network?.adapters.reduce((sum, item) => sum + item.bytesTotalPerSec, 0) ?? 0, [network]);

  if (!module) return null;

  return (
    <div className="min-h-full space-y-5 p-4 md:p-6" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 text-white shadow-2xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/20 p-3"><Gauge size={30} /></div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">KNOUX PERFORMANCE CENTER</p>
                <h1 className="text-2xl font-black md:text-3xl">{module.nameAr}</h1>
              </div>
            </div>
            <p className="max-w-3xl text-sm leading-7 text-slate-300">
              {tr('راقب موارد الجهاز الحقيقية، افهم البرامج الأعلى استهلاكًا، وطبّق تغييرات محدودة قابلة للاستعادة دون درجات أو نتائج مصطنعة.', 'Measure real device resources, inspect high-usage processes, and apply bounded reversible changes without fabricated scores.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void refreshMetrics()} disabled={!runtime.available || busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2 font-bold text-slate-950 disabled:opacity-50">
              <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />{tr('تحديث القياسات', 'Refresh')}
            </button>
            <button type="button" onClick={() => setLive(value => !value)} disabled={!runtime.available} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 font-bold ${live ? 'border-emerald-400 bg-emerald-500/20' : 'border-white/20 bg-white/5'}`}>
              <Activity size={17} />{live ? tr('إيقاف التحديث الحي', 'Stop Live') : tr('تشغيل التحديث الحي', 'Start Live')}
            </button>
          </div>
        </div>
      </section>

      {!runtime.available && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          {tr('هذه القياسات تعمل داخل تطبيق KNOUX ONE لسطح المكتب فقط. نسخة الويب لا تعرض بيانات تجريبية.', 'These measurements run only in the KNOUX ONE desktop app. Web preview does not fabricate host data.')}
        </div>
      )}
      {error && <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

      <nav className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/60 p-2 md:grid-cols-4">
        {tabs.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition ${tab === item.id ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-white/5'}`}>
              <Icon size={17} />{tr(item.ar, item.en)}
            </button>
          );
        })}
      </nav>

      {tab === 'monitor' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { icon: Cpu, title: tr('استخدام المعالج', 'CPU Usage'), value: `${(cpu?.totalPercent ?? 0).toFixed(1)}%`, note: cpu ? `${cpu.currentMhz} / ${cpu.maxMhz} MHz` : '—' },
              { icon: MemoryStick, title: tr('استخدام الذاكرة', 'Memory Usage'), value: `${(memory?.loadPercent ?? 0).toFixed(1)}%`, note: memory ? `${formatBytes(memory.usedPhysicalBytes)} / ${formatBytes(memory.totalPhysicalBytes)}` : '—' },
              { icon: HardDrive, title: tr('نشاط القرص', 'Disk Activity'), value: formatRate(totalDiskRead + totalDiskWrite), note: `${tr('قراءة', 'Read')} ${formatRate(totalDiskRead)} · ${tr('كتابة', 'Write')} ${formatRate(totalDiskWrite)}` },
              { icon: Wifi, title: tr('نشاط الشبكة', 'Network Activity'), value: formatRate(totalNetwork), note: `${network?.processConnections.length ?? 0} ${tr('برنامجًا باتصال نشط', 'processes with active connections')}` },
            ].map(card => (
              <article key={card.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5 shadow-lg">
                <div className="mb-4 flex items-center justify-between"><card.icon size={23} className="text-blue-400" /><span className="h-2 w-2 rounded-full bg-emerald-400" /></div>
                <p className="text-xs font-semibold text-slate-400">{card.title}</p>
                <p className="mt-2 text-2xl font-black text-white">{card.value}</p>
                <p className="mt-2 text-xs text-slate-400">{card.note}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h2 className="mb-4 flex items-center gap-2 font-black text-white"><Cpu size={19} />{tr('نشاط الأنوية', 'Core Activity')}</h2>
              <div className="space-y-3">
                {(cpu?.cores ?? []).map(core => (
                  <div key={core.name}>
                    <div className="mb-1 flex justify-between text-xs text-slate-300"><span>Core {core.name}</span><span>{core.utilizationPercent.toFixed(1)}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${clampPercent(core.utilizationPercent)}%` }} /></div>
                  </div>
                ))}
                {!cpu?.cores.length && <p className="text-sm text-slate-500">{tr('لم تصل قياسات المعالج بعد.', 'CPU measurements have not arrived yet.')}</p>}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
              <h2 className="mb-4 flex items-center gap-2 font-black text-white"><HardDrive size={19} />{tr('الأقراص الفعلية', 'Physical Disks')}</h2>
              <div className="space-y-3">
                {(disk?.disks ?? []).map(item => (
                  <div key={item.name} className="rounded-xl border border-white/5 bg-white/[0.03] p-3">
                    <div className="flex justify-between text-sm font-bold text-white"><span>{item.name}</span><span>{item.activeTimePercent.toFixed(1)}%</span></div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400"><span>{tr('قراءة', 'Read')}: {formatRate(item.readBytesPerSec)}</span><span>{tr('كتابة', 'Write')}: {formatRate(item.writeBytesPerSec)}</span><span>{tr('العمليات', 'Transfers')}: {item.transfersPerSec}/s</span><span>{tr('الطابور', 'Queue')}: {item.queueLength}</span></div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-black text-white"><Network size={19} />{tr('الشبكة والاتصالات النشطة', 'Network and Active Connections')}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(network?.adapters ?? []).map(adapter => (
                <div key={adapter.name} className="rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                  <p className="font-bold text-white">{adapter.name}</p>
                  <p className="mt-2 text-slate-400">↓ {formatRate(adapter.bytesReceivedPerSec)} · ↑ {formatRate(adapter.bytesSentPerSec)}</p>
                </div>
              ))}
            </div>
            {network && <p className="mt-4 text-xs leading-6 text-slate-400">{language === 'ar' ? network.bandwidthNoticeAr : network.bandwidthNoticeEn}</p>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="mb-4 flex items-center gap-2 font-black text-white"><Gauge size={19} />{tr('الأعلى استهلاكًا في العينة الحالية', 'Highest Usage in Current Sample')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-slate-500"><tr><th className="p-2 text-start">PID</th><th className="p-2 text-start">{tr('البرنامج', 'Process')}</th><th className="p-2 text-start">CPU</th><th className="p-2 text-start">RAM</th><th className="p-2 text-start">{tr('ملاحظات', 'Evidence')}</th></tr></thead>
                <tbody>{(heavy?.processes ?? []).map(item => <tr key={item.pid} className="border-t border-white/5 text-slate-300"><td className="p-2">{item.pid}</td><td className="p-2 font-bold text-white">{item.name}</td><td className="p-2">{item.cpuPercent.toFixed(1)}%</td><td className="p-2">{formatBytes(item.workingSetBytes)}</td><td className="p-2 text-xs">{item.reasons.join(' · ') || '—'}</td></tr>)}</tbody>
              </table>
            </div>
            {heavy && <p className="mt-4 text-xs text-slate-400">{language === 'ar' ? heavy.leakNoticeAr : heavy.leakNoticeEn}</p>}
          </section>
        </div>
      )}

      {tab === 'processes' && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="font-black text-white">{tr('مستكشف البرامج النشطة', 'Active Process Explorer')}</h2><p className="text-xs text-slate-400">{processes ? `${processes.totalProcesses} ${tr('عملية مقاسة', 'measured processes')}` : tr('اضغط لقراءة العمليات من Windows.', 'Load processes from Windows.')}</p></div>
            <button type="button" onClick={() => void loadProcesses()} disabled={!runtime.available || busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50"><RefreshCw size={17} />{tr('قراءة العمليات', 'Load Processes')}</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-slate-500"><tr><th className="p-2 text-start">PID</th><th className="p-2 text-start">{tr('البرنامج', 'Process')}</th><th className="p-2 text-start">RAM</th><th className="p-2 text-start">CPU s</th><th className="p-2 text-start">{tr('الأولوية', 'Priority')}</th><th className="p-2 text-start">{tr('المسار', 'Path')}</th><th className="p-2" /></tr></thead>
              <tbody>{(processes?.processes ?? []).map(item => <tr key={item.pid} className={`border-t border-white/5 ${selectedProcess?.pid === item.pid ? 'bg-blue-500/10' : ''}`}><td className="p-2 text-slate-400">{item.pid}</td><td className="p-2 font-bold text-white">{item.name}{item.protected && <ShieldCheck size={14} className="ms-2 inline text-amber-400" />}</td><td className="p-2 text-slate-300">{formatBytes(item.workingSetBytes)}</td><td className="p-2 text-slate-300">{item.cpuSeconds.toFixed(1)}</td><td className="p-2 text-slate-300">{item.priority}</td><td className="max-w-md truncate p-2 text-xs text-slate-500" title={item.executablePath}>{item.executablePath || '—'}</td><td className="p-2"><button type="button" disabled={item.protected} onClick={() => setSelectedProcess(item)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-30">{tr('اختيار', 'Select')}</button></td></tr>)}</tbody>
            </table>
          </div>
          {selectedProcess && !selectedProcess.protected && (
            <div className="grid gap-3 rounded-2xl border border-blue-400/20 bg-blue-500/5 p-4 md:grid-cols-[1fr_180px_1fr_auto] md:items-end">
              <div><p className="text-xs text-slate-400">{tr('البرنامج المختار', 'Selected process')}</p><p className="font-black text-white">{selectedProcess.name} · PID {selectedProcess.pid}</p></div>
              <label className="text-xs text-slate-400">{tr('الأولوية الجديدة', 'New priority')}<select value={priority} onChange={event => setPriority(event.target.value as Priority)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white"><option>Idle</option><option>BelowNormal</option><option>Normal</option><option>AboveNormal</option><option>High</option></select></label>
              <label className="text-xs text-slate-400">{tr(`اكتب PRIORITY ${selectedProcess.pid}`, `Type PRIORITY ${selectedProcess.pid}`)}<input value={priorityConfirmation} onChange={event => setPriorityConfirmation(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-white" /></label>
              <button type="button" onClick={() => void changePriority()} disabled={busy || priorityConfirmation !== `PRIORITY ${selectedProcess.pid}`} className="min-h-11 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-40">{tr('تطبيق', 'Apply')}</button>
            </div>
          )}
        </section>
      )}

      {tab === 'controls' && (
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="flex items-center gap-2 font-black text-white"><BatteryCharging size={19} />{tr('خطط الطاقة المثبتة', 'Installed Power Plans')}</h2>
            <select value={selectedPowerGuid} onChange={event => setSelectedPowerGuid(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white">
              {(power?.snapshot.plans ?? []).map(plan => <option key={plan.guid} value={plan.guid}>{plan.name}{plan.active ? ` · ${tr('نشطة', 'Active')}` : ''}</option>)}
            </select>
            <p className="text-xs text-slate-400">{selectedPower?.guid || '—'}</p>
            <input value={powerConfirmation} onChange={event => setPowerConfirmation(event.target.value)} placeholder="CHANGE POWER PLAN" className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white" />
            <button type="button" onClick={() => void changePower()} disabled={busy || powerConfirmation !== 'CHANGE POWER PLAN'} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-40"><Play size={17} />{tr('تفعيل الخطة', 'Activate Plan')}</button>
            {!!power?.activeChanges.length && <div className="space-y-2 border-t border-white/10 pt-4">{power.activeChanges.map(change => <div key={change.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] p-3 text-xs text-slate-300"><span>{change.selectedGuid.slice(0, 8)} ← {change.previousGuid.slice(0, 8)}</span><button type="button" onClick={() => void restorePower(change)} className="inline-flex items-center gap-1 font-bold text-blue-300"><RotateCcw size={14} />{tr('استعادة', 'Restore')}</button></div>)}</div>}
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <h2 className="flex items-center gap-2 font-black text-white"><Save size={19} />{tr('بروفايلات الأداء الآمنة', 'Safe Performance Profiles')}</h2>
            <input value={profileName} onChange={event => setProfileName(event.target.value)} placeholder={tr('اسم البروفايل', 'Profile name')} className="w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white" />
            <div className="grid grid-cols-2 gap-3"><label className="text-xs text-slate-400">CPU %<input type="number" min={5} max={100} value={profileCpuThreshold} onChange={event => setProfileCpuThreshold(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white" /></label><label className="text-xs text-slate-400">RAM %<input type="number" min={10} max={100} value={profileMemoryThreshold} onChange={event => setProfileMemoryThreshold(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 p-3 text-white" /></label></div>
            <button type="button" onClick={() => void createProfile()} disabled={busy || !profileName.trim() || !selectedPowerGuid} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-bold text-white disabled:opacity-40"><Save size={17} />{tr('حفظ بروفايل', 'Save Profile')}</button>
            <div className="space-y-2 border-t border-white/10 pt-4">{(profileResult?.profiles ?? []).map(profile => <div key={profile.id} className={`rounded-xl border p-3 ${profileResult?.activeProfileId === profile.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/5 bg-white/[0.03]'}`}><div className="flex items-center justify-between"><div><p className="font-bold text-white">{profile.name}</p><p className="text-xs text-slate-400">CPU {profile.cpuAttentionPercent}% · RAM {profile.memoryAttentionPercent}%</p></div><div className="flex gap-2"><button type="button" onClick={() => void applyProfile(profile)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">{tr('تطبيق', 'Apply')}</button><button type="button" onClick={() => void deleteProfile(profile)} className="rounded-lg border border-red-400/20 p-2 text-red-300"><Trash2 size={14} /></button></div></div></div>)}</div>
          </section>

          <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-5 xl:col-span-2">
            <h2 className="font-black text-white">{tr('تغييرات أولوية البرامج القابلة للاستعادة', 'Restorable Process Priority Changes')}</h2>
            {!priorityChanges.length && <p className="text-sm text-slate-500">{tr('لا توجد تغييرات نشطة.', 'No active changes.')}</p>}
            {priorityChanges.map(change => <div key={change.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.03] p-3 text-sm"><span className="text-slate-300">{change.processName} · PID {change.pid}: {change.previousPriority} → {change.newPriority}</span><button type="button" onClick={() => void restorePriority(change)} className="inline-flex items-center gap-2 font-bold text-blue-300"><RotateCcw size={15} />{tr('استعادة الأولوية', 'Restore Priority')}</button></div>)}
          </section>
        </div>
      )}

      {tab === 'benchmark' && (
        <section className="space-y-5 rounded-2xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black text-white">{tr('تقرير أداء محلي محدود', 'Bounded Local Performance Report')}</h2><p className="text-xs text-slate-400">{tr('اختبار بصمات CPU وملف مؤقت بحجم 8 MB يتم حذفه بعد القراءة.', 'CPU hashing and an 8 MB temporary file removed after reading.')}</p></div><button type="button" onClick={() => void runBenchmark()} disabled={!runtime.available || busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-bold text-white disabled:opacity-40"><BarChart3 size={17} />{tr('بدء القياس', 'Run Benchmark')}</button></div>
          {benchmark && <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-white/[0.03] p-5"><p className="text-xs text-slate-400">CPU Hash/s</p><p className="mt-2 text-2xl font-black text-white">{Math.round(benchmark.cpuHashesPerSec).toLocaleString()}</p></div><div className="rounded-2xl bg-white/[0.03] p-5"><p className="text-xs text-slate-400">{tr('كتابة القرص', 'Disk Write')}</p><p className="mt-2 text-2xl font-black text-white">{benchmark.diskWriteMbps.toFixed(1)} MB/s</p></div><div className="rounded-2xl bg-white/[0.03] p-5"><p className="text-xs text-slate-400">{tr('قراءة القرص', 'Disk Read')}</p><p className="mt-2 text-2xl font-black text-white">{benchmark.diskReadMbps.toFixed(1)} MB/s</p></div><div className="rounded-2xl border border-white/10 p-4 text-sm text-slate-300 md:col-span-3"><div className="mb-2 flex items-center gap-2 text-emerald-300"><CheckCircle2 size={17} />{benchmark.temporaryFileRemoved ? tr('تم حذف الملف المؤقت', 'Temporary file removed') : tr('تعذر حذف الملف المؤقت', 'Temporary file removal failed')}</div><p className="break-all text-xs text-slate-500">{benchmark.reportPath}</p><p className="mt-3 text-xs text-slate-400">{language === 'ar' ? benchmark.noticeAr : benchmark.noticeEn}</p></div></div>}
        </section>
      )}
    </div>
  );
};
