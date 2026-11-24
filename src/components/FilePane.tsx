import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Columns3,
  Copy,
  Edit3,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Star,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  ColorTag,
  CompareStatus,
  FileAdapter,
  FileEntry,
  PaneId,
  SortField,
  TabState,
  ViewMode,
} from '../types/files';
import {
  COLOR_TAG_META,
  formatBytes,
  formatDate,
  getFileExtensionLabel,
  isImageFile,
  matchWildcardFilter,
} from '../utils/format';
import { FileIcon } from './FileIcon';
import { MillerColumnsView } from './MillerColumnsView';

interface FilePaneProps {
  paneId: PaneId;
  isActive: boolean;
  tabs: TabState[];
  activeTabId: string;
  tags: Record<string, ColorTag>;
  activeTagFilter: ColorTag;
  isFavorited: boolean;
  compareMode: boolean;
  compareMap: Record<string, CompareStatus>;
  filterInputRef?: React.RefObject<HTMLInputElement | null>;
  onFocusPane: () => void;
  onSelectTab: (tabId: string) => void;
  onAddTab: () => void;
  onCloseTab: (tabId: string) => void;
  onToggleLockTab: (tabId: string) => void;
  onMountLocal: () => void;
  onSwitchVirtual: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
  onForward: () => void;
  onUp: () => void;
  onNavigateBreadcrumb: (idx: number) => void;
  onNavigatePathText: (pathText: string) => void;
  onNavigateToAdapter: (adapter: FileAdapter) => void;
  onRefresh: () => void;
  onToggleSort: (field: SortField) => void;
  onSetFilter: (val: string) => void;
  onToggleRecursiveSearch: () => void;
  onSetViewMode: (mode: ViewMode) => void;
  onRowClick: (e: React.MouseEvent, index: number, entry: FileEntry) => void;
  onCheckboxClick: (e: React.MouseEvent, index: number, entry: FileEntry) => void;
  onSelectAll: (visibleNames: string[]) => void;
  onOpenEntry: (entry: FileEntry) => void;
  onQuickLook: () => void;
  onDragStartEntries: (entryName: string) => void;
  onDropFromOtherPane: (shiftKey: boolean, targetFolderName?: string) => void;
  onDropExternalFiles: (files: FileList) => void;
  onUploadFiles: (files: FileList) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onCopyPath: (path: string) => void;
  onMillerSelect: (names: string[]) => void;
}

function ThumbnailPreview({ adapter, entry }: { adapter: FileAdapter; entry: FileEntry }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    if (entry.kind === 'file' && isImageFile(entry) && entry.size < 4_000_000) {
      adapter
        .readFileBlob(entry)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [adapter, entry]);

  if (url) {
    return (
      <img
        src={url}
        alt={entry.name}
        referrerPolicy="no-referrer"
        className="w-full h-20 object-contain rounded-lg bg-slate-900/5 dark:bg-black/20 p-1"
      />
    );
  }

  return (
    <div className="w-full h-20 flex items-center justify-center rounded-lg bg-slate-100/80 dark:bg-[#12151b]">
      <FileIcon entry={entry} size="lg" />
    </div>
  );
}

const COMPARE_LABELS: Record<CompareStatus, { text: string; cls: string }> = {
  'only-left': { text: 'เฉพาะฝั่งซ้าย', cls: 'text-blue-600 dark:text-blue-400' },
  'only-right': { text: 'เฉพาะฝั่งขวา', cls: 'text-emerald-600 dark:text-emerald-400' },
  newer: { text: 'ใหม่กว่า', cls: 'text-amber-600 dark:text-amber-400' },
  older: { text: 'เก่ากว่า', cls: 'text-slate-500 dark:text-slate-400' },
  different: { text: 'ขนาดต่างกัน', cls: 'text-rose-600 dark:text-rose-400' },
  same: { text: 'เหมือนกัน', cls: 'text-slate-400' },
};

export function FilePane(props: FilePaneProps) {
  const {
    paneId,
    isActive,
    tabs,
    activeTabId,
    tags,
    activeTagFilter,
    isFavorited,
    compareMode,
    compareMap,
    filterInputRef,
  } = props;

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const [editingPath, setEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState('');
  const [pathCopied, setPathCopied] = useState(false);
  const [dragOverPane, setDragOverPane] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const visibleEntries = useMemo(() => {
    let list = activeTab.entries;
    if (activeTab.filter.trim() && !activeTab.searchRecursive) {
      list = list.filter((e) => matchWildcardFilter(e.name, activeTab.filter));
    }
    if (activeTagFilter !== 'none') {
      list = list.filter((e) => tags[e.pathKey] === activeTagFilter);
    }
    return list;
  }, [activeTab.entries, activeTab.filter, activeTab.searchRecursive, activeTagFilter, tags]);

  const breadcrumbs = activeTab.adapter.getBreadcrumbs();
  const isLocal = activeTab.adapter.type === 'local';
  const totalSize = visibleEntries.reduce((acc, e) => acc + (e.kind === 'file' ? e.size : 0), 0);
  const selectedSet = useMemo(() => new Set(activeTab.selected), [activeTab.selected]);
  const allSelected =
    visibleEntries.length > 0 && visibleEntries.every((e) => selectedSet.has(e.name));

  const startPathEdit = () => {
    setPathInput(activeTab.adapter.getPathString());
    setEditingPath(true);
  };

  const commitPathEdit = () => {
    setEditingPath(false);
    if (pathInput.trim()) {
      props.onNavigatePathText(pathInput.trim());
    }
  };

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onCopyPath(activeTab.adapter.getPathString());
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 1500);
  };

  const handlePaneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPane(true);
  };

  const handlePaneDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragOverPane(false);
    }
  };

  const handlePaneDrop = (e: React.DragEvent, targetFolder?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverPane(false);
    setDragOverFolder(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      props.onDropExternalFiles(e.dataTransfer.files);
      return;
    }
    props.onDropFromOtherPane(e.shiftKey, targetFolder);
  };

  const sortArrow = (field: SortField) => {
    if (activeTab.sortBy !== field) return null;
    return <span className="ml-0.5 text-blue-500">{activeTab.sortAsc ? '▲' : '▼'}</span>;
  };

  return (
    <section
      id={`pane-${paneId}`}
      onClick={props.onFocusPane}
      onDragOver={handlePaneDragOver}
      onDragLeave={handlePaneDragLeave}
      onDrop={(e) => handlePaneDrop(e)}
      className={`flex-1 min-w-0 flex flex-col bg-white dark:bg-[#161920] transition-colors relative overflow-hidden ${
        dragOverPane
          ? 'ring-2 ring-inset ring-blue-500'
          : isActive
            ? 'ring-1 ring-inset ring-blue-500/60'
            : ''
      }`}
    >
      {/* TAB BAR (MULTI-TAB PER PANE) */}
      <div className="flex items-center gap-1 px-2 pt-1.5 bg-slate-100/90 dark:bg-[#12151b] border-b border-slate-200 dark:border-[#262b35] shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onFocusPane();
                  props.onSelectTab(tab.id);
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs cursor-pointer max-w-[160px] shrink-0 border-x border-t transition-colors ${
                  isTabActive
                    ? 'bg-white dark:bg-[#161920] text-slate-900 dark:text-white border-slate-200 dark:border-[#262b35] font-semibold -mb-px pb-[7px]'
                    : 'bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-[#1b2029]'
                }`}
              >
                {tab.adapter.type === 'local' ? (
                  <FolderOpen className="w-3 h-3 text-emerald-500 shrink-0" />
                ) : (
                  <HardDrive className="w-3 h-3 text-blue-500 shrink-0" />
                )}
                <span className="truncate">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onToggleLockTab(tab.id);
                  }}
                  title={tab.locked ? 'ปลดล็อกแท็บ' : 'ล็อกแท็บไม่ให้ปิด'}
                  className={`p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
                    tab.locked ? 'text-amber-500' : 'opacity-0 group-hover:opacity-70 text-slate-400'
                  }`}
                >
                  {tab.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                </button>
                {tabs.length > 1 && !tab.locked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onCloseTab(tab.id);
                    }}
                    title="ปิดแท็บ"
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-500 text-slate-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onFocusPane();
              props.onAddTab();
            }}
            title="เปิดแท็บใหม่ (Ctrl+T)"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-[#1f242d] shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pane Source Switcher */}
        <div className="flex items-center gap-1 pb-1 shrink-0">
          <span
            className={`text-[11px] font-medium whitespace-nowrap ${
              isLocal ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isLocal ? 'PC Local' : 'Virtual V:'}
          </span>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            ·
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onMountLocal();
            }}
            className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
            title="เชื่อมต่อโฟลเดอร์จริงในเครื่องคอมพิวเตอร์"
          >
            Open PC Folder
          </button>
          {isLocal && (
            <>
              <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                ·
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSwitchVirtual();
                }}
                className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0"
              >
                V: Drive
              </button>
            </>
          )}
        </div>
      </div>

      {/* ADDRESS BAR + NAVIGATION + SEARCH + VIEW MODE */}
      <div className="px-2.5 py-1.5 border-b border-slate-200 dark:border-[#262b35] flex flex-wrap items-center gap-1.5 bg-white dark:bg-[#161920] shrink-0">
        {/* Back / Forward / Up */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onBack();
            }}
            disabled={activeTab.historyIndex <= 0}
            title="ย้อนกลับ (Alt+Left)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222731] disabled:opacity-30"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onForward();
            }}
            disabled={activeTab.historyIndex >= activeTab.history.length - 1}
            title="ไปข้างหน้า (Alt+Right)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222731] disabled:opacity-30"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onUp();
            }}
            disabled={breadcrumbs.length <= 1}
            title="ขึ้น 1 ชั้น (Backspace)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222731] disabled:opacity-30"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Editable Path / Breadcrumb Bar */}
        <div className="flex-1 min-w-[140px] flex items-center gap-1 bg-slate-100 dark:bg-[#11141a] px-2 py-1 rounded-lg border border-slate-200 dark:border-[#262b35] text-xs">
          {editingPath ? (
            <input
              autoFocus
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              onBlur={commitPathEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitPathEdit();
                if (e.key === 'Escape') setEditingPath(false);
              }}
              className="w-full bg-transparent text-slate-900 dark:text-white font-mono text-xs focus:outline-none"
            />
          ) : (
            <div
              onDoubleClick={(e) => {
                e.stopPropagation();
                startPathEdit();
              }}
              className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar"
            >
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={`${crumb.name}-${idx}`}>
                  {idx > 0 && <span className="text-slate-400">/</span>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onNavigateBreadcrumb(idx);
                    }}
                    className={`whitespace-nowrap hover:text-blue-500 transition-colors ${
                      idx === breadcrumbs.length - 1
                        ? 'text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              startPathEdit();
            }}
            title="พิมพ์ Path โดยตรง"
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
          >
            <Edit3 className="w-3 h-3" />
          </button>

          <button
            onClick={handleCopyPath}
            title="คัดลอก Path"
            className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
          >
            {pathCopied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleFavorite();
            }}
            title={isFavorited ? 'เอาออกจากโฟลเดอร์โปรด' : 'ปักหมุดในโฟลเดอร์โปรด'}
            className="p-0.5 text-slate-400 hover:text-amber-500 shrink-0"
          >
            <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-400 text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Filter & Recursive Search */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="relative w-32 sm:w-40">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            <input
              ref={isActive ? filterInputRef : undefined}
              type="text"
              value={activeTab.filter}
              onClick={(e) => {
                e.stopPropagation();
                props.onFocusPane();
              }}
              onChange={(e) => props.onSetFilter(e.target.value)}
              placeholder={activeTab.searchRecursive ? 'ค้นหาทุกโฟลเดอร์ย่อย...' : 'กรองชื่อ หรือ *.md'}
              className="w-full pl-6 pr-6 py-1 text-xs rounded-lg bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35] text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
            />
            {activeTab.filter && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSetFilter('');
                }}
                className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onToggleRecursiveSearch();
            }}
            title="ค้นหาลึกลงไปในโฟลเดอร์ย่อยทั้งหมด"
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
              activeTab.searchRecursive
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-100 dark:bg-[#11141a] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-[#262b35] hover:border-blue-500/40'
            }`}
          >
            Subfolders
          </button>
        </div>

        {/* View Mode Switcher + Upload + Refresh */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center bg-slate-100 dark:bg-[#11141a] p-0.5 rounded-lg border border-slate-200 dark:border-[#262b35]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onSetViewMode('list');
              }}
              title="มุมมองรายการ (List)"
              className={`p-1 rounded-md transition-colors ${
                activeTab.viewMode === 'list'
                  ? 'bg-white dark:bg-[#222731] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onSetViewMode('grid');
              }}
              title="มุมมองรูปย่อ (Grid)"
              className={`p-1 rounded-md transition-colors ${
                activeTab.viewMode === 'grid'
                  ? 'bg-white dark:bg-[#222731] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                props.onSetViewMode('columns');
              }}
              title="มุมมองคอลัมน์ (Miller Columns)"
              className={`p-1 rounded-md transition-colors ${
                activeTab.viewMode === 'columns'
                  ? 'bg-white dark:bg-[#222731] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
          </div>

          <input
            ref={uploadInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                props.onUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              uploadInputRef.current?.click();
            }}
            title="อัปโหลดไฟล์จากเครื่องเข้าโฟลเดอร์นี้"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222731]"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              props.onRefresh();
            }}
            title="รีเฟรช (F5 / Ctrl+R)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#222731]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${activeTab.loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT VIEW */}
      {activeTab.error ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-semibold text-rose-500 mb-1">ไม่สามารถอ่านข้อมูลโฟลเดอร์นี้ได้</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{activeTab.error}</p>
          <button
            onClick={props.onRefresh}
            className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      ) : activeTab.viewMode === 'columns' ? (
        <MillerColumnsView
          adapter={activeTab.adapter}
          selectedNames={activeTab.selected}
          tags={tags}
          filterQuery={activeTab.filter}
          onSelectEntries={(names) => props.onMillerSelect(names)}
          onNavigateToAdapter={props.onNavigateToAdapter}
          onQuickLook={props.onQuickLook}
          onContextMenu={props.onContextMenu}
        />
      ) : activeTab.viewMode === 'grid' ? (
        <div className="flex-1 overflow-y-auto p-3 select-none">
          {visibleEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
              <p className="text-xs font-medium">
                {activeTab.filter ? 'ไม่พบไฟล์ที่ตรงกับคำค้นหา' : 'โฟลเดอร์นี้ว่างเปล่า'}
              </p>
              <p className="text-[11px] mt-1 opacity-80">
                ลากไฟล์จากอีกฝั่งหรือจากเครื่องคอมพิวเตอร์มาวางที่นี่ได้เลย
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {visibleEntries.map((entry, idx) => {
                const isSelected = selectedSet.has(entry.name);
                const tag = tags[entry.pathKey] || 'none';
                return (
                  <div
                    key={`${entry.name}-${idx}`}
                    draggable
                    onDragStart={() => props.onDragStartEntries(entry.name)}
                    onClick={(e) => props.onRowClick(e, idx, entry)}
                    onDoubleClick={() => props.onOpenEntry(entry)}
                    onContextMenu={(e) => props.onContextMenu(e, entry)}
                    className={`group rounded-xl border p-2 cursor-pointer transition-colors flex flex-col gap-1.5 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20'
                        : 'border-slate-200 dark:border-[#262b35] bg-slate-50/50 dark:bg-[#191d25] hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <ThumbnailPreview adapter={activeTab.adapter} entry={entry} />
                    <div className="flex items-center gap-1.5 min-w-0">
                      {tag !== 'none' && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_TAG_META[tag].dotClass}`} />
                      )}
                      <span
                        title={entry.relativePath || entry.name}
                        className="text-xs font-medium truncate text-slate-800 dark:text-slate-100"
                      >
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                      <span>{entry.kind === 'directory' ? 'Folder' : formatBytes(entry.size)}</span>
                      <span>{getFileExtensionLabel(entry)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* LIST TABLE HEADER */}
          <div className="grid grid-cols-12 gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-[#262b35] bg-slate-50 dark:bg-[#14171d] text-[11px] font-semibold text-slate-500 dark:text-slate-400 select-none shrink-0">
            <div className="col-span-6 flex items-center gap-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => props.onSelectAll(visibleEntries.map((e) => e.name))}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleSort('name');
                }}
                className="hover:text-slate-900 dark:hover:text-white truncate text-left"
              >
                ชื่อ (Name){sortArrow('name')}
              </button>
            </div>
            <div className="col-span-2 text-right">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleSort('size');
                }}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                ขนาด{sortArrow('size')}
              </button>
            </div>
            <div className="col-span-2 hidden sm:block">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleSort('type');
                }}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                {compareMode ? 'สถานะเทียบ' : 'ประเภท'}
                {!compareMode && sortArrow('type')}
              </button>
            </div>
            <div className="col-span-4 sm:col-span-2 text-right">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  props.onToggleSort('date');
                }}
                className="hover:text-slate-900 dark:hover:text-white"
              >
                แก้ไขล่าสุด{sortArrow('date')}
              </button>
            </div>
          </div>

          {/* LIST ROWS */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#20252f] select-none">
            {activeTab.loading && visibleEntries.length === 0 ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-8 rounded-lg bg-slate-100 dark:bg-[#1c2029] animate-pulse" />
                ))}
              </div>
            ) : visibleEntries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                <p className="text-xs font-medium">
                  {activeTab.filter ? 'ไม่พบไฟล์ที่ตรงกับคำค้นหา' : 'โฟลเดอร์นี้ว่างเปล่า'}
                </p>
                <p className="text-[11px] mt-1 opacity-75">
                  ลากไฟล์จากอีกฝั่งหรือจากเดสก์ท็อปมาวางที่นี่ หรือกด F7 เพื่อสร้างโฟลเดอร์
                </p>
              </div>
            ) : (
              visibleEntries.map((entry, idx) => {
                const isSelected = selectedSet.has(entry.name);
                const tag = tags[entry.pathKey] || 'none';
                const cmpStatus = compareMode ? compareMap[entry.name] : undefined;
                const isFolderDropTarget = entry.kind === 'directory' && dragOverFolder === entry.name;

                return (
                  <div
                    key={`${entry.pathKey}-${idx}`}
                    draggable
                    onDragStart={() => props.onDragStartEntries(entry.name)}
                    onDragOver={(e) => {
                      if (entry.kind === 'directory') {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOverFolder(entry.name);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverFolder === entry.name) setDragOverFolder(null);
                    }}
                    onDrop={(e) => {
                      if (entry.kind === 'directory') {
                        handlePaneDrop(e, entry.name);
                      }
                    }}
                    onClick={(e) => props.onRowClick(e, idx, entry)}
                    onDoubleClick={() => props.onOpenEntry(entry)}
                    onContextMenu={(e) => props.onContextMenu(e, entry)}
                    className={`grid grid-cols-12 gap-2 px-3 h-9 items-center text-xs cursor-pointer transition-colors ${
                      isFolderDropTarget
                        ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-500'
                        : isSelected
                          ? 'bg-blue-600/15 dark:bg-blue-500/25 text-blue-950 dark:text-white font-medium'
                          : 'hover:bg-slate-100/80 dark:hover:bg-[#1e232d] text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="col-span-6 flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => undefined}
                        onClick={(e) => props.onCheckboxClick(e, idx, entry)}
                        className="rounded border-slate-400 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                      />
                      <FileIcon entry={entry} size="sm" tag={tag} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate" title={entry.relativePath || entry.name}>
                          {entry.relativePath || entry.name}
                        </div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      {entry.kind === 'directory' ? '<DIR>' : formatBytes(entry.size)}
                    </div>
                    <div className="col-span-2 hidden sm:block text-[11px] truncate">
                      {cmpStatus ? (
                        <span className={`font-medium ${COMPARE_LABELS[cmpStatus].cls}`}>
                          {COMPARE_LABELS[cmpStatus].text}
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">
                          {getFileExtensionLabel(entry)}
                        </span>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                      {formatDate(entry.lastModified)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* PANE FOOTER */}
      <div className="px-3 py-1.5 border-t border-slate-200 dark:border-[#262b35] bg-slate-50 dark:bg-[#14171d] flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0 tabular-nums">
        <span>
          {visibleEntries.length} รายการ · {formatBytes(totalSize)}
        </span>
        <span className={activeTab.selected.length > 0 ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}>
          เลือกอยู่ {activeTab.selected.length} รายการ
        </span>
      </div>
    </section>
  );
}
