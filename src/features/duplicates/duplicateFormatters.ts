/**
 * KNOUX ONE — Module 03 Formatters and Utilities
 */

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatShortPath(fullPath: string, maxLength: number = 45): string {
  if (fullPath.length <= maxLength) return fullPath;
  const parts = fullPath.split(/[/\\]/);
  if (parts.length <= 2) return fullPath;
  const fileName = parts[parts.length - 1];
  const drive = parts[0];
  return `${drive}\\...\\${fileName}`;
}

export function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'images':
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    case 'videos':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'audio':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'documents':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    case 'archives':
      return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    default:
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
  }
}
