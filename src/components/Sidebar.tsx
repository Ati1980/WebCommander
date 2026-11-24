import React, { useState } from 'react';
import {
  Bookmark,
  ChevronRight,
  Copy,
  FolderOpen,
  HardDrive,
  Inbox,
  MoveRight,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ColorTag, FavoriteItem, ShelfItem } from '../types/files';
import { COLOR_TAG_META } from '../utils/format';
import { FileIcon } from './FileIcon';

interface SidebarProps {
  visible: boolean;
  width: number;
  favorites: FavoriteItem[];
  shelf: ShelfItem[];
  activeTagFilter: ColorTag;
  tagCounts: Record<Exclude<ColorTag, 'none'>, number>;
  onToggleCollapse: () => void;
  onOpenVirtualRoot: () => void;
  onOpenTrash: () => void;
  onMountLocal: () => void;
  onOpenFavorite: (fav: FavoriteItem) => void;
  onRemoveFavorite: (id: string) => void;
  onSelectTagFilter: (tag: ColorTag) => void;
  onShelfCopyHere: () => void;
  onShelfMoveHere: () => void;
  onRemoveShelfItem: (id: string) => void;
  onClearShelf: () => void;
  onDropToShelf: () => void;
  onResetSandbox: () => void;
}

export function Sidebar({
  visible,
  width,
  favorites,
  shelf,
  activeTagFilter,
  tagCounts,
  onToggleCollapse,
  onOpenVirtualRoot,
  onOpenTrash,
  onMountLocal,
  onOpenFavorite,
  onRemoveFavorite,
  onSelectTagFilter,
  onShelfCopyHere,
  onShelfMoveHere,
  onRemoveShelfItem,
  onClearShelf,
  onDropToShelf,
  onResetSandbox,
}: SidebarProps) {
  const [shelfDragOver, setShelfDragOver] = useState(false);

  const handleShelfDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setShelfDragOver(true);
  };

  const handleShelfDragLeave = () => {
    setShelfDragOver(false);
  };

  const handleShelfDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setShelfDragOver(false);
    onDropToShelf();
  };

  if (!visible) {
    return (
      <aside className="w-11 shrink-0 bg-slate-100/90 dark:bg-[#14171d] border-r border-slate-200 dark:border-[#262b35] flex flex-col items-center py-2 gap-2 select-none">
        <button
          onClick={onToggleCollapse}
          title="กางแผงด้านซ้าย (Ctrl+B)"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/80 dark:hover:bg-[#1f242d] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-200 dark:bg-[#262b35]" />

        <button
          onClick={onOpenVirtualRoot}
          title="VirtualDrive (V:)"
          className="p-2 rounded-lg text-blue-500 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] transition-colors"
        >
          <HardDrive className="w-4 h-4" />
        </button>

        <button
          onClick={onMountLocal}
          title="Open PC Folder..."
          className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenTrash}
          title="ถังขยะ (V:/.Trash)"
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleCollapse}
          onDragOver={handleShelfDragOver}
          onDragLeave={handleShelfDragLeave}
          onDrop={handleShelfDrop}
          title={`Drop Shelf (${shelf.length} รายการ)`}
          className={`relative p-2 rounded-lg transition-colors ${
            shelfDragOver
              ? 'bg-blue-500/20 text-blue-500'
              : 'text-indigo-500 hover:bg-slate-200/70 dark:hover:bg-[#1f242d]'
          }`}
        >
          <Inbox className="w-4 h-4" />
          {shelf.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-blue-600 text-white text-[9px] font-mono font-bold flex items-center justify-center tabular-nums">
              {shelf.length}
            </span>
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="shrink-0 bg-slate-100/80 dark:bg-[#14171d] border-r border-slate-200 dark:border-[#262b35] flex flex-col min-h-0 overflow-hidden select-none"
    >
      {/* Sidebar Header with Collapse button */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-[#262b35] flex items-center justify-between shrink-0">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
          แถบนำทาง
        </span>
        <button
          onClick={onToggleCollapse}
          title="พับแผงด้านซ้าย (Ctrl+B)"
          className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-[#1f242d] hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* DRIVES & SOURCES */}
        <div>
          <div className="px-2 mb-1.5 text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
            ไดรฟ์และแหล่งข้อมูล
          </div>
          <div className="space-y-0.5">
            <button
              onClick={onOpenVirtualRoot}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] transition-colors text-left"
            >
              <HardDrive className="w-4 h-4 text-blue-500 shrink-0" />
              <span className="truncate flex-1">VirtualDrive (V:)</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            <button
              onClick={onMountLocal}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left"
            >
              <FolderOpen className="w-4 h-4 shrink-0" />
              <span className="truncate flex-1">Open PC Folder...</span>
            </button>

            <button
              onClick={onOpenTrash}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] transition-colors text-left"
            >
              <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="truncate flex-1">ถังขยะ (V:/.Trash)</span>
            </button>
          </div>
        </div>

        {/* FAVORITES */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              โฟลเดอร์โปรด (Favorites)
            </span>
          </div>
          {favorites.length === 0 ? (
            <p className="px-2 text-[11px] text-slate-400 dark:text-slate-500">
              กดไอคอนดาวบนแถบที่อยู่เพื่อปักหมุด
            </p>
          ) : (
            <div className="space-y-0.5">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className="group flex items-center gap-1 rounded-lg hover:bg-slate-200/70 dark:hover:bg-[#1f242d] pr-1 transition-colors"
                >
                  <button
                    onClick={() => onOpenFavorite(fav)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 text-left min-w-0"
                  >
                    <Bookmark className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="truncate">{fav.name}</span>
                  </button>
                  <button
                    onClick={() => onRemoveFavorite(fav.id)}
                    title="เอาออกจากโฟลเดอร์โปรด"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLOR TAGS */}
        <div>
          <div className="px-2 mb-1.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              ป้ายสี (16 สี)
            </span>
            {activeTagFilter !== 'none' && (
              <button
                onClick={() => onSelectTagFilter('none')}
                className="text-[10px] text-blue-500 hover:underline"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1">
            {(Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).map((tagKey) => {
              const meta = COLOR_TAG_META[tagKey];
              const isSelected = activeTagFilter === tagKey;
              return (
                <button
                  key={tagKey}
                  onClick={() => onSelectTagFilter(isSelected ? 'none' : tagKey)}
                  title={meta.labelTh}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors min-w-0 ${
                    isSelected
                      ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#1f242d]'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dotClass}`} />
                  <span className="flex-1 text-left truncate">{meta.labelTh.split(' ')[0]}</span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                    {tagCounts[tagKey] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* DROP SHELF (FILE CART) */}
        <div
          onDragOver={handleShelfDragOver}
          onDragLeave={handleShelfDragLeave}
          onDrop={handleShelfDrop}
          className={`rounded-xl border p-2.5 transition-colors ${
            shelfDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-200 dark:border-[#262b35] bg-white/70 dark:bg-[#191d25]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
              <Inbox className="w-3.5 h-3.5 text-indigo-500" />
              <span>Drop Shelf</span>
              <span className="font-mono text-[10px] text-slate-400">({shelf.length})</span>
            </div>
            {shelf.length > 0 && (
              <button
                onClick={onClearShelf}
                className="text-[10px] text-slate-400 hover:text-rose-500"
                title="ล้าง Shelf"
              >
                ล้าง
              </button>
            )}
          </div>

          {shelf.length === 0 ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
              ลากไฟล์มาพักไว้ที่นี่เพื่อย้ายหรือคัดลอกจากหลายโฟลเดอร์พร้อมกัน
            </p>
          ) : (
            <>
              <div className="max-h-32 overflow-y-auto space-y-1 mb-2.5">
                {shelf.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-100 dark:bg-[#12151b] text-[11px]"
                  >
                    <FileIcon entry={item.entry} size="sm" />
                    <span className="truncate flex-1 text-slate-700 dark:text-slate-200">
                      {item.entry.name}
                    </span>
                    <button
                      onClick={() => onRemoveShelfItem(item.id)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={onShelfCopyHere}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy มา</span>
                </button>
                <button
                  onClick={onShelfMoveHere}
                  className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors"
                >
                  <MoveRight className="w-3 h-3" />
                  <span>Move มา</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom Sandbox Reset */}
      <div className="p-2.5 border-t border-slate-200 dark:border-[#262b35] flex items-center justify-between">
        <button
          onClick={onResetSandbox}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          title="รีเซ็ตข้อมูลตัวอย่างใน Virtual Drive (V:)"
        >
          <RotateCcw className="w-3 h-3" />
          <span>รีเซ็ต V: Drive</span>
        </button>
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <Tag className="w-3 h-3" />
          VFS Local
        </span>
      </div>
    </aside>
  );
}
