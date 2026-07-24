/** KNOUX ONE — Module 03 Duplicate Control Center */
import React from 'react';
import { AlertTriangle, Copy, FolderSearch, History, Layers, Play, ShieldAlert, Sliders } from 'lucide-react';
import { useDuplicateStore } from './duplicateStore';
import { DuplicateScanSetup } from './DuplicateScanSetup';
import { DuplicateScanProgress } from './DuplicateScanProgress';
import { DuplicateResultsWorkspace } from './DuplicateResultsWorkspace';
import { DuplicateMediaCompare } from './DuplicateMediaCompare';
import { DuplicateKeeperRules } from './DuplicateKeeperRules';
import { DuplicateQuarantineView } from './DuplicateQuarantineView';
import { DuplicateHistoryView } from './DuplicateHistoryView';
import { useTranslation } from '../../i18n';
import { formatBytes } from './duplicateFormatters';

export function DuplicateControlCenter() {
  const { t } = useTranslation(); const store = useDuplicateStore();
  const totalWastedBytes = store.duplicateGroups.reduce((total:number,group:any)=>total+group.wastedSizeBytes,0);
  const totalDuplicateFiles = store.duplicateGroups.reduce((total:number,group:any)=>total+Math.max(0,group.files.length-1),0);
  const tabs = [['setup',FolderSearch,'New Scan','فحص جديد'],['results',Layers,'Results','النتائج'],['compare',Copy,'Visual Review','المراجعة البصرية'],['keeper',Sliders,'Keeper Rules','قواعد الاحتفاظ'],['quarantine',ShieldAlert,'Quarantine','المحجر'],['history',History,'History','السجل']] as const;
  return <div className="knoux-page-container space-y-6">
    <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8"><div className="absolute inset-y-0 end-0 w-[42%] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.16),transparent_70%)]"/><div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><div className="knoux-eyebrow text-blue-400"><Copy className="h-4 w-4"/>{t('Duplicate Control Center','مركز اكتشاف وإدارة الملفات المكررة')}</div><h1 className="mt-3 text-[clamp(1.8rem,3vw,2.7rem)] font-black text-[var(--knoux-text)]">{t('Verify first. Keep one. Quarantine safely.','تحقق أولًا، احتفظ بنسخة، وانقل الباقي إلى المحجر بأمان')}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--knoux-subtext)]">{t('Real BLAKE3 verification, hard-link awareness, image similarity review, keeper planning, persistent history, and checksum-verified quarantine.','تحقق حقيقي عبر BLAKE3، واكتشاف الروابط الصلبة، ومراجعة تشابه الصور، وقواعد اختيار النسخة الأصلية، وسجل دائم، ومحجر يتحقق من البصمة الرقمية.')}</p></div><button type="button" onClick={store.startScan} disabled={store.isScanning||!store.runtime.available} className="knoux-btn-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 disabled:cursor-not-allowed disabled:opacity-50"><Play className={`h-4 w-4 ${store.isScanning?'animate-spin':''}`}/>{store.isScanning?t('Scanning…','جاري الفحص…'):t('Run verified scan','تشغيل فحص موثق')}</button></div>
    <div className="relative mt-6 grid grid-cols-2 gap-4 border-t border-[var(--knoux-glass-border)] pt-5 sm:grid-cols-4"><Metric label={t('Verified groups','المجموعات الموثقة')} value={store.duplicateGroups.length}/><Metric label={t('Redundant files','الملفات الزائدة')} value={totalDuplicateFiles} tone="amber"/><Metric label={t('Reclaimable space','المساحة القابلة للاسترداد')} value={formatBytes(totalWastedBytes)} tone="emerald"/><Metric label={t('Quarantine records','سجلات المحجر')} value={store.quarantineRecords.length} tone="purple"/></div></section>
    {!store.runtime.available&&<section className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0"/><div><p className="font-black">{t('Desktop runtime unavailable','بيئة سطح المكتب غير متاحة')}</p><p className="mt-1 text-xs leading-6 text-amber-100/80">{t(store.runtime.messageEn,store.runtime.messageAr)}</p></div></div></section>}
    {store.error&&<section className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-100"><p className="font-black">{store.error.code}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-rose-100/80">{store.error.message}</p></section>}
    <DuplicateScanProgress store={store}/>
    <nav className="flex gap-2 overflow-x-auto border-b border-[var(--knoux-border)] pb-1">{tabs.map(([id,Icon,en,ar])=><button key={id} type="button" onClick={()=>store.setActiveTab(id)} className={`flex min-h-10 items-center gap-2 whitespace-nowrap rounded-t-xl border-b-2 px-4 text-sm font-bold transition ${store.activeTab===id?'border-blue-500 bg-blue-500/10 text-blue-300':'border-transparent text-[var(--knoux-subtext)] hover:text-[var(--knoux-text)]'}`}><Icon className="h-4 w-4"/>{t(en,ar)}</button>)}</nav>
    <div>{store.activeTab==='setup'&&<DuplicateScanSetup store={store}/>} {store.activeTab==='results'&&<DuplicateResultsWorkspace store={store}/>} {store.activeTab==='compare'&&<DuplicateMediaCompare store={store}/>} {store.activeTab==='keeper'&&<DuplicateKeeperRules store={store}/>} {store.activeTab==='quarantine'&&<DuplicateQuarantineView store={store}/>} {store.activeTab==='history'&&<DuplicateHistoryView store={store}/>}</div>
  </div>;
}
function Metric({label,value,tone='default'}:{label:string;value:React.ReactNode;tone?:string}){const tones:Record<string,string>={default:'text-[var(--knoux-text)]',amber:'text-amber-400',emerald:'text-emerald-400',purple:'text-purple-400'};return <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] p-4"><span className="text-xs font-semibold text-[var(--knoux-subtext)]">{label}</span><p className={`mt-1 text-xl font-black ${tones[tone]}`}>{value}</p></div>}
