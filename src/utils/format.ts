import { BatchRenameRule, ColorTag, FileEntry } from '../types/files';

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1))} ${sizes[i]}`;
}

export function formatDate(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts);
  const date = d.toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
  const time = d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${date} ${time}`;
}

export function guessMimeType(filename: string): string {
  const ext = getExtension(filename);
  const map: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    markdown: 'text/markdown',
    json: 'application/json',
    js: 'text/javascript',
    mjs: 'text/javascript',
    jsx: 'text/javascript',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    html: 'text/html',
    htm: 'text/html',
    css: 'text/css',
    scss: 'text/css',
    csv: 'text/csv',
    tsv: 'text/tab-separated-values',
    xml: 'application/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',
    pdf: 'application/pdf',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    py: 'text/x-python',
    sql: 'application/sql',
    sh: 'text/x-shellscript',
    log: 'text/plain',
    env: 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx <= 0) return '';
  return filename.slice(idx + 1).toLowerCase();
}

export function getFileExtensionLabel(entry: FileEntry): string {
  if (entry.kind === 'directory') return 'Folder';
  const ext = getExtension(entry.name);
  return ext ? ext.toUpperCase() : 'File';
}

export function isImageFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return entry.mimeType.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext);
}

export function isTextFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return (
    entry.mimeType.startsWith('text/') ||
    entry.mimeType === 'application/json' ||
    entry.mimeType === 'application/xml' ||
    [
      'txt', 'md', 'markdown', 'json', 'js', 'mjs', 'jsx', 'ts', 'tsx',
      'html', 'htm', 'css', 'scss', 'csv', 'tsv', 'xml', 'yaml', 'yml',
      'py', 'java', 'c', 'cpp', 'h', 'rs', 'go', 'sql', 'sh', 'log', 'env', 'ini', 'toml',
    ].includes(ext)
  );
}

export function isMarkdownFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return ext === 'md' || ext === 'markdown';
}

export function isCsvFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return ext === 'csv' || ext === 'tsv';
}

export function isAudioFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return entry.mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext);
}

export function isVideoFile(entry: FileEntry): boolean {
  const ext = getExtension(entry.name);
  return entry.mimeType.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext);
}

export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines.slice(0, 200)) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

export function matchWildcardFilter(name: string, filterQuery: string): boolean {
  const q = filterQuery.trim();
  if (!q) return true;
  if (q.includes('*') || q.includes('?')) {
    const escaped = q
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    try {
      return new RegExp(`^${escaped}$`, 'i').test(name);
    } catch {
      return name.toLowerCase().includes(q.toLowerCase());
    }
  }
  return name.toLowerCase().includes(q.toLowerCase());
}

export function applyBatchRenameRule(
  entry: FileEntry,
  index: number,
  rule: BatchRenameRule
): string {
  const isDir = entry.kind === 'directory';
  const dotIdx = isDir ? -1 : entry.name.lastIndexOf('.');
  let base = dotIdx > 0 ? entry.name.slice(0, dotIdx) : entry.name;
  let ext = dotIdx > 0 ? entry.name.slice(dotIdx + 1) : '';

  // 1. Find & Replace on base name
  if (rule.findText) {
    if (rule.useRegex) {
      try {
        const flags = rule.caseSensitive ? 'g' : 'gi';
        const re = new RegExp(rule.findText, flags);
        base = base.replace(re, rule.replaceText);
      } catch {
        // Ignore invalid regex during live typing
      }
    } else if (rule.caseSensitive) {
      base = base.split(rule.findText).join(rule.replaceText);
    } else {
      const escaped = rule.findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      base = base.replace(new RegExp(escaped, 'gi'), rule.replaceText);
    }
  }

  // 2. Counter
  const numVal = rule.counterStart + index * rule.counterStep;
  const counterStr = String(numVal).padStart(Math.max(1, rule.counterDigits), '0');

  if (rule.useCounter) {
    if (rule.counterPosition === 'replace') {
      base = counterStr;
    } else if (rule.counterPosition === 'prefix') {
      base = `${counterStr}_${base}`;
    } else {
      base = `${base}_${counterStr}`;
    }
  }

  // 3. Prefix & Suffix
  base = `${rule.prefix}${base}${rule.suffix}`;

  // 4. Case transformation
  if (rule.caseMode === 'lower') {
    base = base.toLowerCase();
  } else if (rule.caseMode === 'upper') {
    base = base.toUpperCase();
  } else if (rule.caseMode === 'title') {
    base = base.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // 5. Extension
  if (!isDir && rule.newExtension.trim()) {
    ext = rule.newExtension.trim().replace(/^\./, '');
  }

  const finalBase = base.trim() || entry.name;
  return !isDir && ext ? `${finalBase}.${ext}` : finalBase;
}

export const COLOR_TAG_META: Record<
  Exclude<ColorTag, 'none'>,
  { label: string; labelTh: string; dotClass: string; bgClass: string; textClass: string }
> = {
  red: {
    label: 'Red · Urgent',
    labelTh: 'แดง (ด่วน)',
    dotClass: 'bg-red-500',
    bgClass: 'bg-red-500/15',
    textClass: 'text-red-600 dark:text-red-400',
  },
  rose: {
    label: 'Rose · Critical',
    labelTh: 'กุหลาบ',
    dotClass: 'bg-rose-500',
    bgClass: 'bg-rose-500/15',
    textClass: 'text-rose-600 dark:text-rose-400',
  },
  pink: {
    label: 'Pink · Design',
    labelTh: 'ชมพู (ดีไซน์)',
    dotClass: 'bg-pink-500',
    bgClass: 'bg-pink-500/15',
    textClass: 'text-pink-600 dark:text-pink-400',
  },
  orange: {
    label: 'Orange · Review',
    labelTh: 'ส้ม (รอตรวจ)',
    dotClass: 'bg-orange-500',
    bgClass: 'bg-orange-500/15',
    textClass: 'text-orange-600 dark:text-orange-400',
  },
  amber: {
    label: 'Amber · Work',
    labelTh: 'อำพัน (กำลังทำ)',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/15',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  yellow: {
    label: 'Yellow · Idea',
    labelTh: 'เหลือง (ไอเดีย)',
    dotClass: 'bg-yellow-400',
    bgClass: 'bg-yellow-400/15',
    textClass: 'text-yellow-600 dark:text-yellow-400',
  },
  lime: {
    label: 'Lime · Draft',
    labelTh: 'มะนาว (ร่าง)',
    dotClass: 'bg-lime-500',
    bgClass: 'bg-lime-500/15',
    textClass: 'text-lime-600 dark:text-lime-400',
  },
  green: {
    label: 'Green · Done',
    labelTh: 'เขียว (เสร็จแล้ว)',
    dotClass: 'bg-green-500',
    bgClass: 'bg-green-500/15',
    textClass: 'text-green-600 dark:text-green-400',
  },
  emerald: {
    label: 'Emerald · Approved',
    labelTh: 'มรกต (อนุมัติ)',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/15',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  teal: {
    label: 'Teal · Docs',
    labelTh: 'เขียวน้ำทะเล',
    dotClass: 'bg-teal-500',
    bgClass: 'bg-teal-500/15',
    textClass: 'text-teal-600 dark:text-teal-400',
  },
  cyan: {
    label: 'Cyan · Code',
    labelTh: 'ฟ้าอมเขียว',
    dotClass: 'bg-cyan-500',
    bgClass: 'bg-cyan-500/15',
    textClass: 'text-cyan-600 dark:text-cyan-400',
  },
  sky: {
    label: 'Sky · Notes',
    labelTh: 'ฟ้าใส',
    dotClass: 'bg-sky-500',
    bgClass: 'bg-sky-500/15',
    textClass: 'text-sky-600 dark:text-sky-400',
  },
  blue: {
    label: 'Blue · Reference',
    labelTh: 'น้ำเงิน (อ้างอิง)',
    dotClass: 'bg-blue-500',
    bgClass: 'bg-blue-500/15',
    textClass: 'text-blue-600 dark:text-blue-400',
  },
  indigo: {
    label: 'Indigo · Project',
    labelTh: 'คราม (โปรเจกต์)',
    dotClass: 'bg-indigo-500',
    bgClass: 'bg-indigo-500/15',
    textClass: 'text-indigo-600 dark:text-indigo-400',
  },
  purple: {
    label: 'Purple · Archive',
    labelTh: 'ม่วง (คลังเก็บ)',
    dotClass: 'bg-purple-500',
    bgClass: 'bg-purple-500/15',
    textClass: 'text-purple-600 dark:text-purple-400',
  },
  fuchsia: {
    label: 'Fuchsia · Media',
    labelTh: 'บานเย็น (สื่อ)',
    dotClass: 'bg-fuchsia-500',
    bgClass: 'bg-fuchsia-500/15',
    textClass: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
};
