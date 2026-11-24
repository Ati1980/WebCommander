import React, { useEffect } from 'react';
import {
  Copy,
  Download,
  Edit3,
  Eye,
  FolderInput,
  Inbox,
  MoveRight,
  PlusSquare,
  Scissors,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ColorTag, FileEntry } from '../types/files';
import { COLOR_TAG_META } from '../utils/format';

interface ContextMenuProps {
  x: number;
  y: number;
  entry: FileEntry;
  selectedCount: number;
  onClose: () => void;
  onOpen: () => void;
  onOpenInNewTab: () => void;
  onQuickLook: () => void;
  onCopyToOther: () => void;
  onMoveToOther: () => void;
  onClipboardCopy: () => void;
  onClipboardCut: () => void;
  onRename: () => void;
  onBatchRename: () => void;
  onAddToShelf: () => void;
  onDownload: () => void;
  onSetTag: (tag: ColorTag) => void;
  onDelete: () => void;
}

export function ContextMenu({
  x,
  y,
  entry,
  selectedCount,
  onClose,
  onOpen,
  onOpenInNewTab,
  onQuickLook,
  onCopyToOther,
  onMoveToOther,
  onClipboardCopy,
  onClipboardCut,
  onRename,
  onBatchRename,
  onAddToShelf,
  onDownload,
  onSetTag,
  onDelete,
}: ContextMenuProps) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    left: Math.min(x, window.innerWidth - 240),
    top: Math.min(y, window.innerHeight - 420),
  };

  const Item = ({
    icon,
    label,
    shortcut,
    danger = false,
    onClick,
  }: {
    icon: React.ReactNode;
    label: string;
    shortcut?: string;
    danger?: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
        onClose();
      }}
      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors ${
        danger
          ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#232833]'
      }`}
    >
      <span className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
      {shortcut && (
        <span className="font-mono text-[10px] text-slate-400">{shortcut}</span>
      )}
    </button>
  );

  return (
    <div
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-50 w-56 rounded-xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl py-1.5 select-none"
    >
      {entry.kind === 'directory' ? (
        <>
          <Item icon={<FolderInput className="w-3.5 h-3.5" />} label="เปิดโฟลเดอร์" shortcut="Enter" onClick={onOpen} />
          <Item icon={<PlusSquare className="w-3.5 h-3.5" />} label="เปิดในแท็บใหม่" onClick={onOpenInNewTab} />
        </>
      ) : (
        <Item icon={<Eye className="w-3.5 h-3.5" />} label="Quick Look" shortcut="Space" onClick={onQuickLook} />
      )}

      <div className="my-1 border-t border-slate-100 dark:border-[#262b35]" />

      <Item icon={<Copy className="w-3.5 h-3.5 text-blue-500" />} label="คัดลอกไปอีกฝั่ง" shortcut="F5" onClick={onCopyToOther} />
      <Item icon={<MoveRight className="w-3.5 h-3.5 text-amber-500" />} label="ย้ายไปอีกฝั่ง" shortcut="F6" onClick={onMoveToOther} />
      <Item icon={<Inbox className="w-3.5 h-3.5 text-indigo-500" />} label="เพิ่มเข้า Drop Shelf" onClick={onAddToShelf} />

      <div className="my-1 border-t border-slate-100 dark:border-[#262b35]" />

      <Item icon={<Copy className="w-3.5 h-3.5" />} label="Copy (คลิปบอร์ด)" shortcut="Ctrl+C" onClick={onClipboardCopy} />
      <Item icon={<Scissors className="w-3.5 h-3.5" />} label="Cut (คลิปบอร์ด)" shortcut="Ctrl+X" onClick={onClipboardCut} />

      <div className="my-1 border-t border-slate-100 dark:border-[#262b35]" />

      {selectedCount <= 1 && (
        <Item icon={<Edit3 className="w-3.5 h-3.5" />} label="เปลี่ยนชื่อ" shortcut="F2" onClick={onRename} />
      )}
      <Item icon={<Sparkles className="w-3.5 h-3.5" />} label="เปลี่ยนชื่อหลายไฟล์..." shortcut="Ctrl+M" onClick={onBatchRename} />
      <Item icon={<Download className="w-3.5 h-3.5" />} label={selectedCount > 1 || entry.kind === 'directory' ? 'ดาวน์โหลด (.ZIP)' : 'ดาวน์โหลด'} onClick={onDownload} />

      <div className="my-1 border-t border-slate-100 dark:border-[#262b35]" />

      <div className="px-3 py-1.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400">ป้ายสี (16 สี)</span>
          <button
            onClick={() => {
              onSetTag('none');
              onClose();
            }}
            className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-white px-1"
          >
            ล้างสี
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).map((t) => (
            <button
              key={t}
              title={COLOR_TAG_META[t].labelTh}
              onClick={() => {
                onSetTag(t);
                onClose();
              }}
              className={`w-3.5 h-3.5 rounded-full ${COLOR_TAG_META[t].dotClass} hover:scale-125 transition-transform`}
            />
          ))}
        </div>
      </div>

      <div className="my-1 border-t border-slate-100 dark:border-[#262b35]" />
      <Item icon={<Trash2 className="w-3.5 h-3.5" />} label="ลบรายการที่เลือก" shortcut="Del" danger onClick={onDelete} />
    </div>
  );
}
