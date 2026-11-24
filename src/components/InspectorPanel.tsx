import React, { useEffect, useState } from 'react';
import {
  Calculator,
  Copy,
  Download,
  Edit3,
  Eye,
  Maximize2,
  MoveRight,
  Save,
  X,
} from 'lucide-react';
import { calculateFolderStats } from '../fs/localFs';
import { ColorTag, FileAdapter, FileEntry } from '../types/files';
import {
  COLOR_TAG_META,
  formatBytes,
  formatDate,
  getFileExtensionLabel,
  isAudioFile,
  isCsvFile,
  isImageFile,
  isMarkdownFile,
  isTextFile,
  isVideoFile,
  parseCsv,
} from '../utils/format';
import { FileIcon } from './FileIcon';

interface InspectorPanelProps {
  visible: boolean;
  adapter: FileAdapter;
  entries: FileEntry[];
  selectedEntries: FileEntry[];
  tags: Record<string, ColorTag>;
  onClose: () => void;
  onSetTag: (entries: FileEntry[], tag: ColorTag) => void;
  onCopyToOther: () => void;
  onMoveToOther: () => void;
  onDownloadSelected: () => void;
  onOpenQuickLook: () => void;
  onSaveTextEdit: (entry: FileEntry, newContent: string) => Promise<void>;
}

function renderSimpleMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  return (
    <div className="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return (
            <h4 key={i} className="text-xs font-bold text-slate-900 dark:text-white pt-1">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="text-sm font-bold text-slate-900 dark:text-white pt-2 border-b border-slate-200 dark:border-[#262b35] pb-1">
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={i} className="text-base font-bold text-slate-900 dark:text-white">
              {line.slice(2)}
            </h2>
          );
        }
        if (line.startsWith('> ')) {
          return (
            <blockquote
              key={i}
              className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 text-xs"
            >
              {line.slice(2)}
            </blockquote>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>{line.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          return (
            <div key={i} className="pl-2 text-slate-700 dark:text-slate-200">
              {line.replace(/\*\*(.*?)\*\*/g, '$1')}
            </div>
          );
        }
        if (!line.trim()) return <div key={i} className="h-1" />;
        return <p key={i}>{line.replace(/\*\*(.*?)\*\*/g, '$1')}</p>;
      })}
    </div>
  );
}

export function InspectorPanel({
  visible,
  adapter,
  entries,
  selectedEntries,
  tags,
  onClose,
  onSetTag,
  onCopyToOther,
  onMoveToOther,
  onDownloadSelected,
  onOpenQuickLook,
  onSaveTextEdit,
}: InspectorPanelProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [mdRendered, setMdRendered] = useState(true);
  const [folderStats, setFolderStats] = useState<{
    files: number;
    folders: number;
    totalSize: number;
  } | null>(null);
  const [calculatingStats, setCalculatingStats] = useState(false);

  const singleItem = selectedEntries.length === 1 ? selectedEntries[0] : null;

  useEffect(() => {
    setEditMode(false);
    setFolderStats(null);
    setTextContent('');

    let active = true;
    let createdUrl: string | null = null;

    if (!singleItem || singleItem.kind === 'directory') {
      setObjectUrl(null);
      return;
    }

    const loadPreview = async () => {
      try {
        const blob = await adapter.readFileBlob(singleItem);
        if (!active) return;

        if (isImageFile(singleItem) || isAudioFile(singleItem) || isVideoFile(singleItem)) {
          createdUrl = URL.createObjectURL(blob);
          setObjectUrl(createdUrl);
        } else {
          setObjectUrl(null);
        }

        if (isTextFile(singleItem)) {
          const text = await blob.slice(0, 64000).text();
          if (active) {
            setTextContent(text);
            setEditDraft(text);
          }
        }
      } catch {
        if (active) {
          setObjectUrl(null);
          setTextContent('');
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [adapter, singleItem]);

  if (!visible) return null;

  const handleCalculateFolder = async () => {
    if (!singleItem || singleItem.kind !== 'directory') return;
    setCalculatingStats(true);
    try {
      const stats = await calculateFolderStats(adapter, singleItem.name);
      setFolderStats(stats);
    } finally {
      setCalculatingStats(false);
    }
  };

  const handleSave = async () => {
    if (!singleItem) return;
    setSavingEdit(true);
    try {
      await onSaveTextEdit(singleItem, editDraft);
      setTextContent(editDraft);
      setEditMode(false);
    } finally {
      setSavingEdit(false);
    }
  };

  const currentFolderName = adapter.getBreadcrumbs().slice(-1)[0]?.name || 'Root';
  const dirCount = entries.filter((e) => e.kind === 'directory').length;
  const fileCount = entries.filter((e) => e.kind === 'file').length;

  return (
    <aside className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-[#262b35] bg-slate-50 dark:bg-[#14171d] flex flex-col shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-200 dark:border-[#262b35] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-blue-500" />
          <h2 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            ตัวอย่างและข้อมูลไฟล์
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {singleItem && (
            <button
              onClick={onOpenQuickLook}
              title="ขยายเต็มจอ (Space)"
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="ปิดแผงตัวอย่าง"
            className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedEntries.length === 0 ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <FileIcon entry={{ name: currentFolderName, kind: 'directory' }} size="lg" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white break-all">
                {currentFolderName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                {dirCount} โฟลเดอร์ · {fileCount} ไฟล์
              </p>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pt-2 border-t border-slate-200 dark:border-[#262b35]">
              เลือกไฟล์เพื่อดูตัวอย่าง รูปภาพ ตาราง CSV ข้อความ หรือแก้ไขโค้ดได้ทันที
            </p>
          </div>
        ) : selectedEntries.length > 1 ? (
          <div className="space-y-4">
            <div className="py-6 text-center space-y-2">
              <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
                {selectedEntries.length}
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                รายการที่เลือกอยู่
              </div>
              <div className="text-xs text-slate-500 font-mono tabular-nums">
                ขนาดรวม {formatBytes(selectedEntries.reduce((s, e) => s + e.size, 0))}
              </div>
            </div>

            {/* Tag multiple */}
            <div className="pt-3 border-t border-slate-200 dark:border-[#262b35]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                ติดป้ายสีทั้งหมดที่เลือก
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSetTag(selectedEntries, 'none')}
                  className="px-2 py-1 rounded text-[11px] border border-slate-300 dark:border-[#2a303c] text-slate-500 hover:text-slate-800 dark:hover:text-white"
                >
                  ไม่มี
                </button>
                {(Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => onSetTag(selectedEntries, t)}
                    title={COLOR_TAG_META[t].labelTh}
                    className={`w-5 h-5 rounded-full ${COLOR_TAG_META[t].dotClass} hover:scale-110 transition-transform`}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onCopyToOther}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copy (F5)</span>
              </button>
              <button
                onClick={onMoveToOther}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
              >
                <MoveRight className="w-3.5 h-3.5" />
                <span>Move (F6)</span>
              </button>
            </div>
            <button
              onClick={onDownloadSelected}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 dark:border-[#2c3240] text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1f242d] text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ดาวน์โหลดเป็นไฟล์ .ZIP</span>
            </button>
          </div>
        ) : (
          singleItem && (
            <>
              {/* PREVIEW AREA */}
              {singleItem.kind === 'directory' ? (
                <div className="py-6 rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#181c24] flex flex-col items-center justify-center gap-2">
                  <FileIcon entry={singleItem} size="lg" tag={tags[singleItem.pathKey] || 'none'} />
                  <span className="text-xs text-slate-500">Folder / Directory</span>
                  {folderStats ? (
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      {folderStats.folders} โฟลเดอร์ · {folderStats.files} ไฟล์ ·{' '}
                      {formatBytes(folderStats.totalSize)}
                    </div>
                  ) : (
                    <button
                      onClick={handleCalculateFolder}
                      disabled={calculatingStats}
                      className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Calculator className="w-3 h-3" />
                      <span>{calculatingStats ? 'กำลังคำนวณ...' : 'คำนวณขนาดโฟลเดอร์'}</span>
                    </button>
                  )}
                </div>
              ) : isImageFile(singleItem) && objectUrl ? (
                <div className="rounded-xl border border-slate-200 dark:border-[#262b35] bg-slate-900/5 dark:bg-black/30 p-2 flex items-center justify-center">
                  <img
                    src={objectUrl}
                    alt={singleItem.name}
                    referrerPolicy="no-referrer"
                    className="max-h-56 w-auto object-contain rounded-lg"
                  />
                </div>
              ) : isAudioFile(singleItem) && objectUrl ? (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#181c24]">
                  <audio controls src={objectUrl} className="w-full" />
                </div>
              ) : isVideoFile(singleItem) && objectUrl ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-[#262b35] bg-black">
                  <video controls src={objectUrl} className="w-full max-h-56" />
                </div>
              ) : isTextFile(singleItem) ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {isMarkdownFile(singleItem) && !editMode && (
                        <button
                          onClick={() => setMdRendered(!mdRendered)}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200/70 dark:bg-[#222731] text-slate-700 dark:text-slate-200"
                        >
                          {mdRendered ? 'ดู Raw Code' : 'ดู Markdown'}
                        </button>
                      )}
                    </div>
                    {editMode ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditMode(false)}
                          className="px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        >
                          ยกเลิก
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={savingEdit}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium"
                        >
                          <Save className="w-3 h-3" />
                          <span>{savingEdit ? 'กำลังบันทึก...' : 'บันทึก'}</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditDraft(textContent);
                          setEditMode(true);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>แก้ไขไฟล์</span>
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={12}
                      className="w-full rounded-xl border border-blue-500 bg-white dark:bg-[#0f1217] text-slate-900 dark:text-slate-100 p-3 font-mono text-[11px] leading-relaxed focus:outline-none"
                    />
                  ) : isCsvFile(singleItem) ? (
                    <div className="rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#161920] overflow-auto max-h-60">
                      <table className="w-full text-[11px] border-collapse">
                        <tbody>
                          {parseCsv(textContent, singleItem.name.endsWith('.tsv') ? '\t' : ',').map(
                            (row, rIdx) => (
                              <tr
                                key={rIdx}
                                className={
                                  rIdx === 0
                                    ? 'bg-slate-100 dark:bg-[#1f242d] font-semibold'
                                    : 'border-t border-slate-100 dark:border-[#222731]'
                                }
                              >
                                {row.map((cell, cIdx) => (
                                  <td key={cIdx} className="px-2 py-1 whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : isMarkdownFile(singleItem) && mdRendered ? (
                    <div className="rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#161920] p-3 max-h-60 overflow-y-auto">
                      {renderSimpleMarkdown(textContent)}
                    </div>
                  ) : (
                    <pre className="rounded-xl border border-slate-200 dark:border-[#262b35] bg-slate-900 text-slate-200 p-3 font-mono text-[11px] max-h-60 overflow-auto whitespace-pre-wrap leading-relaxed">
                      {textContent || '(ไฟล์ว่าง)'}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="h-28 rounded-xl border border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#181c24] flex flex-col items-center justify-center gap-2 text-slate-400">
                  <FileIcon entry={singleItem} size="lg" />
                  <span className="text-[11px]">ไม่รองรับตัวอย่างไฟล์ประเภทนี้</span>
                </div>
              )}

              {/* FILE NAME & METADATA */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white break-all">
                  {singleItem.name}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>{getFileExtensionLabel(singleItem)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {singleItem.kind === 'directory' ? 'Folder' : formatBytes(singleItem.size)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{formatDate(singleItem.lastModified)}</span>
                </div>
              </div>

              {/* COLOR TAG PICKER */}
              <div className="pt-3 border-t border-slate-200 dark:border-[#262b35]">
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  ป้ายสี (Color Tag)
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onSetTag([singleItem], 'none')}
                    className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                      (tags[singleItem.pathKey] || 'none') === 'none'
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'border-slate-300 dark:border-[#2a303c] text-slate-500'
                    }`}
                  >
                    ไม่มี
                  </button>
                  {(Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).map((t) => {
                    const active = tags[singleItem.pathKey] === t;
                    return (
                      <button
                        key={t}
                        onClick={() => onSetTag([singleItem], t)}
                        title={COLOR_TAG_META[t].labelTh}
                        className={`w-5 h-5 rounded-full ${COLOR_TAG_META[t].dotClass} transition-transform ${
                          active ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-[#14171d] scale-110' : 'hover:scale-110'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* QUICK ACTIONS */}
              <div className="pt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onCopyToOther}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy (F5)</span>
                  </button>
                  <button
                    onClick={onMoveToOther}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                    <span>Move (F6)</span>
                  </button>
                </div>
                <button
                  onClick={onDownloadSelected}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-slate-300 dark:border-[#2c3240] text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1f242d] text-xs font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {singleItem.kind === 'directory' ? 'ส่งออกโฟลเดอร์ (.ZIP)' : 'ดาวน์โหลดไฟล์'}
                  </span>
                </button>
              </div>
            </>
          )
        )}
      </div>
    </aside>
  );
}
