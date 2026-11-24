import React, { useState } from 'react';
import {
  ArrowDown,
  ChevronDown,
  ChevronRight,
  Cloud,
  Copy,
  FileText,
  Film,
  Folder,
  FolderOpen,
  HardDrive,
  Home,
  Image as ImageIcon,
  Inbox,
  Monitor,
  MoveRight,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Pin,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { DriveSlotKey } from '../fs/driveHandlesDb';
import { LocalFSAdapter } from '../fs/localFs';
import { VirtualNode } from '../fs/virtualFs';
import { ColorTag, FavoriteItem, FileEntry, ShelfItem } from '../types/files';
import { COLOR_TAG_META } from '../utils/format';
import { FileIcon } from './FileIcon';

export interface DriveSlotState {
  adapter: LocalFSAdapter | null;
  hasSavedHandle: boolean;
}

interface SidebarProps {
  visible: boolean;
  width: number;
  currentPathString: string;
  virtualRoot: VirtualNode;
  driveSlots: Record<DriveSlotKey, DriveSlotState>;
  mountedLocals: LocalFSAdapter[];
  favorites: FavoriteItem[];
  shelf: ShelfItem[];
  activeTagFilter: ColorTag;
  tagCounts: Record<Exclude<ColorTag, 'none'>, number>;
  onToggleCollapse: () => void;
  onOpenVirtualPath: (path: string[]) => void;
  onOpenDriveSlot: (slot: DriveSlotKey) => void;
  onUnlinkDriveSlot: (slot: DriveSlotKey) => void;
  onOpenLocalAdapter: (adapter: LocalFSAdapter) => void;
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

const QUICK_ACCESS_ITEMS: Array<{
  name: string;
  path: string[];
  icon: React.ReactNode;
}> = [
  {
    name: 'Desktop',
    path: ['Desktop'],
    icon: <Monitor className="w-4 h-4 text-sky-500 fill-sky-500/20 shrink-0" />,
  },
  {
    name: 'Documents',
    path: ['Documents'],
    icon: <FileText className="w-4 h-4 text-slate-500 dark:text-slate-300 fill-slate-400/20 shrink-0" />,
  },
  {
    name: 'Downloads',
    path: ['Downloads'],
    icon: <ArrowDown className="w-4 h-4 text-emerald-500 stroke-[2.5] shrink-0" />,
  },
  {
    name: 'Pictures',
    path: ['Pictures'],
    icon: <ImageIcon className="w-4 h-4 text-blue-500 fill-blue-500/15 shrink-0" />,
  },
  {
    name: 'Music',
    path: ['Music'],
    icon: <Music className="w-4 h-4 text-orange-500 shrink-0" />,
  },
  {
    name: 'Videos',
    path: ['Videos'],
    icon: <Film className="w-4 h-4 text-purple-500 fill-purple-500/15 shrink-0" />,
  },
];

export function Sidebar({
  visible,
  width,
  currentPathString,
  virtualRoot,
  driveSlots,
  mountedLocals,
  favorites,
  shelf,
  activeTagFilter,
  tagCounts,
  onToggleCollapse,
  onOpenVirtualPath,
  onOpenDriveSlot,
  onUnlinkDriveSlot,
  onOpenLocalAdapter,
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
  const [driveSubdirs, setDriveSubdirs] = useState<Partial<Record<DriveSlotKey, FileEntry[]>>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({
    'this-pc': true,
    'cloud-v': false,
    'tags-section': false,
    'shelf-section': false,
  });

  const toggleExpand = (key: string) => {
    setExpandedNodes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleDriveSlotExpand = async (slot: DriveSlotKey) => {
    const key = `drive-${slot}`;
    const nextOpen = !expandedNodes[key];
    setExpandedNodes((prev) => ({ ...prev, [key]: nextOpen }));
    const adapter = driveSlots[slot].adapter;
    if (nextOpen && adapter) {
      try {
        const entries = await adapter.listEntries();
        setDriveSubdirs((prev) => ({
          ...prev,
          [slot]: entries
            .filter((e) => e.kind === 'directory')
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      } catch {
        // ignore if permission not granted yet
      }
    }
  };

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

  const renderVirtualSubtree = (node: VirtualNode, path: string[], depth: number) => {
    const dirs = Object.values(node.children || {})
      .filter((c) => c.kind === 'directory' && c.name !== '.Trash')
      .sort((a, b) => a.name.localeCompare(b.name));

    if (dirs.length === 0) return null;

    return (
      <div className="space-y-0.5">
        {dirs.map((dir) => {
          const nextPath = [...path, dir.name];
          const nodeKey = `v:${nextPath.join('/')}`;
          const isExp = Boolean(expandedNodes[nodeKey]);
          const hasSubdirs = Object.values(dir.children || {}).some(
            (c) => c.kind === 'directory'
          );
          const isCurrent = currentPathString === `V:/${nextPath.join('/')}`;

          return (
            <div key={nodeKey}>
              <div
                style={{ paddingLeft: `${depth * 14 + 6}px` }}
                className={`group flex items-center gap-1 pr-2 py-1 rounded-md text-xs cursor-pointer transition-colors ${
                  isCurrent
                    ? 'bg-slate-200/90 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasSubdirs) toggleExpand(nodeKey);
                  }}
                  className={`w-4 h-4 flex items-center justify-center shrink-0 text-slate-400 ${
                    hasSubdirs ? 'hover:text-slate-700 dark:hover:text-white' : 'opacity-0 pointer-events-none'
                  }`}
                >
                  {isExp ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenVirtualPath(nextPath)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <Folder className="w-4 h-4 text-amber-400 fill-amber-400/75 shrink-0" />
                  <span className="truncate">{dir.name}</span>
                </button>
              </div>
              {isExp && renderVirtualSubtree(dir, nextPath, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  if (!visible) {
    return (
      <aside className="w-11 shrink-0 bg-white dark:bg-[#14171d] border-r border-slate-200 dark:border-[#262b35] flex flex-col items-center py-2 gap-1.5 select-none">
        <button
          onClick={onToggleCollapse}
          title="กางแผงด้านซ้าย (Ctrl+B)"
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1f242d] hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-slate-200 dark:bg-[#262b35]" />

        <button
          onClick={() => onOpenVirtualPath([])}
          title="Home (V:/)"
          className="p-2 rounded-lg text-amber-500 hover:bg-slate-100 dark:hover:bg-[#1f242d] transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>

        <button
          onClick={onMountLocal}
          title="This PC — Open PC Folder"
          className="p-2 rounded-lg text-sky-600 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-[#1f242d] transition-colors"
        >
          <Monitor className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenTrash}
          title="Recycle Bin (V:/.Trash)"
          className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1f242d] transition-colors"
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
              : 'text-indigo-500 hover:bg-slate-100 dark:hover:bg-[#1f242d]'
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

  const isHomeActive = currentPathString === 'V:/';

  return (
    <aside
      style={{ width: `${width}px` }}
      className="shrink-0 bg-white dark:bg-[#14171d] border-r border-slate-200 dark:border-[#262b35] flex flex-col min-h-0 overflow-hidden select-none"
    >
      {/* Top Collapse Bar */}
      <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-[#20252f] flex items-center justify-between shrink-0">
        <button
          onClick={() => onOpenVirtualPath([])}
          className={`flex-1 flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
            isHomeActive
              ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white'
              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
          }`}
        >
          <Home className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="truncate">Home</span>
        </button>
        <button
          onClick={onToggleCollapse}
          title="พับแผงด้านซ้าย (Ctrl+B)"
          className="ml-1 p-1.5 rounded-md text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1f242d] transition-colors shrink-0"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scrollable Navigation Tree */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-2.5">
        {/* SECTION 1: CLOUD / VIRTUAL & CONNECTED DRIVES TREE */}
        <div className="space-y-0.5">
          {/* Expandable VirtualDrive (Cloud Drive style row) */}
          <div>
            <div
              className={`flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs transition-colors ${
                currentPathString === 'V:/'
                  ? 'text-slate-900 dark:text-white font-medium'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleExpand('cloud-v')}
                className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
              >
                {expandedNodes['cloud-v'] ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => onOpenVirtualPath([])}
                className="flex-1 flex items-center gap-2 min-w-0 text-left"
              >
                <Cloud className="w-4 h-4 text-sky-500 fill-sky-500/80 shrink-0" />
                <span className="truncate">VirtualDrive (V:)</span>
              </button>
            </div>
            {expandedNodes['cloud-v'] && renderVirtualSubtree(virtualRoot, [], 1)}
          </div>

          {/* Mounted PC Local Folders */}
          {mountedLocals.map((localAdapter, idx) => {
            const rootName = localAdapter.getRootName();
            const isActiveLocal = currentPathString.startsWith(rootName);
            return (
              <div
                key={`${rootName}-${idx}`}
                className={`flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs transition-colors ${
                  isActiveLocal
                    ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                }`}
              >
                <span className="w-4 h-4 flex items-center justify-center text-slate-400 shrink-0">
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => onOpenLocalAdapter(localAdapter)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <Cloud className="w-4 h-4 text-blue-600 fill-blue-500/75 shrink-0" />
                  <span className="truncate">{rootName} (PC)</span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200/80 dark:border-[#262b35]" />

        {/* SECTION 2: PINNED QUICK ACCESS + FAVORITE FOLDERS */}
        <div className="space-y-0.5 pl-4">
          {QUICK_ACCESS_ITEMS.map((item) => {
            const targetPath = `V:/${item.path.join('/')}`;
            const isCurrent = currentPathString === targetPath;
            return (
              <button
                key={item.name}
                onClick={() => onOpenVirtualPath(item.path)}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  isCurrent
                    ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.name}</span>
                </span>
                <Pin className="w-3 h-3 text-slate-400 rotate-45 shrink-0" />
              </button>
            );
          })}

          {/* Pinned Yellow Folder Favorites */}
          {favorites.map((fav) => {
            const favPathStr = `V:/${fav.path.join('/')}`;
            const isCurrent = currentPathString === favPathStr;
            return (
              <div
                key={fav.id}
                className={`group flex items-center gap-1 rounded-md pr-1 transition-colors ${
                  isCurrent
                    ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                }`}
              >
                <button
                  onClick={() => onOpenFavorite(fav)}
                  className="flex-1 flex items-center gap-2.5 px-2 py-1.5 text-xs text-left min-w-0"
                >
                  <Folder className="w-4 h-4 text-amber-400 fill-amber-400/80 shrink-0" />
                  <span className="truncate">{fav.name}</span>
                </button>
                <button
                  onClick={() => onRemoveFavorite(fav.id)}
                  title="เอาออกจากรายการโปรด"
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200/80 dark:border-[#262b35]" />

        {/* SECTION 3: THIS PC TREE */}
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => toggleExpand('this-pc')}
            className="w-full flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#1c212b] transition-colors text-left"
          >
            {expandedNodes['this-pc'] ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            )}
            <Monitor className="w-4 h-4 text-sky-500 fill-sky-500/20 shrink-0 mr-1" />
            <span className="truncate">This PC</span>
          </button>

          {expandedNodes['this-pc'] && (
            <div className="pl-3 space-y-0.5">
              {/* Local Drive OS (C:) and DATA (D:) */}
              {(['C', 'D'] as DriveSlotKey[]).map((slot) => {
                const label = slot === 'C' ? 'OS (C:)' : 'DATA (D:)';
                const slotState = driveSlots[slot];
                const isConnected = Boolean(slotState.adapter);
                const isCurrent = currentPathString.startsWith(label);
                const isExp = Boolean(expandedNodes[`drive-${slot}`]);
                const subdirs = driveSubdirs[slot] || [];

                return (
                  <div key={slot}>
                    <div
                      className={`group flex items-center gap-1 pr-1 py-1 rounded-md text-xs transition-colors ${
                        isCurrent
                          ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isConnected) toggleDriveSlotExpand(slot);
                          else onOpenDriveSlot(slot);
                        }}
                        className="w-4 h-4 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
                      >
                        {isExp ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenDriveSlot(slot)}
                        title={
                          isConnected
                            ? `เปิด ${label} (${slotState.adapter?.rootHandle.name})`
                            : slotState.hasSavedHandle
                              ? `คลิกเพื่อยืนยันสิทธิ์เข้าถึง ${label}`
                              : `คลิกเพื่อเชื่อมต่อโฟลเดอร์เครื่องสำหรับ ${label}`
                        }
                        className="flex-1 flex items-center gap-2 min-w-0 text-left"
                      >
                        <HardDrive
                          className={`w-4 h-4 shrink-0 ${
                            isConnected
                              ? 'text-sky-600 dark:text-sky-400'
                              : 'text-slate-500 dark:text-slate-400'
                          }`}
                        />
                        <span className="truncate">{label}</span>
                      </button>

                      {isConnected ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUnlinkDriveSlot(slot);
                          }}
                          title={`ยกเลิกการเชื่อมต่อ ${label}`}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 pr-1">
                          เชื่อมต่อ
                        </span>
                      )}
                    </div>

                    {isExp && isConnected && slotState.adapter && (
                      <div className="pl-5 space-y-0.5">
                        {subdirs.length === 0 ? (
                          <div className="px-2 py-1 text-[11px] text-slate-400">
                            ไม่มีโฟลเดอร์ย่อย
                          </div>
                        ) : (
                          subdirs.map((sub) => (
                            <button
                              key={sub.name}
                              type="button"
                              onClick={async () => {
                                if (!slotState.adapter) return;
                                const child = await slotState.adapter.getChildAdapter(sub.name);
                                onOpenLocalAdapter(child as LocalFSAdapter);
                              }}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c212b] text-left"
                            >
                              <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/75 shrink-0" />
                              <span className="truncate">{sub.name}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Virtual Drive V: */}
              <div className="flex items-center gap-1 pr-1 py-1 rounded-md text-xs transition-colors">
                <span className="w-4 h-4 shrink-0" />
                <button
                  onClick={() => onOpenVirtualPath([])}
                  className={`flex-1 flex items-center gap-2 px-1.5 py-0.5 rounded-md text-xs transition-colors text-left ${
                    currentPathString === 'V:/'
                      ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                  }`}
                >
                  <HardDrive className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="truncate">Virtual (V:)</span>
                </button>
              </div>

              {/* Extra Mounted Local PC Folders */}
              {mountedLocals.map((localAdapter, idx) => (
                <button
                  key={`pc-${idx}`}
                  onClick={() => onOpenLocalAdapter(localAdapter)}
                  className="w-full flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b] transition-colors text-left"
                >
                  <HardDrive className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{localAdapter.getRootName()}</span>
                </button>
              ))}

              {/* Open PC Folder Trigger */}
              <button
                onClick={onMountLocal}
                className="w-full flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors text-left font-medium"
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate">Open PC Folder...</span>
              </button>

              {/* Recycle Bin */}
              <button
                onClick={onOpenTrash}
                className={`w-full flex items-center gap-2 pl-5 pr-2 py-1.5 rounded-md text-xs transition-colors text-left ${
                  currentPathString.includes('.Trash')
                    ? 'bg-slate-200/80 dark:bg-[#232936] text-slate-900 dark:text-white font-medium'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
                }`}
              >
                <Trash2 className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="truncate">Recycle Bin</span>
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-200/80 dark:border-[#262b35]" />

        {/* SECTION 4: COLLAPSIBLE COLOR TAGS (16 COLORS) */}
        <div>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => toggleExpand('tags-section')}
              className="flex-1 flex items-center gap-1 px-1.5 py-1.5 rounded-md text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1c212b] transition-colors text-left"
            >
              {expandedNodes['tags-section'] ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}
              <Tag className="w-3.5 h-3.5 text-blue-500 shrink-0 mr-1" />
              <span className="truncate">ป้ายสี (16 สี)</span>
            </button>
            {activeTagFilter !== 'none' && (
              <button
                onClick={() => onSelectTagFilter('none')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline px-1.5"
              >
                ล้าง
              </button>
            )}
          </div>

          {expandedNodes['tags-section'] && (
            <div className="mt-1 grid grid-cols-2 gap-1 pl-2">
              {(Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).map((tagKey) => {
                const meta = COLOR_TAG_META[tagKey];
                const isSelected = activeTagFilter === tagKey;
                return (
                  <button
                    key={tagKey}
                    onClick={() => onSelectTagFilter(isSelected ? 'none' : tagKey)}
                    title={meta.labelTh}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-colors min-w-0 ${
                      isSelected
                        ? 'bg-blue-600/15 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c212b]'
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
          )}
        </div>

        {/* SECTION 5: DROP SHELF */}
        <div
          onDragOver={handleShelfDragOver}
          onDragLeave={handleShelfDragLeave}
          onDrop={handleShelfDrop}
          className={`rounded-lg border p-2 transition-colors ${
            shelfDragOver
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-200 dark:border-[#262b35] bg-slate-50/70 dark:bg-[#181c24]'
          }`}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => toggleExpand('shelf-section')}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <Inbox className="w-3.5 h-3.5 text-indigo-500" />
              <span>Drop Shelf</span>
              <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                ({shelf.length})
              </span>
            </button>
            {shelf.length > 0 && (
              <button
                onClick={onClearShelf}
                className="text-[10px] text-slate-400 hover:text-rose-500"
              >
                ล้าง
              </button>
            )}
          </div>

          {(expandedNodes['shelf-section'] || shelf.length > 0 || shelfDragOver) && (
            <div className="mt-2">
              {shelf.length === 0 ? (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ลากไฟล์มาวางพักไว้ที่นี่เพื่อ Copy/Move รวมกัน
                </p>
              ) : (
                <>
                  <div className="max-h-28 overflow-y-auto space-y-1 mb-2">
                    {shelf.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-white dark:bg-[#12151b] border border-slate-200/70 dark:border-[#262b35] text-[11px]"
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
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy มา</span>
                    </button>
                    <button
                      onClick={onShelfMoveHere}
                      className="flex items-center justify-center gap-1 py-1 px-2 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium"
                    >
                      <MoveRight className="w-3 h-3" />
                      <span>Move มา</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Reset Sandbox */}
      <div className="px-3 py-2 border-t border-slate-200 dark:border-[#262b35] flex items-center justify-between shrink-0">
        <button
          onClick={onResetSandbox}
          className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
          title="รีเซ็ตข้อมูลตัวอย่างใน VirtualDrive (V:)"
        >
          <RotateCcw className="w-3 h-3" />
          <span>รีเซ็ต V: Drive</span>
        </button>
        <span className="text-[10px] text-slate-400">V: Sandbox</span>
      </div>
    </aside>
  );
}
