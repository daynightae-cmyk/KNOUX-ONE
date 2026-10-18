import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  AppWindow,
  FileClock,
  FileWarning,
  HardDrive,
  HeartPulse,
  Network,
  PackageCheck,
  Play,
  RefreshCw,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { MODULES_CATALOG } from '../../data/capabilitiesCatalog';
import { formatBytes } from '../duplicates/duplicateFormatters';
import { useDiagnosticStore } from './diagnosticStore';
import type {
  DiagnosticExportFormat,
} from './diagnosticContracts';

function formatTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

const MetricChip: React.FC<{ label: string; value: string; tone?: 'default' | 'warn' | 'danger' | 'ok' }> = ({ label, value, tone = 'default' }) => {
  const toneClass =
    tone === 'danger'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-200'
      : tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : tone === 'ok'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-200';
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${toneClass}`}>
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
};

const EvidenceTable: React.FC<{ columns: string[]; rows: string[][]; empty: string }> = ({ columns, rows, empty }) => {
  if (!rows.length) return <p className="text-sm text-slate-400">{empty}</p>;
  const visible = rows.slice(0, 8);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-300">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            {columns.map(column => (
              <th key={column} className="px-2 py-2 font-medium whitespace-nowrap">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((row, index) => (
            <tr key={index} className="border-b border-white/5 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="max-w-[280px] truncate px-2 py-2" title={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > visible.length && (
        <p className="mt-2 text-xs text-slate-500">+{rows.length - visible.length}</p>
      )}
    </div>
  );
};

const SectionCard: React.FC<{
  icon: React.ReactNode;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  busy: boolean;
  disabled: boolean;
  hasData: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}> = ({ icon, titleEn, titleAr, descriptionEn, descriptionAr, busy, disabled, hasData, onRun, children }) => {
  const { t, language } = useKnoux();
  return (
    <section className="knoux-glass-panel space-y-4 p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-cyan-300">{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-white">{t(titleEn, titleAr)}</h3>
            <p className="mt-1 max-w-[52ch] text-xs text-slate-400">{language === 'ar' ? descriptionAr : descriptionEn}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {busy
            ? t('Reading…', 'جارٍ القراءة…')
            : hasData
              ? t('Refresh', 'تحديث')
              : t('Run', 'تشغيل')}
        </button>
      </header>
      {children}
    </section>
  );
};

export const DiagnosticsWorkspace: React.FC = () => {
  const { t, language, addLog } = useKnoux();
  const module = MODULES_CATALOG.find(item => item.id === 'm17');
  const store = useDiagnosticStore();
  const [hours, setHours] = useState(72);
  const [probeTarget, setProbeTarget] = useState('8.8.8.8');
  const [exportTitle, setExportTitle] = useState('');
  const [exportFormat, setExportFormat] = useState<DiagnosticExportFormat>('json');
  const [redact, setRedact] = useState(true);
  const [includeSystemSummary, setIncludeSystemSummary] = useState(true);

  const unavailable = !store.runtime.available;
  const busy = (action: string) => store.loadingAction === action;

  const runSection = async (
    serviceId: string,
    nameEn: string,
    nameAr: string,
    task: () => Promise<unknown>,
  ) => {
    addLog(serviceId, t(nameEn, nameAr), 'in_progress', t('Reading local evidence…', 'جارٍ قراءة الأدلة المحلية…'));
    const data = await task();
    addLog(
      serviceId,
      t(nameEn, nameAr),
      data ? 'completed' : 'failed',
      data
        ? t('Evidence collected from local system surfaces.', 'جُمعت الأدلة من مصادر النظام المحلية.')
        : t('No evidence returned; see the error banner.', 'لم تُرجَع أدلة؛ راجع شريط الخطأ.'),
    );
  };

  if (!module) return null;

  const hasEvidence = store.collectedSections.length > 0;

  return (
    <div className="knoux-page-container space-y-6">
      <section className="knoux-glass-panel relative overflow-hidden p-6 md:p-8">
        <div className="absolute inset-y-0 end-0 w-[40%] bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_70%)]" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <FileClock className="h-6 w-6 text-cyan-300" />
              <h1 className="text-xl font-bold text-white">{t(module.nameEn, module.nameAr)}</h1>
            </div>
            <p className="max-w-[80ch] text-sm text-slate-300">
              {language === 'ar' ? module.descriptionAr : module.descriptionEn}
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            {t('Window', 'النطاق الزمني')}
            <select
              value={hours}
              onChange={event => setHours(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-white"
            >
              <option value={24}>{t('24 hours', '24 ساعة')}</option>
              <option value={72}>{t('3 days', '3 أيام')}</option>
              <option value={168}>{t('7 days', '7 أيام')}</option>
            </select>
          </label>
        </div>
      </section>

      {unavailable && (
        <div className="knoux-glass-panel flex items-center gap-3 border border-amber-500/30 p-4 text-sm text-amber-200">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            {t(
              'Diagnostics read the local Windows machine only. Open KNOUX ONE Desktop to collect evidence.',
              'يعمل التشخيص على جهاز ويندوز المحلي فقط. افتح تطبيق KNOUX ONE لسطح المكتب لجمع الأدلة.',
            )}
          </p>
        </div>
      )}

      {store.error && (
        <div className="knoux-glass-panel flex items-start gap-3 border border-rose-500/30 p-4 text-sm text-rose-200">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">{store.error.code}</p>
            <p className="mt-1 whitespace-pre-wrap text-xs opacity-90">{store.error.message}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          icon={<FileClock className="h-5 w-5" />}
          titleEn="Event log summary"
          titleAr="ملخص سجل الأحداث"
          descriptionEn="Reads System, Application, Setup and other requested channels through the structured event API and counts critical, error and warning rows from the rows themselves."
          descriptionAr="يقرأ قنوات النظام والتطبيقات والإعداد وغيرها عبر واجهة الأحداث المهيكلة، ويعدّ الصفوف الحرجة والأخطاء والتحذيرات من الصفوف نفسها."
          busy={busy('events')}
          disabled={unavailable}
          hasData={Boolean(store.events)}
          onRun={() =>
            void runSection('m17_s01', 'Event log summary', 'ملخص سجل الأحداث', () => store.queryEvents(hours, 250))
          }
        >
          {store.events && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Critical', 'حرج')} value={String(store.events.criticalCount)} tone={store.events.criticalCount ? 'danger' : 'ok'} />
                <MetricChip label={t('Errors', 'أخطاء')} value={String(store.events.errorCount)} tone={store.events.errorCount ? 'warn' : 'ok'} />
                <MetricChip label={t('Warnings', 'تحذيرات')} value={String(store.events.warningCount)} tone={store.events.warningCount ? 'warn' : 'ok'} />
                <MetricChip label={t('Channels', 'القنوات')} value={String(store.events.queriedChannels.length)} />
              </div>
              <EvidenceTable
                columns={[t('Time', 'الوقت'), t('Level', 'المستوى'), t('Provider', 'المزوّد'), 'ID', t('Message', 'الرسالة')]}
                rows={store.events.events.map(event => [
                  formatTime(event.timeCreated),
                  event.level,
                  event.provider,
                  String(event.eventId),
                  event.message,
                ])}
                empty={t('No events matched the requested window.', 'لا توجد أحداث مطابقة للنطاق المطلوب.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<AppWindow className="h-5 w-5" />}
          titleEn="Application crash history"
          titleAr="تاريخ انهيار التطبيقات"
          descriptionEn="Correlates application crash events per application with faulting module, exception code and occurrence counts."
          descriptionAr="يربط أحداث انهيار التطبيقات لكل تطبيق مع الوحدة المتسببة ورمز الاستثناء وعدد التكرارات."
          busy={busy('crashes')}
          disabled={unavailable}
          hasData={Boolean(store.crashes)}
          onRun={() =>
            void runSection('m17_s02', 'Application crash history', 'تاريخ انهيار التطبيقات', () => store.correlateCrashes(hours, 250))
          }
        >
          {store.crashes && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Crash events', 'أحداث الانهيار')} value={String(store.crashes.totalEvents)} tone={store.crashes.totalEvents ? 'warn' : 'ok'} />
                <MetricChip label={t('Recurring apps', 'تطبيقات متكررة')} value={String(store.crashes.recurringApplications.length)} />
              </div>
              <EvidenceTable
                columns={[t('Application', 'التطبيق'), t('Module', 'الوحدة'), t('Exception', 'الاستثناء'), t('Count', 'التكرار'), t('Last seen', 'آخر ظهور')]}
                rows={store.crashes.crashes.map(crash => [
                  crash.application,
                  crash.faultingModule ?? '—',
                  crash.exceptionCode ?? '—',
                  String(crash.occurrenceCount),
                  formatTime(crash.timeCreated),
                ])}
                empty={t('No application crashes recorded in the window.', 'لا توجد انهيارات تطبيقات مسجلة في هذا النطاق.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<FileWarning className="h-5 w-5" />}
          titleEn="BSOD & minidump triage"
          titleAr="فحص الشاشة الزرقاء والملفات المصغرة"
          descriptionEn="Reads BugCheck events with code, parameters and dump path, and inventories minidumps with size and readability. Debugger analysis is reported as unavailable rather than simulated."
          descriptionAr="يقرأ أحداث BugCheck مع الرمز والمعاملات ومسار التفريغ، ويحصر الملفات المصغرة بالحجم وقابلية القراءة. التحليل بالمنقّح يُبلَّغ عنه كغير متاح بدل محاكاته."
          busy={busy('bsod')}
          disabled={unavailable}
          hasData={Boolean(store.bsod)}
          onRun={() =>
            void runSection('m17_s03', 'BSOD & minidump triage', 'فحص الشاشة الزرقاء والملفات المصغرة', () => store.triageBsod(hours, true))
          }
        >
          {store.bsod && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('BugChecks', 'أحداث الشاشة الزرقاء')} value={String(store.bsod.bugchecks.length)} tone={store.bsod.bugchecks.length ? 'danger' : 'ok'} />
                <MetricChip label={t('Minidumps', 'ملفات التفريغ المصغرة')} value={String(store.bsod.minidumps.length)} />
                <MetricChip
                  label={t('Debugger', 'المنقّح')}
                  value={store.bsod.debuggerAvailable ? t('available', 'متاح') : t('unavailable', 'غير متاح')}
                  tone={store.bsod.debuggerAvailable ? 'ok' : 'warn'}
                />
              </div>
              <EvidenceTable
                columns={[t('Time', 'الوقت'), t('Code', 'الرمز'), t('Parameters', 'المعاملات'), t('Dump', 'ملف التفريغ')]}
                rows={store.bsod.bugchecks.map(bugcheck => [
                  formatTime(bugcheck.timeCreated),
                  bugcheck.code ?? '—',
                  bugcheck.parameters.join(', ') || '—',
                  bugcheck.dumpPath ?? '—',
                ])}
                empty={t('No BugCheck events recorded.', 'لا توجد أحداث شاشة زرقاء مسجلة.')}
              />
              {store.bsod.minidumps.length > 0 && (
                <EvidenceTable
                  columns={[t('File', 'الملف'), t('Size', 'الحجم'), t('Modified', 'آخر تعديل'), t('Readable', 'قابل للقراءة')]}
                  rows={store.bsod.minidumps.map(dump => [
                    dump.fileName,
                    formatBytes(dump.sizeBytes),
                    formatTime(dump.modifiedAt),
                    dump.readable ? t('yes', 'نعم') : t('no', 'لا'),
                  ])}
                  empty=""
                />
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<HeartPulse className="h-5 w-5" />}
          titleEn="Reliability history"
          titleAr="سجل الموثوقية"
          descriptionEn="Reads Reliability Monitor records and groups incidents by day against real timestamps."
          descriptionAr="يقرأ سجلات مراقب الموثوقية ويجمّع الأعطال يوميًا مقابل أوقات حقيقية."
          busy={busy('reliability')}
          disabled={unavailable}
          hasData={Boolean(store.reliability)}
          onRun={() =>
            void runSection('m17_s04', 'Reliability history', 'سجل الموثوقية', () => store.loadReliability(hours, 250))
          }
        >
          {store.reliability && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Records', 'السجلات')} value={String(store.reliability.records.length)} />
                <MetricChip label={t('Active days', 'أيام بها أحداث')} value={String(store.reliability.dayCounts.length)} />
              </div>
              <EvidenceTable
                columns={[t('Time', 'الوقت'), t('Source', 'المصدر'), t('Product', 'المنتج'), t('Message', 'الرسالة')]}
                rows={store.reliability.records.map(record => [
                  formatTime(record.timeGenerated),
                  record.sourceName,
                  record.productName ?? '—',
                  record.message,
                ])}
                empty={t('No reliability records in the window.', 'لا توجد سجلات موثوقية في هذا النطاق.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<Activity className="h-5 w-5" />}
          titleEn="Failed service diagnostics"
          titleAr="تشخيص الخدمات المتعثرة"
          descriptionEn="Reads service failure events together with the measured service inventory, naming automatic services that are actually not running."
          descriptionAr="يقرأ أحداث فشل الخدمات مع جرد الخدمات المقاس، ويسمّي الخدمات التلقائية المتوقفة فعليًا."
          busy={busy('services')}
          disabled={unavailable}
          hasData={Boolean(store.services)}
          onRun={() =>
            void runSection('m17_s05', 'Failed service diagnostics', 'تشخيص الخدمات المتعثرة', () => store.diagnoseServices(hours))
          }
        >
          {store.services && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Failure events', 'أحداث الفشل')} value={String(store.services.failures.length)} tone={store.services.failures.length ? 'warn' : 'ok'} />
                <MetricChip label={t('Auto not running', 'تلقائية متوقفة')} value={String(store.services.automaticNotRunning.length)} tone={store.services.automaticNotRunning.length ? 'danger' : 'ok'} />
              </div>
              <EvidenceTable
                columns={[t('Service', 'الخدمة'), t('Display name', 'الاسم'), t('State', 'الحالة'), t('Start mode', 'وضع البدء'), t('Last event', 'آخر حدث')]}
                rows={[
                  ...store.services.automaticNotRunning.map(service => [
                    service.serviceName ?? service.displayName ?? '—',
                    service.displayName ?? '—',
                    service.state ?? '—',
                    service.startMode ?? '—',
                    formatTime(service.timeCreated),
                  ]),
                  ...store.services.failures.map(failure => [
                    failure.serviceName ?? failure.displayName ?? '—',
                    failure.displayName ?? '—',
                    failure.state ?? '—',
                    failure.startMode ?? '—',
                    formatTime(failure.timeCreated),
                  ]),
                ]}
                empty={t('No failing services detected.', 'لم تُكتشف خدمات متعثرة.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<PackageCheck className="h-5 w-5" />}
          titleEn="Windows Update diagnostics"
          titleAr="تشخيص تحديثات ويندوز"
          descriptionEn="Reads update events with result codes and lists installed hotfixes from the live update inventory."
          descriptionAr="يقرأ أحداث التحديث مع رموز النتائج ويسرد التحديثات المثبتة من الجرد الحي."
          busy={busy('updates')}
          disabled={unavailable}
          hasData={Boolean(store.updates)}
          onRun={() =>
            void runSection('m17_s06', 'Windows Update diagnostics', 'تشخيص تحديثات ويندوز', () => store.analyzeUpdates(hours, 250))
          }
        >
          {store.updates && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Update events', 'أحداث التحديث')} value={String(store.updates.events.length)} />
                <MetricChip label={t('Failures', 'إخفاقات')} value={String(store.updates.failureCount)} tone={store.updates.failureCount ? 'danger' : 'ok'} />
                <MetricChip label={t('Installed hotfixes', 'حزم مثبتة')} value={String(store.updates.installedUpdates.length)} />
              </div>
              <EvidenceTable
                columns={[t('Time', 'الوقت'), t('Level', 'المستوى'), 'KB', t('Error', 'الخطأ'), t('Message', 'الرسالة')]}
                rows={store.updates.events.map(event => [
                  formatTime(event.timeCreated),
                  event.level,
                  event.kb ?? '—',
                  event.errorCode ?? '—',
                  event.message,
                ])}
                empty={t('No update events in the window.', 'لا توجد أحداث تحديث في هذا النطاق.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<HardDrive className="h-5 w-5" />}
          titleEn="Hardware warnings"
          titleAr="تحذيرات العتاد"
          descriptionEn="Reads hardware, driver, storage and kernel warning events and groups them by category."
          descriptionAr="يقرأ تحذيرات العتاد والتعريفات والتخزين والنواة ويجمّعها حسب الفئة."
          busy={busy('hardware')}
          disabled={unavailable}
          hasData={Boolean(store.hardware)}
          onRun={() =>
            void runSection('m17_s07', 'Hardware warnings', 'تحذيرات العتاد', () => store.loadHardwareWarnings(hours, 250))
          }
        >
          {store.hardware && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Warnings', 'التحذيرات')} value={String(store.hardware.events.length)} tone={store.hardware.events.length ? 'warn' : 'ok'} />
                {store.hardware.categoryCounts.slice(0, 4).map(category => (
                  <MetricChip key={category.category} label={category.category} value={String(category.count)} />
                ))}
              </div>
              <EvidenceTable
                columns={[t('Time', 'الوقت'), t('Category', 'الفئة'), t('Provider', 'المزوّد'), 'ID', t('Message', 'الرسالة')]}
                rows={store.hardware.events.map(event => [
                  formatTime(event.timeCreated),
                  event.category,
                  event.provider,
                  String(event.eventId),
                  event.message,
                ])}
                empty={t('No hardware warnings in the window.', 'لا توجد تحذيرات عتاد في هذا النطاق.')}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          icon={<Network className="h-5 w-5" />}
          titleEn="Network diagnostics"
          titleAr="تشخيص الشبكة"
          descriptionEn="Reads live adapter configuration, then resolves, pings and TCP-tests a probe target with the measured interface and latency."
          descriptionAr="يقرأ إعداد المحولات الحي، ثم يحلّل هدف الفحص ويرسل ping ويختبر TCP مع عرض الواجهة والزمن المقاس."
          busy={busy('network')}
          disabled={unavailable}
          hasData={Boolean(store.network)}
          onRun={() =>
            void runSection('m17_s08', 'Network diagnostics', 'تشخيص الشبكة', () => store.diagnoseNetwork(hours, probeTarget))
          }
        >
          <label className="flex items-center gap-2 text-xs text-slate-300">
            {t('Probe target', 'هدف الفحص')}
            <input
              value={probeTarget}
              onChange={event => setProbeTarget(event.target.value)}
              className="w-44 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 text-xs text-white"
              placeholder="8.8.8.8"
            />
          </label>
          {store.network && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <MetricChip label={t('Adapters', 'المحولات')} value={String(store.network.adapters.length)} />
                {store.network.probe && (
                  <>
                    <MetricChip
                      label={t('Ping', 'الاتصال')}
                      value={store.network.probe.pingSucceeded ? t('reachable', 'متاح') : t('unreachable', 'غير متاح')}
                      tone={store.network.probe.pingSucceeded ? 'ok' : 'danger'}
                    />
                    {store.network.probe.latencyMs != null && (
                      <MetricChip label={t('Latency', 'زمن الاستجابة')} value={`${store.network.probe.latencyMs} ms`} />
                    )}
                    <MetricChip label={t('Interface', 'الواجهة')} value={store.network.probe.interfaceAlias ?? '—'} />
                  </>
                )}
              </div>
              <EvidenceTable
                columns={[t('Adapter', 'المحول'), t('Status', 'الحالة'), t('IPv4', 'IPv4'), t('Gateway', 'البوابة'), 'DNS']}
                rows={store.network.adapters.map(adapter => [
                  adapter.name,
                  adapter.status,
                  adapter.ipv4.join(', ') || '—',
                  adapter.gateways.join(', ') || '—',
                  adapter.dnsServers.join(', ') || '—',
                ])}
                empty={t('No adapters reported.', 'لا توجد محولات معروضة.')}
              />
            </div>
          )}
        </SectionCard>
      </div>

      <section className="knoux-glass-panel space-y-4 p-6">
        <header className="flex items-start gap-3">
          <Upload className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div>
            <h2 className="text-sm font-semibold text-white">{t('Export evidence', 'تصدير الأدلة')}</h2>
            <p className="mt-1 max-w-[80ch] text-xs text-slate-400">
              {t(
                'Exports contain exactly the sections collected in this session. Every file is hashed with SHA-256 and the hash is read back from disk before the export is reported.',
                'تحتوي عمليات التصدير على الأقسام المجمّعة في هذه الجلسة فقط. تُجزّأ كل ملفاتها بـSHA-256 وتُقرأ البصمة مجددًا من القرص قبل الإبلاغ عن التصدير.',
              )}
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
          <MetricChip
            label={t('Collected sections', 'الأقسام المجمّعة')}
            value={store.collectedSections.length ? store.collectedSections.join(', ') : t('none', 'لا شيء')}
            tone={hasEvidence ? 'ok' : 'warn'}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            value={exportTitle}
            onChange={event => setExportTitle(event.target.value)}
            placeholder={t('Report title', 'عنوان التقرير')}
            className="w-64 rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-white"
          />
          <select
            value={exportFormat}
            onChange={event => setExportFormat(event.target.value as DiagnosticExportFormat)}
            className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-2 text-xs text-white"
          >
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
            <option value="html">HTML</option>
          </select>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={redact} onChange={event => setRedact(event.target.checked)} />
            {t('Redact secrets & paths', 'تنقيح الأسرار والمسارات')}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={includeSystemSummary}
              onChange={event => setIncludeSystemSummary(event.target.checked)}
            />
            {t('Include system summary', 'إرفاق ملخص النظام')}
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={unavailable || busy('export-bundle')}
            onClick={() =>
              void runSection('m17_s09', 'Support bundle export', 'تصدير حزمة الدعم', () =>
                store.exportBundle(exportTitle || 'KNOUX ONE support bundle', redact, includeSystemSummary),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-xs font-medium text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy('export-bundle') ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t('Export support bundle (ZIP)', 'تصدير حزمة الدعم (ZIP)')}
          </button>
          <button
            type="button"
            disabled={unavailable || busy('export-report')}
            onClick={() =>
              void runSection('m17_s10', 'Redacted report export', 'تصدير التقرير المنقح', () =>
                store.exportReport(exportTitle || 'KNOUX ONE diagnostic report', exportFormat, redact, includeSystemSummary),
              )
            }
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy('export-report') ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {t('Export redacted report', 'تصدير التقرير المنقح')}
          </button>
        </div>

        {store.exportResult && (
          <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-4 text-xs text-slate-300">
            <div className="flex flex-wrap gap-2">
              <MetricChip label={t('Format', 'الصيغة')} value={store.exportResult.format} />
              <MetricChip label={t('Size', 'الحجم')} value={formatBytes(store.exportResult.sizeBytes)} />
              <MetricChip label={t('Redactions', 'عمليات التنقيح')} value={String(store.exportResult.redactionCount)} />
              <MetricChip label={t('Files', 'الملفات')} value={String(store.exportResult.includedFiles.length)} />
            </div>
            <p className="break-all font-mono text-[11px] text-slate-400">{store.exportResult.path}</p>
            <p className="break-all font-mono text-[11px] text-slate-500">sha256: {store.exportResult.sha256}</p>
          </div>
        )}
      </section>
    </div>
  );
};
