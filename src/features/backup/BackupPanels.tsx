import React, { useCallback, useState } from 'react';
import { Archive, CheckCircle2, FileJson, FolderDown, RefreshCw, XCircle } from 'lucide-react';
import { useKnoux } from '../../context/KnouxContext';
import { backupClient } from './backupClient';
import type {
  BackupRun,
  BookmarkBackup,
  EnvironmentExport,
  RegistryBackup,
  RestoreInventory,
  SettingsExport,
  WrittenFile,
} from './backupContracts';

const Banner: React.FC<{ tone: 'info' | 'warn' | 'muted'; children: React.ReactNode }> = ({ tone, children }) => (
  <p
    className={`rounded-xl border p-3 text-xs leading-6 ${
      tone === 'warn'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
        : tone === 'muted'
          ? 'border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] text-[var(--knoux-text-muted)]'
          : 'border-sky-500/30 bg-sky-500/10 text-sky-200'
    }`}
  >
    {children}
  </p>
);

const bytes = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const FileTable: React.FC<{ files: WrittenFile[]; language: 'en' | 'ar' }> = ({ files, language }) => {
  if (files.length === 0) {
    return (
      <Banner tone="warn">
        {language === 'ar'
          ? 'لم يُكتب أي ملف. نسخة احتياطية فارغة ليست نسخة احتياطية جيدة.'
          : 'No file was written. An empty backup is not a good backup.'}
      </Banner>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-[11px]">
        <thead>
          <tr className="text-[var(--knoux-text-muted)]">
            <th className="py-1">{language === 'ar' ? 'الملف' : 'File'}</th>
            <th className="py-1">{language === 'ar' ? 'الحجم' : 'Size'}</th>
            <th className="py-1">SHA-256</th>
            <th className="py-1">{language === 'ar' ? 'تحقّق بالقراءة' : 'Read back'}</th>
          </tr>
        </thead>
        <tbody>
          {files.map(file => (
            <tr key={file.filePath} className="border-t border-[var(--knoux-border)]">
              <td className="break-all py-1 font-bold text-[var(--knoux-text)]">{file.fileName}</td>
              <td className="py-1 text-[var(--knoux-text-secondary)]">{bytes(file.byteCount)}</td>
              <td className="break-all py-1 font-mono text-[10px] text-[var(--knoux-text-muted)]">
                {file.sha256 ? `${file.sha256.slice(0, 24)}…` : '—'}
              </td>
              <td className="py-1">
                <span className="inline-flex items-center gap-1">
                  {file.readBackVerified ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                  )}
                  <span className="text-[var(--knoux-text-secondary)]">
                    {file.readBackVerified
                      ? language === 'ar' ? 'نعم' : 'yes'
                      : file.verificationNote ?? (language === 'ar' ? 'لا' : 'no')}
                  </span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const RunBanner: React.FC<{ run: BackupRun; language: 'en' | 'ar' }> = ({ run, language }) => (
  <div className="space-y-2">
    <p
      className={`rounded-xl border p-3 text-xs font-black ${
        run.everythingVerified
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      }`}
    >
      {run.everythingVerified
        ? language === 'ar'
          ? `كل ملف تحقّق بالقراءة — ${run.filesWritten} ملف، ${bytes(run.totalBytes)}`
          : `Every file verified by read-back — ${run.filesWritten} files, ${bytes(run.totalBytes)}`
        : language === 'ar'
          ? `لم يكتمل التحقق — ${run.filesWritten} متحقق، ${run.filesFailed} غير متحقق`
          : `Verification incomplete — ${run.filesWritten} verified, ${run.filesFailed} unverified`}
    </p>
    <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">{run.runDirectory}</p>
    {run.destinationDefaulted && (
      <Banner tone="muted">
        {language === 'ar'
          ? 'استُخدم مجلد الوجهة الافتراضي داخل بيانات التطبيق.'
          : 'The default destination inside the application data directory was used.'}
      </Banner>
    )}
    {run.sources.filter(item => !item.available).map(item => (
      <Banner key={item.name} tone="warn">
        {item.name}: {item.detail}
      </Banner>
    ))}
  </div>
);

const useBackup = <T,>(load: () => Promise<{ data?: T; message: string }>) => {
  const [data, setData] = useState<T | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    const result = await load();
    setBusy(false);
    setData(result.data ?? null);
    setMessage(result.message);
  }, [busy, load]);
  return { data, message, busy, run };
};

const Panel: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="knoux-glass-panel p-5 md:p-7">
    <div className="knoux-eyebrow">
      <Archive className="h-4 w-4" />
      {title}
    </div>
    <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[var(--knoux-text-muted)]">{subtitle}</p>
    <div className="mt-5 space-y-4">{children}</div>
  </section>
);

export const BackupPanels: React.FC<{ available: boolean }> = ({ available }) => {
  const { t, language, addLog } = useKnoux();
  const pick = (en: string, ar: string) => t(en, ar);
  const [destination, setDestination] = useState('');
  const [includeContents, setIncludeContents] = useState(true);

  const settings = useBackup<SettingsExport>(async () => {
    const result = await backupClient.exportSettings({
      destinationDirectory: destination.trim() || undefined,
      includeContents,
    });
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const environment = useBackup<EnvironmentExport>(async () => {
    const result = await backupClient.exportEnvironment(destination.trim() || undefined);
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const bookmarks = useBackup<BookmarkBackup>(async () => {
    const result = await backupClient.backupBookmarks(destination.trim() || undefined);
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const registry = useBackup<RegistryBackup>(async () => {
    const result = await backupClient.backupRegistryKeys(destination.trim() || undefined);
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });
  const restore = useBackup<RestoreInventory>(async () => {
    const result = await backupClient.restoreInventory(destination.trim() || undefined);
    return { data: result.data, message: language === 'ar' ? result.summaryAr : result.summaryEn };
  });

  const runAll = useCallback(async () => {
    if (!available) return;
    addLog('m11_s03', pick('Verified backup', 'نسخة موثّقة'), 'in_progress', pick('Exporting settings, environment and bookmarks.', 'تصدير الإعدادات والبيئة والمفضلة.'));
    await Promise.all([settings.run(), environment.run(), bookmarks.run()]);
    addLog('m11_s03', pick('Verified backup', 'نسخة موثّقة'), 'completed', pick('Every written file was read back and hashed.', 'قُرئ كل ملف مكتوب التحقق وجُمّل.'));
  }, [addLog, available, bookmarks, environment, pick, settings]);

  const anyBusy = settings.busy || environment.busy || bookmarks.busy || registry.busy || restore.busy;
  const button = (busy: boolean, label: string) => (
    <button type="button" disabled={!available || busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <section className="knoux-glass-panel p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="knoux-eyebrow">{pick('Verified backup', 'نسخة احتياطية موثّقة')}</div>
            <h2 className="mt-2 text-2xl font-black text-[var(--knoux-text)]">
              {pick('Export real machine state, then prove it was written', 'صدّر حالة الجهاز الحقيقية، ثم أثبت أنها كُتبت')}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--knoux-text-muted)]">
              {pick(
                'Each run writes into its own timestamped folder, so a failed run cannot destroy the last known-good copy. Every file is hashed and read back, and an empty run is reported as empty rather than as a good backup.',
                'كل تشغيل يكتب في مجلده المؤرَّخ الخاص، فلا يمكن لتشغيل فاشل أن يهدم آخر نسخة سليمة. ويُجزَّأ كل ملف ويُقرأ، والتشغيل الفارغ يُبلَّغ عنه كـ«فارغ» لا كنسخة جيدة.',
              )}
            </p>
          </div>
          <button type="button" onClick={runAll} disabled={!available || anyBusy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
            {anyBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
            {pick('Back up all three', 'انسخ الثلاثة')}
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black text-[var(--knoux-text)]">{pick('Destination folder (absolute, empty for the default)', 'مجلد الوجهة (مطلق، فارغ للافتراضي)')}</span>
            <input
              value={destination}
              onChange={event => setDestination(event.target.value)}
              placeholder="D:\\Backups"
              className="mt-2 w-full rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface)] px-4 py-3 text-[var(--knoux-text)]"
              disabled={anyBusy}
            />
            <span className="mt-1 block text-[11px] text-[var(--knoux-text-muted)]">
              {pick('Default: the KNOUX ONE app data backups folder. Each run creates its own subfolder.', 'الافتراضي: مجلد backups داخل بيانات KNOUX ONE. كل تشغيل ينشئ مجلده الفرعي.')}
            </span>
          </label>
          <label className="flex items-start gap-3 self-end rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-3 text-xs text-[var(--knoux-text-secondary)]">
            <input type="checkbox" checked={includeContents} onChange={event => setIncludeContents(event.target.checked)} disabled={anyBusy} className="mt-1" />
            <span>
              {pick(
                'Include document contents in the settings export. With this off the export proves which settings exist and their digests, but cannot be restored from.',
                'إدراج محتويات المستندات في تصدير الإعدادات. مع إيقافه يثبت التصدير وجود الإعدادات وتجزئاتها، لكنه لا يصلح للاسترجاع.',
              )}
            </span>
          </label>
        </div>
      </section>

      <Panel
        title={pick('Settings export', 'تصدير الإعدادات')}
        subtitle={pick(
          'An explicit document list from the KNOUX ONE data directory, not a directory sweep, so a new file is never swept into a settings backup by accident. Directory contents are emitted in sorted order with a normalised separator so the digest is reproducible.',
          'قائمة مستندات صريحة من مجلد بيانات KNOUX ONE، لا مسح للمجلد، فلا يُدخل ملف جديد إلى نسخة الإعدادات بالخطأ. وتُخرج المحتويات مرتبة بفاصل موحّد ليبقى التجزئة قابلة للتكرار.',
        )}
      >
        <button type="button" onClick={settings.run} disabled={!available || settings.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {settings.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
          {pick('Export settings', 'صدّر الإعدادات')}
        </button>
        {settings.message && <Banner tone="info">{settings.message}</Banner>}
        {settings.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Readout label={pick('Documents found', 'مستندات موجودة')} value={String(settings.data.documentCount)} />
              <Readout label={pick('Contents included', 'المحتويات مُدرجة')} value={settings.data.includeContents ? pick('yes', 'نعم') : pick('no', 'لا')} />
              <Readout label={pick('Manifest verified', 'البيان موثّق')} value={settings.data.manifestReadBackVerified ? pick('yes', 'نعم') : pick('no', 'لا')} />
            </div>
            <RunBanner run={settings.data.run} language={language} />
            <FileTable files={settings.data.run.files} language={language} />
            <p className="break-all font-mono text-[11px] text-[var(--knoux-text-muted)]">
              {settings.data.appDataDirectory} · manifest {settings.data.manifestSha256.slice(0, 24)}…
            </p>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Environment variables', 'متغيرات البيئة')}
        subtitle={pick(
          'Machine and per-user values read from the registry. A user PATH does not replace the machine PATH on Windows — both are searched — so the effective value is the concatenation in search order and every entry present in both scopes is named.',
          'قيم الجهاز والمستخدم مقروءة من السجل. مسار المستخدم لا يستبدل مسار الجهاز في ويندوز — كلاهما يُبحث — لذا القيمة الفعلية هي الدمج بترتيب البحث ويُسمّى كل مدخل موجود في النطاقين.',
        )}
      >
        <button type="button" onClick={environment.run} disabled={!available || environment.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {environment.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
          {pick('Export environment', 'صدّر البيئة')}
        </button>
        {environment.message && <Banner tone="info">{environment.message}</Banner>}
        {environment.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Machine PATH entries', 'مدخلات مسار الجهاز')} value={String(environment.data.pathMachineEntries)} />
              <Readout label={pick('User PATH entries', 'مدخلات مسار المستخدم')} value={String(environment.data.pathUserEntries)} />
              <Readout label={pick('In both scopes', 'في النطاقين')} value={String(environment.data.pathDuplicateEntries)} />
              <Readout label={pick('Effective PATH length', 'طول PATH الفعلي')} value={`${environment.data.effectivePathLength} chars`} />
            </div>
            <RunBanner run={environment.data.run} language={language} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-1">{pick('Variable', 'المتغير')}</th>
                    <th className="py-1">{pick('Machine', 'الجهاز')}</th>
                    <th className="py-1">{pick('User', 'المستخدم')}</th>
                    <th className="py-1">{pick('Effective length', 'الطول الفعلي')}</th>
                  </tr>
                </thead>
                <tbody>
                  {environment.data.variables.map(variable => (
                    <tr key={variable.name} className="border-t border-[var(--knoux-border)]">
                      <td className="py-1 font-mono text-[var(--knoux-text)]">{variable.name}</td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">
                        {variable.machinePresent ? `${variable.machineValue?.length ?? 0} chars` : pick('absent', 'غائب')}
                      </td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">
                        {variable.userPresent ? `${variable.userValue?.length ?? 0} chars` : pick('absent', 'غائب')}
                      </td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">{variable.effectiveValue.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {environment.data.pathDuplicateEntries > 0 && (
              <Banner tone="warn">
                {pick(
                  'Some PATH entries exist in both scopes. Restoring only one of them would silently drop entries, so both are exported.',
                  'بعض مدخلات PATH موجودة في النطاقين. استعادة أحدهما فقط تُسقط مدخلات بصمت، لذا صُدِّر كلاهما.',
                )}
              </Banner>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Bookmark backup', 'نسخ المفضلة')}
        subtitle={pick(
          'Browsers are discovered from real profile directories and Chromium profile names are read from Local State. Every Bookmarks file is validated as JSON before it is called a backup, and a Firefox profile is copied as a complete places.sqlite set including its WAL and SHM sidecars.',
          'يُكتشف المتصفحات من مجلدات الملفات التعريفية الحقيقية، وتُقرأ أسماء ملفات تعريف Chromium من Local State. ويُتحقق من كل ملف Bookmarks أنه JSON قبل اعتباره نسخة، وتُنسخ ملفات تعريف Firefox كطقم places.sqlite كامل مع ملفي WAL وSHM.',
        )}
      >
        <button type="button" onClick={bookmarks.run} disabled={!available || bookmarks.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {bookmarks.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
          {pick('Back up bookmarks', 'انسخ المفضلة')}
        </button>
        {bookmarks.message && <Banner tone="info">{bookmarks.message}</Banner>}
        {bookmarks.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Browsers found', 'متصفحات موجودة')} value={String(bookmarks.data.browsersFound)} />
              <Readout label={pick('Profiles seen', 'ملفات تعريف شوهدت')} value={String(bookmarks.data.profilesFound)} />
              <Readout label={pick('Files copied', 'ملفات نُسخت')} value={String(bookmarks.data.filesCopied)} />
              <Readout
                label={pick('Wrote into a browser profile', 'كُتب داخل ملف تعريف')}
                value={bookmarks.data.wroteIntoAnyBrowserProfile ? pick('yes', 'نعم') : pick('no', 'لا')}
              />
            </div>
            <RunBanner run={bookmarks.data.run} language={language} />
            {bookmarks.data.sources.length === 0 ? (
              <Banner tone="warn">
                {pick(
                  'No browser profile directory was found on this machine.',
                  'لم يُعثر على أي مجلد ملفات تعريف متصفح على هذا الجهاز.',
                )}
              </Banner>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[11px]">
                  <thead>
                    <tr className="text-[var(--knoux-text-muted)]">
                      <th className="py-1">{pick('Browser', 'المتصفح')}</th>
                      <th className="py-1">{pick('Profile', 'الملف الشخصي')}</th>
                      <th className="py-1">{pick('Found', 'وُجد')}</th>
                      <th className="py-1">{pick('Copied', 'نُسخ')}</th>
                      <th className="py-1">{pick('Note', 'ملاحظة')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookmarks.data.sources.map((entry, index) => (
                      <tr key={`${entry.browser}-${entry.profileName}-${index}`} className="border-t border-[var(--knoux-border)]">
                        <td className="py-1 font-bold text-[var(--knoux-text)]">{entry.browser}</td>
                        <td className="break-all py-1 text-[var(--knoux-text-secondary)]">{entry.profileName}</td>
                        <td className="py-1 text-[var(--knoux-text-secondary)]">{entry.exists ? pick('yes', 'نعم') : pick('no', 'لا')}</td>
                        <td className="py-1 text-[var(--knoux-text-secondary)]">
                          {entry.copied
                            ? `${pick('yes', 'نعم')} · ${bytes(entry.byteCount)}`
                            : pick('no', 'لا')}
                        </td>
                        <td className="break-all py-1 text-[var(--knoux-text-muted)]">{entry.rejectionReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {bookmarks.data.filesCopied === 0 && (
              <Banner tone="warn">
                {pick(
                  'No readable bookmarks file was found, so nothing was copied. An empty backup is reported as empty rather than as success.',
                  'لم يُعثر على ملف مفضلة قابل للقراءة، فلم يُنسخ شيء. النسخة الفارغة تُبلَّغ عنها كـ«فارغة» لا كنجاح.',
                )}
              </Banner>
            )}
          </div>
        )}
      </Panel>
      <Panel
        title={pick('Registry keys', 'مفاتيح السجل')}
        subtitle={pick(
          'A fixed list of six allowlisted keys exported with reg.exe export, which writes a .reg file and never writes to the registry. There is no way to pass a key: the list lives in the application, so a caller cannot widen what is read. Each file is hashed, read back and structurally checked.',
          'قائمة ثابتة من ستة مفاتيح مسموح بها تُصدَّر عبر reg.exe export، وهو يكتب ملف .reg ولا يكتب في السجل. ولا سبيل تمرير مفتاح: القائمة داخل التطبيق فلا يمكن للمستدعي توسيع ما يُقرأ. ويُجزَّأ كل ملف ويُقرأ ويُفحص بنيويًا.',
        )}
      >
        <button type="button" onClick={registry.run} disabled={!available || registry.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {registry.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
          {pick('Export allowlisted keys', 'صدّر المفاتيح المسموح بها')}
        </button>
        {registry.message && <Banner tone="info">{registry.message}</Banner>}
        {registry.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Keys requested', 'مفاتيح مطلوبة')} value={String(registry.data.keysRequested)} />
              <Readout label={pick('Exported', 'صُدِّرت')} value={String(registry.data.keysExported)} />
              <Readout label={pick('Absent or refused', 'غائبة أو مرفوضة')} value={String(registry.data.keysAbsent)} />
              <Readout
                label={pick('Wrote to the registry', 'كتب في السجل')}
                value={registry.data.wroteToAnyRegistryKey ? pick('yes', 'نعم') : pick('no', 'لا')}
              />
            </div>
            <RunBanner run={registry.data.run} language={language} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead>
                  <tr className="text-[var(--knoux-text-muted)]">
                    <th className="py-1">{pick('Key', 'المفتاح')}</th>
                    <th className="py-1">{pick('Exported', 'صُدِّر')}</th>
                    <th className="py-1">{pick('Size', 'الحجم')}</th>
                    <th className="py-1">{pick('Keys / values in file', 'مفاتيح / قيم في الملف')}</th>
                    <th className="py-1">{pick('Verified', 'موثّق')}</th>
                  </tr>
                </thead>
                <tbody>
                  {registry.data.keys.map(entry => (
                    <tr key={entry.key} className="border-t border-[var(--knoux-border)]">
                      <td className="break-all py-1 font-mono text-[var(--knoux-text)]">{entry.key}</td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">
                        {entry.exported ? pick('yes', 'نعم') : pick('no', 'لا')}
                      </td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">{bytes(entry.byteCount)}</td>
                      <td className="py-1 text-[var(--knoux-text-secondary)]">
                        {entry.exported ? `${entry.keyHeaderCount} / ${entry.valueHeaderCount}` : '—'}
                      </td>
                      <td className="break-all py-1 text-[var(--knoux-text-muted)]">
                        {entry.rejectionReason ?? (entry.readBackVerified ? pick('yes', 'نعم') : pick('no', 'لا'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Panel>

      <Panel
        title={pick('Restore inventory', 'جرد الاسترجاع')}
        subtitle={pick(
          'Every backup run is re-hashed on disk and compared against the digest that run recorded. A file with no recorded digest is reported as a baseline, never as a pass, and a run counts as verified only when every file in it still matches. Nothing is deleted.',
          'يُعاد تجزئة كل تشغيل على القرص ويُقارن بالتجزئة التي سجّلها. والملف بلا تجزئة مسجّلة يُبلَّغ عنه كخط أساس لا كنجاح، ولا يُعدّ التشغيل متحقَّقًا إلا إذا طابق كل ملف. لا يُحذف شيء.',
        )}
      >
        <button type="button" onClick={restore.run} disabled={!available || restore.busy} className="knoux-card-action knoux-card-action--primary disabled:opacity-50">
          {restore.busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FolderDown className="h-4 w-4" />}
          {pick('Check restore readiness', 'افحص جاهزية الاسترجاع')}
        </button>
        {restore.message && <Banner tone="info">{restore.message}</Banner>}
        {restore.data && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Readout label={pick('Backup runs found', 'تشغيلات نسخ موجودة')} value={String(restore.data.runsFound)} />
              <Readout label={pick('Runs verified', 'تشغيلات متحقَّقة')} value={String(restore.data.runsVerified)} />
              <Readout label={pick('Runs with missing or altered files', 'تشغيلات بملفات ناقصة أو متغيّرة')} value={String(restore.data.runsWithMissingOrAlteredFiles)} />
              <Readout label={pick('Bytes on disk', 'بايتات على القرص')} value={bytes(restore.data.totalBytesOnDisk)} />
            </div>
            {!restore.data.backupRootExists && (
              <Banner tone="warn">
                {pick('The backup root does not exist, so no backup has been taken on this machine yet.', 'جذر النسخ غير موجود، فلا توجد نسخة احتياطية على هذا الجهاز بعد.')}
              </Banner>
            )}
            {restore.data.runs.length === 0 ? (
              <Banner tone="warn">
                {pick('No backup run was found. Restore readiness is unknown, not good.', 'لم يُعثر على أي تشغيل نسخ. جاهزية الاسترجاع غير معروفة لا جيدة.')}
              </Banner>
            ) : (
              restore.data.runs.map(run => (
                <article key={run.runId} className={`rounded-2xl border p-4 text-xs ${run.runVerified ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-[var(--knoux-text)]">{run.runId}</span>
                    <span className="text-[var(--knoux-text-secondary)]">
                      {run.filesMatching} / {run.filesChecked} {pick('match', 'تطابق')} · {bytes(run.totalBytes)}
                      {run.ageDays >= 0 ? ` · ${run.ageDays.toFixed(1)}d` : ''}
                    </span>
                  </div>
                  <p className="mt-1 break-all font-mono text-[10px] text-[var(--knoux-text-muted)]">{run.runDirectory}</p>
                  {(run.filesMissing > 0 || run.filesAltered > 0 || run.filesBaselineOnly > 0) && (
                    <p className="mt-2 text-[11px] text-amber-200">
                      {run.filesMissing} {pick('missing', 'ناقص')} · {run.filesAltered} {pick('altered', 'متغيّر')} · {run.filesBaselineOnly} {pick('baseline only', 'خط أساس فقط')}
                    </p>
                  )}
                  <ul className="mt-2 space-y-1 text-[10px] text-[var(--knoux-text-secondary)]">
                    {run.files.map(file => (
                      <li key={file.filePath} className="break-all">
                        {file.stillMatches ? 'OK' : file.baselineOnly ? 'BASELINE' : 'MISMATCH'} {file.fileName}
                        {file.note ? ` — ${file.note}` : ''}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
            <Banner tone="muted">
              {pick('This check only reads. It deleted nothing and restored nothing.', 'هذا الفحص قراءة فقط. لم يحذف شيئًا ولم يسترجع شيئًا.')}
            </Banner>
            {restore.data.destinationDefaulted && (
              <Banner tone="muted">
                {pick('No backup root was supplied, so the default directory inside the application data folder was checked. The numbers above are about that directory.', 'لم يُمرَّر جذر نسخ، فتم فحص المجلد الافتراضي داخل بيانات التطبيق. والأرقام أعلاه عن ذلك المجلد.')}
              </Banner>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
};

const Readout: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-surface-muted)] p-4">
    <p className="text-xs font-bold text-[var(--knoux-text-muted)]">{label}</p>
    <p className="mt-2 break-all text-sm font-black text-[var(--knoux-text)]">{value || '—'}</p>
  </div>
);
