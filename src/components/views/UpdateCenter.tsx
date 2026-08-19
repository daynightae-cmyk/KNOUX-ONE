import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Download,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  ServerCrash,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { desktopUpdater, type UpdateStatus, type UpdaterStage } from '../../services/desktopUpdater';

const initialStatus: UpdateStatus = {
  stage: 'idle',
  currentVersion: '…',
};

const statusCopy: Record<UpdaterStage, { en: string; ar: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  idle: { en: 'Ready to check for an official signed update.', ar: 'جاهز للتحقق من تحديث رسمي موقّع.', tone: 'neutral' },
  checking: { en: 'Checking the official release channel…', ar: 'جارٍ التحقق من قناة الإصدار الرسمية…', tone: 'neutral' },
  'no-update': { en: 'This device is already on the latest verified release.', ar: 'هذا الجهاز يعمل بأحدث إصدار تم التحقق منه.', tone: 'success' },
  available: { en: 'A signed update is available for your review.', ar: 'يتوفر تحديث موقّع ويمكنك مراجعته قبل التنزيل.', tone: 'warning' },
  downloading: { en: 'Downloading the signed update package…', ar: 'جارٍ تنزيل حزمة التحديث الموقّعة…', tone: 'neutral' },
  verifying: { en: 'Verifying the update package before installation…', ar: 'جارٍ التحقق من حزمة التحديث قبل التثبيت…', tone: 'warning' },
  'restart-required': { en: 'The update is installed and requires a restart.', ar: 'تم تثبيت التحديث ويتطلب إعادة تشغيل التطبيق.', tone: 'success' },
  failed: { en: 'The update could not be completed safely. The application remains usable.', ar: 'تعذر إكمال التحديث بأمان. يبقى التطبيق قابلًا للاستخدام.', tone: 'danger' },
  offline: { en: 'Update checks require the installed desktop application and a network connection.', ar: 'يتطلب التحقق من التحديثات التطبيق المكتبي المثبت واتصالًا بالشبكة.', tone: 'warning' },
  'server-unavailable': { en: 'The official update service is temporarily unavailable. No changes were made.', ar: 'خدمة التحديث الرسمية غير متاحة مؤقتًا. لم يتم إجراء أي تغيير.', tone: 'warning' },
  'signature-invalid': { en: 'The update signature was invalid. Installation was stopped.', ar: 'توقيع التحديث غير صالح. تم إيقاف التثبيت.', tone: 'danger' },
};

const toneClasses = {
  neutral: 'border-[var(--knoux-primary)]/30 bg-[var(--knoux-primary)]/10 text-[var(--knoux-text)]',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  danger: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
};

function statusIcon(stage: UpdaterStage) {
  if (stage === 'no-update' || stage === 'restart-required') return CheckCircle2;
  if (stage === 'offline') return CloudOff;
  if (stage === 'server-unavailable') return ServerCrash;
  if (stage === 'signature-invalid') return ShieldAlert;
  if (stage === 'failed') return AlertTriangle;
  if (stage === 'checking' || stage === 'downloading' || stage === 'verifying') return LoaderCircle;
  return Sparkles;
}

export const UpdateCenter: React.FC = () => {
  const { t } = useKnoux();
  const [status, setStatus] = useState<UpdateStatus>(initialStatus);
  const copy = statusCopy[status.stage];
  const StatusIcon = statusIcon(status.stage);
  const isBusy = status.stage === 'checking' || status.stage === 'downloading' || status.stage === 'verifying';
  const progress = useMemo(() => {
    if (!status.totalBytes || status.totalBytes <= 0) return undefined;
    return Math.min(100, Math.round(((status.downloadedBytes ?? 0) / status.totalBytes) * 100));
  }, [status.downloadedBytes, status.totalBytes]);

  useEffect(() => {
    let active = true;
    void desktopUpdater.currentVersion().then((currentVersion) => {
      if (active) setStatus((previous) => ({ ...previous, currentVersion }));
    });
    return () => { active = false; };
  }, []);

  async function checkForUpdate() {
    const currentVersion = await desktopUpdater.currentVersion();
    setStatus({ stage: 'checking', currentVersion });
    setStatus(await desktopUpdater.checkForUpdate());
  }

  async function downloadAndInstall() {
    setStatus((previous) => ({ ...previous, stage: 'downloading' }));
    const result = await desktopUpdater.downloadAndInstall(setStatus);
    setStatus(result);
  }

  async function restartToFinishInstall() {
    try {
      await desktopUpdater.restartToFinishInstall();
    } catch {
      setStatus((previous) => ({ ...previous, stage: 'failed' }));
    }
  }

  const action = status.stage === 'available'
    ? { label: t('Download and install', 'تنزيل وتثبيت'), icon: Download, run: downloadAndInstall }
    : status.stage === 'restart-required'
      ? { label: t('Restart KNOUX ONE', 'إعادة تشغيل كنوكس ون'), icon: RotateCcw, run: restartToFinishInstall }
      : { label: t('Check for updates', 'التحقق من التحديثات'), icon: RefreshCw, run: checkForUpdate };
  const ActionIcon = action.icon;

  return (
    <article className="knoux-glass-panel p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-3 rtl:flex-row-reverse">
          <div className="knoux-icon-plate"><RefreshCw className="h-[21px] w-[21px]" /></div>
          <div>
            <h2 className="text-[19px] font-black text-[var(--knoux-text)]">{t('Official updates', 'التحديثات الرسمية')}</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-6 text-[var(--knoux-text-muted)]">{t('KNOUX ONE only installs packages accepted by the desktop updater verification flow. Release URLs, credentials, and signing material are never displayed here.', 'لا يثبت كنوكس ون إلا الحزم التي يقبلها مسار التحقق الخاص بمحدّث سطح المكتب. لا تُعرض هنا روابط الإصدارات أو بيانات الاعتماد أو مواد التوقيع.')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void action.run()}
          disabled={isBusy}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--knoux-primary)] px-4 text-[13px] font-black text-white transition hover:bg-[var(--knoux-primary-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ActionIcon className={`h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
          {action.label}
        </button>
      </div>

      <div className={`mt-5 rounded-2xl border p-4 ${toneClasses[copy.tone]}`} role="status" aria-live="polite">
        <div className="flex items-start gap-3 rtl:flex-row-reverse">
          <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isBusy ? 'animate-spin' : ''}`} />
          <div className="min-w-0">
            <p className="text-[13px] font-black">{t(copy.en, copy.ar)}</p>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-medium opacity-85">
              <span>{t('Current version', 'الإصدار الحالي')}: <b dir="ltr">{status.currentVersion}</b></span>
              {status.availableVersion && <span>{t('Available version', 'الإصدار المتاح')}: <b dir="ltr">{status.availableVersion}</b></span>}
              {progress !== undefined && <span>{t('Download progress', 'تقدم التنزيل')}: <b dir="ltr">{progress}%</b></span>}
            </div>
          </div>
        </div>
        {progress !== undefined && <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-[var(--knoux-primary)] transition-all" style={{ width: `${progress}%` }} /></div>}
      </div>

      {status.notes && (status.stage === 'available' || status.stage === 'restart-required') && (
        <div className="mt-4 rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
          <p className="text-[12px] font-black text-[var(--knoux-text)]">{t('Release notes', 'ملاحظات الإصدار')}</p>
          <p className="mt-2 whitespace-pre-wrap text-[12px] leading-6 text-[var(--knoux-text-secondary)]">{status.notes}</p>
        </div>
      )}
    </article>
  );
};
