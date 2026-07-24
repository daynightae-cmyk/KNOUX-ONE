/**
 * KNOUX ONE — Module 03 Duplicate Group Card Component
 */
import React from 'react';
import {
  FileCode,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Archive,
  CheckCircle2,
  ShieldAlert,
  Sliders,
  Eye,
  ExternalLink
} from 'lucide-react';
import { DuplicateGroup, DuplicateFileItem } from './duplicateContracts';
import { formatBytes, formatShortPath, getCategoryBadgeColor } from './duplicateFormatters';
import { useTranslation } from '../../i18n';

export function DuplicateGroupCard({
  group,
  store,
}: {
  group: any;
  store: any;
  key?: any;
}) {
  const { t } = useTranslation();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'images': return ImageIcon;
      case 'videos': return VideoIcon;
      case 'documents': return FileText;
      case 'archives': return Archive;
      default: return FileCode;
    }
  };

  const IconComp = getCategoryIcon(group.category);

  return (
    <div className="knoux-card rounded-xl border border-[var(--knoux-border)] bg-[var(--knoux-card-bg)] overflow-hidden shadow-sm">
      {/* Group Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border text-xs font-bold flex items-center gap-1.5 ${getCategoryBadgeColor(group.category)}`}>
            <IconComp className="h-4 w-4" />
            <span className="capitalize">{group.category}</span>
          </div>
          <div>
            <span className="text-xs font-semibold text-[var(--knoux-text)]">
              {group.files.length} {t('Matching Copies Found', 'نسخ متطابقة')}
            </span>
            <span className="ms-3 text-xs text-emerald-400 font-mono">
              {t('Wasted Space:', 'المساحة الضائعة:')} {formatBytes(group.wastedSizeBytes)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              store.setSelectedGroupForCompare(group);
              store.setActiveTab('compare');
            }}
            className="knoux-btn-secondary py-1 px-3 text-xs flex items-center gap-1"
          >
            <Eye className="h-3.5 w-3.5 text-blue-400" />
            {t('Compare Visuals', 'مقارنة بصرية')}
          </button>
        </div>
      </div>

      {/* Files List */}
      <div className="divide-y divide-[var(--knoux-border)]">
        {group.files.map((file: DuplicateFileItem) => (
          <div
            key={file.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 text-xs gap-3 transition-colors ${
              file.isKeeper
                ? 'bg-emerald-500/5'
                : file.selectedForQuarantine
                ? 'bg-amber-500/5'
                : ''
            }`}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <input
                type="checkbox"
                disabled={file.isKeeper}
                checked={file.selectedForQuarantine}
                onChange={() => store.toggleFileSelection(group.groupId, file.id)}
                className="mt-1 rounded border-[var(--knoux-border)] bg-[var(--knoux-bg-soft)] text-amber-500 disabled:opacity-30"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[var(--knoux-text)] truncate max-w-md">{file.name}</span>
                  {file.isKeeper && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('ORIGINAL KEEPER', 'النسخة الأصلية')}
                    </span>
                  )}
                  {!file.isKeeper && file.selectedForQuarantine && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      <ShieldAlert className="h-3 w-3" />
                      {t('MARKED FOR QUARANTINE', 'محدد للمحجر')}
                    </span>
                  )}
                </div>

                <div className="mt-1 font-mono text-[11px] text-[var(--knoux-subtext)] truncate" title={file.path}>
                  {file.path}
                </div>

                {file.keeperReason && (
                  <p className="mt-1 text-[11px] text-emerald-400/90 italic">
                    {file.keeperReason}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 text-end sm:text-right shrink-0">
              <div>
                <div className="font-mono font-bold text-[var(--knoux-text)]">{formatBytes(file.sizeBytes)}</div>
                <div className="text-[10px] text-[var(--knoux-subtext)]">
                  {new Date(file.modifiedTime).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
