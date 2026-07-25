import React from 'react';
import {
  Archive,
  CheckCircle2,
  Copy,
  Eye,
  FileAudio,
  FileCode,
  FileText,
  Image as ImageIcon,
  Link2,
  ShieldAlert,
  Video,
} from 'lucide-react';
import type { DuplicateFileItem, DuplicateGroup } from './duplicateContracts';
import { formatBytes, getCategoryBadgeColor } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

function categoryIcon(category: string) {
  switch (category) {
    case 'images': return ImageIcon;
    case 'videos': return Video;
    case 'audio': return FileAudio;
    case 'documents': return FileText;
    case 'archives': return Archive;
    default: return FileCode;
  }
}

export function DuplicateGroupCard({ group, store }: { group: DuplicateGroup; store: any }) {
  const { t } = useTranslation();
  const Icon = categoryIcon(group.category);
  const exact = group.proofStatus === 'verified_exact';
  const candidate = group.proofStatus === 'candidate';
  const similar = group.proofStatus === 'visually_similar';

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)]">
      <header className="flex flex-col gap-3 border-b border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${getCategoryBadgeColor(group.category)}`}>
            <Icon className="h-4 w-4" />
            {group.category}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-sm text-[var(--knoux-text)]">
                {group.files.length} {t('related files', 'ملفات مرتبطة')}
              </strong>
              <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${
                exact
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : candidate
                    ? 'bg-amber-500/15 text-amber-300'
                    : similar
                      ? 'bg-blue-500/15 text-blue-300'
                      : 'bg-violet-500/15 text-violet-300'
              }`}>
                {group.proofStatus.replaceAll('_', ' ')}
              </span>
              {!group.actionable && (
                <span className="rounded-full bg-slate-500/15 px-2 py-1 text-[10px] font-black text-slate-300">
                  {t('Review only', 'للمراجعة فقط')}
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr">
              {group.commonHash}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-end">
            <p className="text-[11px] text-[var(--knoux-subtext)]">{t('Verified reclaimable', 'المساحة الموثقة القابلة للاسترداد')}</p>
            <p className="font-mono text-sm font-black text-emerald-400">{formatBytes(group.wastedSizeBytes)}</p>
          </div>
          {group.category === 'images' && (
            <button
              type="button"
              onClick={() => {
                store.setSelectedGroupForCompare(group);
                store.setActiveTab('compare');
              }}
              className="knoux-btn-secondary inline-flex items-center gap-2 text-xs"
            >
              <Eye className="h-4 w-4" />
              {t('Compare', 'مقارنة')}
            </button>
          )}
        </div>
      </header>

      {group.warnings.length > 0 && (
        <div className="border-b border-amber-500/15 bg-amber-500/5 px-5 py-3 text-xs leading-6 text-amber-100/80">
          {group.warnings.join(' • ')}
        </div>
      )}

      <div className="divide-y divide-[var(--knoux-border)]">
        {group.files.map((file: DuplicateFileItem) => {
          const selectionDisabled =
            !group.actionable ||
            file.isKeeper ||
            file.protectedPath ||
            file.isHardLinkAlias;

          return (
            <div
              key={file.id}
              className={`flex flex-col gap-3 p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                file.isKeeper
                  ? 'bg-emerald-500/5'
                  : file.selectedForQuarantine
                    ? 'bg-amber-500/5'
                    : ''
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <input
                  type="checkbox"
                  disabled={selectionDisabled}
                  checked={file.selectedForQuarantine}
                  onChange={() => store.toggleFileSelection(group.groupId, file.id)}
                  className="mt-1 rounded border-[var(--knoux-border)] text-amber-500 disabled:opacity-25"
                  aria-label={t('Select for quarantine', 'تحديد للنقل إلى المحجر')}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="max-w-xl truncate text-sm text-[var(--knoux-text)]">{file.name}</strong>
                    {file.isKeeper && (
                      <Badge icon={CheckCircle2} text={t('Keeper', 'النسخة المحتفظ بها')} className="bg-emerald-500/15 text-emerald-300" />
                    )}
                    {file.isHardLinkAlias && (
                      <Badge icon={Link2} text={t('Hard-link alias', 'رابط صلب لنفس الملف')} className="bg-blue-500/15 text-blue-300" />
                    )}
                    {file.selectedForQuarantine && !file.isKeeper && (
                      <Badge icon={ShieldAlert} text={t('Selected', 'محدد للمحجر')} className="bg-amber-500/15 text-amber-300" />
                    )}
                    {file.similarityScore !== undefined && (
                      <Badge icon={Copy} text={`${file.similarityScore.toFixed(1)}%`} className="bg-violet-500/15 text-violet-300" />
                    )}
                  </div>

                  <p className="mt-1 truncate font-mono text-[11px] text-[var(--knoux-subtext)]" dir="ltr" title={file.canonicalPath}>
                    {file.canonicalPath}
                  </p>
                  {file.keeperReason && <p className="mt-1 text-[11px] text-emerald-300/90">{file.keeperReason}</p>}
                </div>
              </div>

              <div className="shrink-0 text-end">
                <p className="font-mono text-sm font-black text-[var(--knoux-text)]">{formatBytes(file.sizeBytes)}</p>
                <p className="mt-1 text-[10px] text-[var(--knoux-subtext)]">
                  {new Date(file.modifiedTime).toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Badge({ icon: Icon, text, className }: { icon: React.ElementType; text: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${className}`}>
      <Icon className="h-3 w-3" />
      {text}
    </span>
  );
}
