import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Cpu, Download, HardDrive, Monitor, PackageCheck, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { setupClient } from './setupClient';
import type { InstallQueueItem, SystemDiscoveryData } from './setupContracts';

const PACKAGES = [
  ['Google.Chrome', 'Google Chrome'],
  ['Mozilla.Firefox', 'Mozilla Firefox'],
  ['Brave.Brave', 'Brave Browser'],
  ['7zip.7zip', '7-Zip'],
  ['Microsoft.PowerToys', 'Microsoft PowerToys'],
  ['voidtools.Everything', 'Everything Search'],
  ['Notepad++.Notepad++', 'Notepad++'],
  ['Telegram.TelegramDesktop', 'Telegram Desktop'],
  ['WhatsApp.WhatsApp', 'WhatsApp'],
  ['Discord.Discord', 'Discord'],
  ['VideoLAN.VLC', 'VLC Media Player'],
  ['Spotify.Spotify', 'Spotify'],
  ['Microsoft.VisualStudioCode', 'Visual Studio Code'],
  ['Git.Git', 'Git'],
  ['OpenJS.NodeJS.LTS', 'Node.js LTS'],
  ['Python.Python.3.12', 'Python 3.12'],
  ['Microsoft.WindowsTerminal', 'Windows Terminal'],
  ['Figma.Figma', 'Figma'],
] as const;

function statusClass(status: string): string {
  if (status === 'completed') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  if (status === 'failed') return 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  if (status === 'running') return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
}

export const WindowsSetupWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm01');
  const runtime = setupClient.runtimeState();
  const [hardware, setHardware] = useState<SystemDiscoveryData | null>(null);
  const [queue, setQueue] = useState<InstallQueueItem[]>([]);
  const [wingetStatus, setWingetStatus] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES[0][0]);
  const [busy, setBusy] = useState<'hardware' | 'verify' | 'install' | 'resume' | null>(null);
  const [message, setMessage] = useState('');

  const loadQueue = async () => {
    if (!runtime.available) return;
    try {
      setQueue(await setupClient.queue());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [runtime.available]);

  const discover = async () => {
    if (!runtime.available || busy) return;
    setBusy('hardware');
    setMessage('');
    addLog('m01_s01', t('Hardware discovery', 'اكتشاف مكونات الجهاز'), 'in_progress', t('Reading Windows CIM and security providers.', 'قراءة CIM ومصادر أمان ويندوز.'));
    const result = await setupClient.discover();
    setBusy(null);
    if (result.data) setHardware(result.data);
    setMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m01_s01', t('Hardware discovery', 'اكتشاف مكونات الجهاز'), result.status === 'completed' || result.status === 'completed_with_warnings' ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
  };

  const verifyWinget = async () => {
    if (!runtime.available || busy) return;
    setBusy('verify');
    setMessage('');
    const result = await setupClient.verifyWinget();
    setBusy(null);
    setWingetStatus(result.data ?? '');
    setMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
  };

  const install = async () => {
    if (!runtime.available || busy || !selectedPackage) return;
    setBusy('install');
    setMessage('');
    addLog('m01_s05', t('Application installation', 'تثبيت البرنامج'), 'in_progress', selectedPackage);
    const result = await setupClient.install(selectedPackage);
    setBusy(null);
    setMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
    addLog('m01_s05', t('Application installation', 'تثبيت البرنامج'), result.status === 'completed' ? 'completed' : 'failed', language === 'ar' ? result.summaryAr : result.summaryEn);
    await loadQueue();
  };

  const resume = async () => {
    if (!runtime.available || busy) return;
    setBusy('resume');
    setMessage('');
    const result = await setupClient.resumeQueue();
    setBusy(null);
    if (result.data) setQueue(result.data);
    setMessage(language === 'ar' ? result.summaryAr : result.summaryEn);
  };

  const queueStats = useMemo(() => ({
    completed: queue.filter(item => item.status === 'completed').length,
    pending: queue.filter(item => ['queued', 'running', 'failed', 'interrupted'].includes(item.status)).length,
  }), [queue]);

  if (!module) return null;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4 rtl:flex-row-reverse">
            <div className="knoux-icon-plate h-16 w-16 rounded-2xl"><Monitor className="h-8 w-8" /></div>
            <div>
              <div className="knoux-eyebrow">{t('Verified Windows preparation', 'تجهيز ويندوز بأدلة موثقة')}</div>
              <h1 className="mt-2 text-3xl font-black text-[var(--knoux-text)] md:text-5xl">{t(module.nameEn, module.nameAr)}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--knoux-text-secondary)]">{t(module.descriptionEn, module.descriptionAr)}</p>
            </div>
          </div>
          <div className={`rounded-2xl border p-4 ${runtime.available ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6" /><div><p className="font-black text-[var(--knoux-text)]">{runtime.available ? t('Windows engine connected', 'محرك ويندوز متصل') : t('Desktop application required', 'يلزم تطبيق سطح المكتب')}</p><p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{runtime.available ? t('No hardware or installation results are simulated.', 'لا يتم إنشاء نتائج مكونات أو تثبيت تجريبية.') : t(runtime.reasonEn ?? '', runtime.reasonAr ?? '')}</p></div></div>
          </div>
        </div>
      </section>

      {message && <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4 text-sm font-semibold text-[var(--knoux-text)]">{message}</section>}

      <section className="grid gap-4 md:grid-cols-3">
        <Metric icon={Cpu} label={t('CPU', 'المعالج')} value={hardware?.cpuModel ?? '—'} />
        <Metric icon={HardDrive} label={t('Physical disks', 'الأقراص الفعلية')} value={hardware ? hardware.disks.length.toString() : '—'} />
        <Metric icon={PackageCheck} label={t('Completed installs', 'التثبيتات المكتملة')} value={queueStats.completed.toString()} />
      </section>

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><div className="knoux-eyebrow"><Cpu className="h-4 w-4" />{t('Device evidence', 'أدلة الجهاز')}</div><h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{t('Read hardware and security information', 'قراءة معلومات المكونات والأمان')}</h2></div>
          <button type="button" onClick={discover} disabled={!runtime.available || Boolean(busy)} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">{busy === 'hardware' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{t('Inspect this device', 'فحص هذا الجهاز')}</button>
        </div>
        {hardware && <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Evidence label={t('Computer', 'الجهاز')} value={`${hardware.manufacturer} ${hardware.computerModel}`} />
          <Evidence label={t('Windows', 'ويندوز')} value={`${hardware.osProductName} ${hardware.osVersion}`} />
          <Evidence label={t('Memory', 'الذاكرة')} value={hardware.totalRamGb == null ? '—' : `${hardware.totalRamGb} GB`} />
          <Evidence label={t('Secure Boot / TPM', 'Secure Boot / TPM')} value={`${hardware.secureBootEnabled === true ? 'On' : hardware.secureBootEnabled === false ? 'Off' : 'N/A'} / ${hardware.tpmReady === true ? 'Ready' : hardware.tpmAvailable === true ? 'Present' : 'N/A'}`} />
          <Evidence label={t('Graphics', 'بطاقات العرض')} value={hardware.gpus.map(item => item.name).join(', ') || '—'} />
          <Evidence label={t('Storage', 'التخزين')} value={hardware.disks.map(item => item.model).join(', ') || '—'} />
          <Evidence label={t('BIOS', 'BIOS')} value={hardware.bios.map(item => item.model).join(', ') || '—'} />
          <Evidence label={t('Measured at', 'وقت القياس')} value={new Date(hardware.measuredAt).toLocaleString()} />
        </div>}
      </section>

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <label className="block"><span className="text-xs font-black text-[var(--knoux-text)]">{t('Approved application', 'البرنامج المعتمد')}</span><select value={selectedPackage} onChange={event => setSelectedPackage(event.target.value as typeof selectedPackage)} disabled={Boolean(busy)} className="mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]">{PACKAGES.map(([id, name]) => <option key={id} value={id}>{name} — {id}</option>)}</select></label>
          <button type="button" onClick={verifyWinget} disabled={!runtime.available || Boolean(busy)} className="knoux-card-action disabled:opacity-50">{busy === 'verify' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{t('Verify Winget', 'التحقق من Winget')}</button>
          <button type="button" onClick={install} disabled={!runtime.available || Boolean(busy)} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">{busy === 'install' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t('Install selected', 'تثبيت المحدد')}</button>
        </div>
        {wingetStatus && <p className="mt-3 break-all font-mono text-xs text-[var(--knoux-text-muted)]">{wingetStatus}</p>}
      </section>

      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><div className="knoux-eyebrow">{t('Persistent installation queue', 'طابور التثبيت المحفوظ')}</div><h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{t('Resume failed or interrupted installations', 'استكمال التثبيتات الفاشلة أو المتوقفة')}</h2><p className="mt-2 text-sm text-[var(--knoux-text-muted)]">{t(`${queueStats.pending} items need attention.`, `${queueStats.pending} عنصر يحتاج إلى متابعة.`)}</p></div><button type="button" onClick={resume} disabled={!runtime.available || Boolean(busy) || queueStats.pending === 0} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">{busy === 'resume' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{t('Resume queue', 'استكمال الطابور')}</button></div>
        <div className="mt-5 space-y-3">{queue.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-6 text-center text-sm text-[var(--knoux-text-muted)]">{t('No installation attempts have been recorded yet.', 'لم يتم تسجيل أي محاولة تثبيت حتى الآن.')}</div> : queue.map(item => <article key={item.queueId} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><p className="font-black text-[var(--knoux-text)]">{item.packageId}</p><p className="mt-1 text-xs text-[var(--knoux-text-muted)]">{t('Attempts', 'المحاولات')}: {item.attempts} · {new Date(item.queuedAt).toLocaleString()}</p>{item.lastError && <p className="mt-2 text-xs text-rose-300">{item.lastError}</p>}</div><span className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(item.status)}`}>{item.status}</span></div></article>)}</div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{module.services.filter(service => service.implementationState === 'planned').map(service => <article key={service.id} className="rounded-2xl border border-dashed border-[var(--knoux-border)] p-4 opacity-70"><p className="text-sm font-black text-[var(--knoux-text)]">{t(service.nameEn, service.nameAr)}</p><p className="mt-2 text-xs leading-6 text-[var(--knoux-text-muted)]">{t(service.availabilityReasonEn ?? '', service.availabilityReasonAr ?? '')}</p></article>)}</section>
    </div>
  );
};

const Metric = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) => <div className="knoux-glass-panel p-4"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-[var(--knoux-primary-bright)]" /><span className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</span></div><p className="mt-3 line-clamp-2 text-lg font-black text-[var(--knoux-text)]">{value}</p></div>;
const Evidence = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4"><p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p><p className="mt-2 break-words text-sm font-black text-[var(--knoux-text)]">{value || '—'}</p></div>;
