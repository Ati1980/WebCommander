import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { FileAdapter, FileEntry } from '../types/files';
import {
  formatBytes,
  formatDate,
  isAudioFile,
  isCsvFile,
  isImageFile,
  isTextFile,
  isVideoFile,
  parseCsv,
} from '../utils/format';
import { FileIcon } from './FileIcon';

interface QuickLookModalProps {
  adapter: FileAdapter;
  entries: FileEntry[];
  currentIndex: number;
  onChangeIndex: (idx: number) => void;
  onDownload: (entry: FileEntry) => void;
  onClose: () => void;
}

export function QuickLookModal({
  adapter,
  entries,
  currentIndex,
  onChangeIndex,
  onDownload,
  onClose,
}: QuickLookModalProps) {
  const entry = entries[currentIndex];
  const [url, setUrl] = useState<string | null>(null);
  const [text, setText] = useState<string>('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onChangeIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < entries.length - 1) {
        onChangeIndex(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, entries.length, onChangeIndex, onClose]);

  useEffect(() => {
    if (!entry || entry.kind === 'directory') {
      setUrl(null);
      setText('');
      return;
    }
    let active = true;
    let objUrl: string | null = null;

    adapter
      .readFileBlob(entry)
      .then(async (blob) => {
        if (!active) return;
        if (isImageFile(entry) || isAudioFile(entry) || isVideoFile(entry)) {
          objUrl = URL.createObjectURL(blob);
          setUrl(objUrl);
        } else {
          setUrl(null);
        }
        if (isTextFile(entry)) {
          const content = await blob.slice(0, 128000).text();
          if (active) setText(content);
        } else {
          setText('');
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [adapter, entry]);

  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#161920] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Top Bar */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-[#262b35] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileIcon entry={entry} size="md" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {entry.name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                {entry.kind === 'directory' ? 'Folder' : formatBytes(entry.size)} ·{' '}
                {formatDate(entry.lastModified)} · {currentIndex + 1}/{entries.length}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onChangeIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#262b35] disabled:opacity-30 text-slate-600 dark:text-slate-300"
              title="ก่อนหน้า (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onChangeIndex(Math.min(entries.length - 1, currentIndex + 1))}
              disabled={currentIndex >= entries.length - 1}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-[#262b35] disabled:opacity-30 text-slate-600 dark:text-slate-300"
              title="ถัดไป (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {entry.kind === 'file' && (
              <button
                onClick={() => onDownload(entry)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ดาวน์โหลด</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 bg-slate-50 dark:bg-[#11141a] flex items-center justify-center">
          {entry.kind === 'directory' ? (
            <div className="text-center space-y-2 py-12">
              <FileIcon entry={entry} size="lg" />
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                โฟลเดอร์: {entry.name}
              </div>
              <p className="text-xs text-slate-500">ดับเบิลคลิกที่โฟลเดอร์เพื่อเข้าไปดูรายการด้านใน</p>
            </div>
          ) : isImageFile(entry) && url ? (
            <img
              src={url}
              alt={entry.name}
              referrerPolicy="no-referrer"
              className="max-h-[68vh] w-auto object-contain rounded-xl shadow-lg"
            />
          ) : isVideoFile(entry) && url ? (
            <video controls autoPlay src={url} className="max-h-[68vh] w-full rounded-xl" />
          ) : isAudioFile(entry) && url ? (
            <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-[#161920] border border-slate-200 dark:border-[#262b35]">
              <audio controls autoPlay src={url} className="w-full" />
            </div>
          ) : isCsvFile(entry) && text ? (
            <div className="w-full self-start rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#161920] overflow-auto max-h-[68vh]">
              <table className="w-full text-xs border-collapse">
                <tbody>
                  {parseCsv(text, entry.name.endsWith('.tsv') ? '\t' : ',').map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx === 0
                          ? 'bg-slate-100 dark:bg-[#1f242d] font-semibold'
                          : 'border-t border-slate-100 dark:border-[#222731]'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-1.5 whitespace-nowrap">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : isTextFile(entry) ? (
            <pre className="w-full self-start rounded-xl border border-slate-200 dark:border-[#262b35] bg-slate-900 text-slate-100 p-4 font-mono text-xs leading-relaxed overflow-auto max-h-[68vh] whitespace-pre-wrap">
              {text || '(ไฟล์ว่าง)'}
            </pre>
          ) : (
            <div className="text-center space-y-2 py-12 text-slate-400">
              <FileIcon entry={entry} size="lg" />
              <div className="text-xs">ไม่มีตัวอย่างสำหรับไฟล์ {entry.name}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
