import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  FileCheck2,
  HardDriveDownload,
  History,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import type { OperationResult } from '../../types';
import { repairClient } from './repairClient';
import type { RepairReport, UpdateBackup } from './repairContracts';

type IconType = React.ComponentType<{ size?: number; className?: string }>;

function succeeded(result: OperationResult): boolean {
  return result.status === 'completed' || result.status === 'completed_with_warnings';
}

function formatBytes(value = 0): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

interface RepairCardProps {
  icon: IconType;
  title: string;
  technical: string;
  description: string;
  requiresAdmin?: boolean;
  children: React.ReactNode;
}

const RepairCard: React.FC<RepairCardProps> = ({ icon: Icon, title, technical, description, requiresAdmin, children }) => (
  <section className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)]/90 p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="rounded-xl bg-rose-500/10 p-2.5 text-rose-500"><Icon size={21} /></span>
        <div className="min-w-0">
          <h3 className="font-bold text-[var(--knoux-text)]">{title}</h3>
          <p className="mt-0.5 text-xs font-medium text-[var(--knoux-muted)]">{technical}</p>
        </div>
      </div>
      {requiresAdmin && <span className="shrink-0 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-600">ADMIN</span>}
    </div>
    <p className="mt-3 min-h-10 text-sm leading-6 text-[var(--knoux-muted)]">{description}</p>
    <div className="mt-4 flex flex-wrap gap-2">{children}</div>
  </section>
);

interface ActionButtonProps {
  label: string;
  busy: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ label, busy, disabled, danger, onClick }) => (
  <button
    type="button"
    disabled={busy || disabled}
    onClick={onClick}
    className={`min-h-10 rounded-xl px-3.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
      danger
        ? 'border border-rose-500/30 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15'
        : 'border border-[var(--knoux-border)] bg-[var(--knoux-bg)] text-[var(--knoux-text)] hover:border-rose-500/40'
    }`}
  >
    {busy ? '…' : label}
  </button>
);

export const WindowsRepairWorkspace: React.FC = () => {
  const { language } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm07');
  const runtime = repairClient.runtimeState();
  const [busyKey, setBusyKey] = useState('');
  const [result, setResult] = useState<OperationResult<RepairReport> | null>(null);
  const [error, setError] = useState('');
  const [backups, setBackups] = useState<UpdateBackup[]>([]);

  const tr = (ar: string, en: string) => (language === 'ar' ? ar : en);
  const implementedCount = useMemo(
    () => module?.services.filter(service => service.implementationState === 'implemented').length ?? 0,
    [module],
  );

  const run = async (key: string, operation: Promise<OperationResult<RepairReport>>) => {
    if (busyKey) return;
    setBusyKey(key);
    setError('');
    const response = await operation;
    setResult(response);
    if (response.data?.updateBackups) setBackups(response.data.updateBackups);
    if (!succeeded(response)) setError(language === 'ar' ? response.summaryAr : response.summaryEn);
    setBusyKey('');
  };

  const confirmed = (
    key: string,
    expected: string,
    promptAr: string,
    promptEn: string,
    operation: (confirmation: string) => Promise<OperationResult<RepairReport>>,
  ) => {
    const value = window.prompt(tr(`${promptAr}\n\n${expected}`, `${promptEn}\n\n${expected}`)) ?? '';
    if (!value) return;
    void run(key, operation(value));
  };

  const latestBackup = [...backups].reverse().find(item => !item.restoredAt);

  if (!module) return null;

  return (
    <div className="space-y-4 p-1" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="overflow-hidden rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-500/10 via-[var(--knoux-surface)] to-amber-500/5 p-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-rose-600">
              <Wrench size={18} />
              <span>{tr('القسم 07 — إصلاح مشاكل Windows', 'Module 07 — Windows Repair')}</span>
            </div>
            <h1 className="text-2xl font-black text-[var(--knoux-text)]">{tr('مركز إصلاح ويندوز الآمن', 'Safe Windows Repair Center')}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--knoux-muted)]">
              {tr(
                'ابدأ بالفحص، راجع النتيجة الأصلية من ويندوز، ثم نفّذ الإصلاح المطلوب فقط. لا توجد وصفات DLL عشوائية أو نتائج تجريبية.',
                'Inspect first, review the original Windows evidence, then run only the required repair. No random DLL recipes or simulated results.',
              )}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg)]/80 px-4 py-3">
              <div className="text-2xl font-black text-rose-600">{implementedCount}/10</div>
              <div className="text-xs text-[var(--knoux-muted)]">{tr('خدمات حقيقية', 'Real services')}</div>
            </div>
            <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg)]/80 px-4 py-3">
              <div className="flex items-center justify-center gap-1 text-sm font-black text-[var(--knoux-text)]"><ShieldCheck size={17} /> Native</div>
              <div className="mt-1 text-xs text-[var(--knoux-muted)]">{tr('أدلة محلية', 'Local evidence')}</div>
            </div>
          </div>
        </div>
      </header>

      {!runtime.available && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700">
          <ShieldAlert className="mt-0.5 shrink-0" size={20} />
          <p>{tr(runtime.reasonAr ?? '', runtime.reasonEn ?? '')}</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700">{error}</div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RepairCard
          icon={FileCheck2}
          title={tr('فحص ملفات ويندوز', 'Check Windows files')}
          technical="SFC"
          description={tr('فحص سلامة ملفات النظام، مع خيار إصلاح رسمي عبر SFC.', 'Verify system-file integrity and optionally run the official SFC repair.')}
          requiresAdmin
        >
          <ActionButton label={tr('فحص فقط', 'Verify only')} busy={busyKey === 'sfc-verify'} disabled={!runtime.available} onClick={() => void run('sfc-verify', repairClient.sfc({ action: 'verify' }))} />
          <ActionButton danger label={tr('فحص وإصلاح', 'Scan and repair')} busy={busyKey === 'sfc-repair'} disabled={!runtime.available} onClick={() => confirmed('sfc-repair', 'RUN SFC REPAIR', 'اكتب العبارة لتشغيل الإصلاح', 'Type the phrase to run the repair', confirmation => repairClient.sfc({ action: 'repair', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={ShieldCheck}
          title={tr('فحص سريع لصورة ويندوز', 'Quick Windows image check')}
          technical="DISM CheckHealth"
          description={tr('فحص سريع لمعرفة هل مخزن مكونات ويندوز مسجل كتالف.', 'Quickly checks whether the Windows component store is marked as corrupted.')}
          requiresAdmin
        >
          <ActionButton label={tr('ابدأ الفحص السريع', 'Run CheckHealth')} busy={busyKey === 'dism-check'} disabled={!runtime.available} onClick={() => void run('dism-check', repairClient.dismCheckHealth())} />
        </RepairCard>

        <RepairCard
          icon={HardDriveDownload}
          title={tr('فحص شامل لصورة ويندوز', 'Deep Windows image scan')}
          technical="DISM ScanHealth"
          description={tr('فحص شامل لمخزن المكونات دون تنفيذ إصلاح.', 'Performs a comprehensive component-store scan without changing the system.')}
          requiresAdmin
        >
          <ActionButton label={tr('ابدأ الفحص الشامل', 'Run ScanHealth')} busy={busyKey === 'dism-scan'} disabled={!runtime.available} onClick={() => void run('dism-scan', repairClient.dismScanHealth())} />
        </RepairCard>

        <RepairCard
          icon={Wrench}
          title={tr('إصلاح صورة ويندوز', 'Repair Windows image')}
          technical="DISM RestoreHealth"
          description={tr('إصلاح مخزن المكونات من مصدر ويندوز الرسمي دون فرض مصدر صورة مجهول.', 'Repairs the component store using the official Windows source without injecting an unknown image.')}
          requiresAdmin
        >
          <ActionButton danger label={tr('تشغيل الإصلاح', 'Run RestoreHealth')} busy={busyKey === 'dism-repair'} disabled={!runtime.available} onClick={() => confirmed('dism-repair', 'RUN DISM RESTOREHEALTH', 'اكتب العبارة لتأكيد إصلاح DISM', 'Type the phrase to confirm DISM repair', confirmation => repairClient.dismRestoreHealth({ action: 'repair', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={RefreshCw}
          title={tr('إصلاح تحديثات ويندوز', 'Repair Windows Update')}
          technical="Windows Update Components"
          description={tr('فحص الخدمات وإعادة إنشاء مجلدات التحديث مع الاحتفاظ بنسخ قابلة للاستعادة.', 'Inspects services and rebuilds update folders while preserving restorable backups.')}
          requiresAdmin
        >
          <ActionButton label={tr('فحص المكونات', 'Inspect components')} busy={busyKey === 'update-inspect'} disabled={!runtime.available} onClick={() => void run('update-inspect', repairClient.windowsUpdate({ action: 'inspect' }))} />
          <ActionButton danger label={tr('إعادة ضبط آمنة', 'Safe reset')} busy={busyKey === 'update-reset'} disabled={!runtime.available} onClick={() => confirmed('update-reset', 'RESET WINDOWS UPDATE', 'اكتب العبارة لإنشاء نسخ احتياطية وإعادة الضبط', 'Type the phrase to create backups and reset', confirmation => repairClient.windowsUpdate({ action: 'reset', confirmation }))} />
          <ActionButton label={tr('استعادة آخر نسخة', 'Restore latest backup')} busy={busyKey === 'update-restore'} disabled={!runtime.available || !latestBackup} onClick={() => confirmed('update-restore', 'RESTORE WINDOWS UPDATE', 'اكتب العبارة لاستعادة آخر نسخة', 'Type the phrase to restore the latest backup', confirmation => repairClient.windowsUpdate({ action: 'restore', confirmation, targetId: latestBackup?.id }))} />
        </RepairCard>

        <RepairCard
          icon={RotateCcw}
          title={tr('إصلاح الأيقونات والصور المصغرة', 'Repair icons and thumbnails')}
          technical="IconCache / ThumbCache"
          description={tr('فحص ملفات الكاش المسموح بها وإعادة بنائها دون لمس الصور أو الملفات الشخصية.', 'Inspects and rebuilds allowlisted cache files without touching personal images or documents.')}
        >
          <ActionButton label={tr('عرض ملفات الكاش', 'Inspect cache files')} busy={busyKey === 'cache-inspect'} disabled={!runtime.available} onClick={() => void run('cache-inspect', repairClient.caches({ action: 'inspect' }))} />
          <ActionButton danger label={tr('إعادة بناء الكاش', 'Rebuild caches')} busy={busyKey === 'cache-rebuild'} disabled={!runtime.available} onClick={() => confirmed('cache-rebuild', 'REBUILD ICON CACHE', 'اكتب العبارة لإعادة تشغيل Explorer وبناء الكاش', 'Type the phrase to restart Explorer and rebuild caches', confirmation => repairClient.caches({ action: 'rebuild', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={Database}
          title={tr('فحص قاعدة إدارة ويندوز', 'Check Windows management database')}
          technical="WMI Repository"
          description={tr('التحقق من WMI أو تنفيذ Salvage الآمن فقط؛ إعادة الضبط العنيفة غير متاحة.', 'Verifies WMI or runs safe repository salvage only; destructive reset is not exposed.')}
          requiresAdmin
        >
          <ActionButton label={tr('تحقق من WMI', 'Verify WMI')} busy={busyKey === 'wmi-verify'} disabled={!runtime.available} onClick={() => void run('wmi-verify', repairClient.wmi({ action: 'verify' }))} />
          <ActionButton danger label={tr('إصلاح WMI', 'Salvage WMI')} busy={busyKey === 'wmi-salvage'} disabled={!runtime.available} onClick={() => confirmed('wmi-salvage', 'SALVAGE WMI', 'اكتب العبارة لتشغيل الإصلاح الآمن', 'Type the phrase to run safe salvage', confirmation => repairClient.wmi({ action: 'salvage', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={PackageCheck}
          title={tr('إصلاح تثبيت البرامج', 'Repair program installation')}
          technical="Windows Installer / MSI"
          description={tr('فحص خدمة MSI وإعادة تسجيل ملفات msiexec الرسمية فقط.', 'Inspects the MSI service and re-registers only the official msiexec binaries.')}
          requiresAdmin
        >
          <ActionButton label={tr('فحص خدمة التثبيت', 'Inspect Installer')} busy={busyKey === 'msi-inspect'} disabled={!runtime.available} onClick={() => void run('msi-inspect', repairClient.installer({ action: 'inspect' }))} />
          <ActionButton danger label={tr('إصلاح خدمة التثبيت', 'Repair Installer')} busy={busyKey === 'msi-repair'} disabled={!runtime.available} onClick={() => confirmed('msi-repair', 'REPAIR WINDOWS INSTALLER', 'اكتب العبارة لإعادة تسجيل Windows Installer', 'Type the phrase to re-register Windows Installer', confirmation => repairClient.installer({ action: 'repair', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={History}
          title={tr('إصلاح النسخ الاحتياطي للنظام', 'Repair system backup service')}
          technical="VSS Writers"
          description={tr('فحص خدمات وكتّاب VSS وإصلاح إعدادات الخدمات دون وصفات DLL قديمة.', 'Inspects VSS services and writers and repairs service configuration without outdated DLL recipes.')}
          requiresAdmin
        >
          <ActionButton label={tr('فحص VSS', 'Inspect VSS')} busy={busyKey === 'vss-inspect'} disabled={!runtime.available} onClick={() => void run('vss-inspect', repairClient.vss({ action: 'inspect' }))} />
          <ActionButton danger label={tr('إصلاح VSS', 'Repair VSS')} busy={busyKey === 'vss-repair'} disabled={!runtime.available} onClick={() => confirmed('vss-repair', 'REPAIR VSS', 'اكتب العبارة لإصلاح الخدمات وإعادة فحص الكتّاب', 'Type the phrase to repair services and recheck writers', confirmation => repairClient.vss({ action: 'repair', confirmation }))} />
        </RepairCard>

        <RepairCard
          icon={ShoppingBag}
          title={tr('إصلاح متجر مايكروسوفت', 'Repair Microsoft Store')}
          technical="Microsoft Store / Appx"
          description={tr('فحص الحزمة والخدمات، تشغيل wsreset الرسمي، أو إعادة تسجيل حزمة المستخدم الحالية.', 'Inspects the package and services, runs official wsreset, or re-registers the current user package.')}
        >
          <ActionButton label={tr('فحص المتجر', 'Inspect Store')} busy={busyKey === 'store-inspect'} disabled={!runtime.available} onClick={() => void run('store-inspect', repairClient.store({ action: 'inspect' }))} />
          <ActionButton label={tr('مسح كاش المتجر', 'Reset Store cache')} busy={busyKey === 'store-reset'} disabled={!runtime.available} onClick={() => confirmed('store-reset', 'RESET MICROSOFT STORE', 'اكتب العبارة لتشغيل wsreset', 'Type the phrase to run wsreset', confirmation => repairClient.store({ action: 'reset', confirmation }))} />
          <ActionButton danger label={tr('إعادة تسجيل المتجر', 'Re-register Store')} busy={busyKey === 'store-repair'} disabled={!runtime.available} onClick={() => confirmed('store-repair', 'REPAIR MICROSOFT STORE', 'اكتب العبارة لإعادة تسجيل الحزمة الحالية', 'Type the phrase to re-register the current package', confirmation => repairClient.store({ action: 'repair', confirmation }))} />
        </RepairCard>
      </div>

      <section className="rounded-3xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" size={21} />
            <h2 className="font-black text-[var(--knoux-text)]">{tr('نتيجة العملية والأدلة', 'Operation result and evidence')}</h2>
          </div>
          {result?.data?.evidencePath && <span className="max-w-[45%] truncate text-xs text-[var(--knoux-muted)]" title={result.data.evidencePath}>{result.data.evidencePath}</span>}
        </div>

        {!result ? (
          <p className="mt-4 text-sm text-[var(--knoux-muted)]">{tr('اختر فحصًا أو إصلاحًا لعرض نتيجة ويندوز الأصلية هنا.', 'Choose an inspection or repair to show the original Windows result here.')}</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className={`rounded-2xl border p-4 ${succeeded(result) ? 'border-emerald-500/25 bg-emerald-500/8' : 'border-rose-500/25 bg-rose-500/8'}`}>
              <div className="font-bold text-[var(--knoux-text)]">{language === 'ar' ? result.summaryAr : result.summaryEn}</div>
              <div className="mt-1 text-xs text-[var(--knoux-muted)]">{result.data?.service} · {result.data?.action} · {result.status}</div>
            </div>

            {result.data?.commands.map((command, index) => (
              <details key={`${command.program}-${index}`} className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-bg)] p-3" open={index === result.data!.commands.length - 1}>
                <summary className="cursor-pointer text-sm font-bold text-[var(--knoux-text)]">
                  {command.success ? '✓' : '✕'} {command.program} {command.arguments.join(' ')}
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/90 p-3 text-xs leading-5 text-white">{command.stdout || tr('لا يوجد خرج قياسي.', 'No standard output.')}</pre>
                  <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-black/90 p-3 text-xs leading-5 text-rose-200">{command.stderr || tr('لا توجد أخطاء.', 'No errors.')}</pre>
                </div>
              </details>
            ))}

            {!!result.data?.artifacts.length && (
              <div className="overflow-x-auto rounded-2xl border border-[var(--knoux-border)]">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-[var(--knoux-bg)] text-[var(--knoux-muted)]">
                    <tr><th className="p-3 text-start">{tr('المسار', 'Path')}</th><th className="p-3 text-start">{tr('الحجم', 'Size')}</th><th className="p-3 text-start">{tr('الحالة', 'Status')}</th></tr>
                  </thead>
                  <tbody>
                    {result.data.artifacts.map(item => <tr key={item.path} className="border-t border-[var(--knoux-border)]"><td className="break-all p-3">{item.path}</td><td className="p-3">{formatBytes(item.sizeBytes)}</td><td className="p-3">{item.status}</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}

            {!!result.warnings?.length && (
              <ul className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-700">
                {result.warnings.map(warning => <li key={warning}>• {warning}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
