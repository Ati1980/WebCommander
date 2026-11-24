import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  Trash2,
} from 'lucide-react';
import { ColorTag, FileEntry } from '../types/files';
import { COLOR_TAG_META, getExtension } from '../utils/format';

interface FileIconProps {
  entry: Pick<FileEntry, 'name' | 'kind'>;
  size?: 'sm' | 'md' | 'lg';
  tag?: ColorTag;
}

export function FileIcon({ entry, size = 'sm', tag = 'none' }: FileIconProps) {
  const dim = size === 'lg' ? 'w-9 h-9' : size === 'md' ? 'w-5 h-5' : 'w-4 h-4';

  const renderIcon = () => {
    if (entry.kind === 'directory') {
      if (entry.name === '.Trash') {
        return <Trash2 className={`${dim} text-slate-400 shrink-0`} />;
      }
      return <Folder className={`${dim} text-amber-400 fill-amber-400/20 shrink-0`} />;
    }

    const ext = getExtension(entry.name);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
      return <FileImage className={`${dim} text-purple-500 dark:text-purple-400 shrink-0`} />;
    }
    if (['js', 'mjs', 'jsx', 'ts', 'tsx', 'html', 'htm', 'css', 'scss', 'json', 'py', 'java', 'cpp', 'rs', 'go', 'sql', 'sh', 'yaml', 'yml'].includes(ext)) {
      return <FileCode2 className={`${dim} text-sky-500 dark:text-sky-400 shrink-0`} />;
    }
    if (['csv', 'tsv', 'xlsx', 'xls'].includes(ext)) {
      return <FileSpreadsheet className={`${dim} text-emerald-500 dark:text-emerald-400 shrink-0`} />;
    }
    if (['md', 'markdown', 'txt', 'log', 'pdf', 'doc', 'docx'].includes(ext)) {
      return <FileText className={`${dim} text-teal-600 dark:text-teal-400 shrink-0`} />;
    }
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return <FileArchive className={`${dim} text-rose-500 dark:text-rose-400 shrink-0`} />;
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
      return <FileAudio className={`${dim} text-pink-500 dark:text-pink-400 shrink-0`} />;
    }
    if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)) {
      return <FileVideo className={`${dim} text-indigo-500 dark:text-indigo-400 shrink-0`} />;
    }
    return <File className={`${dim} text-slate-400 shrink-0`} />;
  };

  return (
    <span className="relative inline-flex items-center justify-center shrink-0">
      {renderIcon()}
      {tag !== 'none' && (
        <span
          title={COLOR_TAG_META[tag].labelTh}
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-1 ring-white dark:ring-[#161920] ${COLOR_TAG_META[tag].dotClass}`}
        />
      )}
    </span>
  );
}
