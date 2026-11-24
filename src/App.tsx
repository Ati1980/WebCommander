import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  ClipboardPaste,
  Columns2,
  Copy,
  Download,
  Eye,
  FilePlus,
  FolderPlus,
  GitCompare,
  HelpCircle,
  Moon,
  MoveRight,
  PanelLeft,
  Pencil,
  Sparkles,
  Square,
  Sun,
  Trash2,
} from 'lucide-react';
import { BatchRenameModal } from './components/BatchRenameModal';
import { ContextMenu } from './components/ContextMenu';
import { FilePane } from './components/FilePane';
import { InspectorPanel } from './components/InspectorPanel';
import {
  AlertModal,
  CompareSyncModal,
  ConflictModal,
  DeleteModal,
  DropChoiceModal,
  HelpModal,
  InputModal,
} from './components/Modals';
import { QuickLookModal } from './components/QuickLookModal';
import { DriveSlotState, Sidebar } from './components/Sidebar';
import {
  DriveSlotKey,
  loadDriveHandle,
  removeDriveHandle,
  saveDriveHandle,
} from './fs/driveHandlesDb';
import {
  copyEntryBetweenAdapters,
  generateUniqueName,
  LocalFSAdapter,
} from './fs/localFs';
import {
  createInitialVirtualRoot,
  loadVirtualRoot,
  saveVirtualRoot,
  VirtualFSAdapter,
  VirtualNode,
} from './fs/virtualFs';
import {
  ClipboardState,
  ColorTag,
  CompareStatus,
  ConflictStrategy,
  FavoriteItem,
  FileAdapter,
  FileEntry,
  LayoutMode,
  PaneId,
  ShelfItem,
  SortField,
  TabState,
  TaskLog,
  TransferProgress,
  ViewMode,
} from './types/files';
import { COLOR_TAG_META, matchWildcardFilter } from './utils/format';
import { createZipBlob } from './utils/zip';

const FAVORITES_KEY = 'commanderweb_favorites_v1';
const TAGS_KEY = 'commanderweb_tags_v1';

function sortEntriesList(
  entries: FileEntry[],
  sortBy: SortField,
  sortAsc: boolean
): FileEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    let cmp = 0;
    if (sortBy === 'name') {
      cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortBy === 'size') {
      cmp = a.size - b.size;
    } else if (sortBy === 'date') {
      cmp = a.lastModified - b.lastModified;
    } else {
      const extA = a.name.includes('.') ? a.name.split('.').pop() || '' : '';
      const extB = b.name.includes('.') ? b.name.split('.').pop() || '' : '';
      cmp = extA.localeCompare(extB);
    }
    return sortAsc ? cmp : -cmp;
  });
}

function makeTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function createTab(adapter: FileAdapter, viewMode: ViewMode = 'list'): TabState {
  const crumbs = adapter.getBreadcrumbs();
  const title = crumbs[crumbs.length - 1]?.name || 'Root';
  return {
    id: makeTabId(),
    title,
    adapter,
    history: [adapter],
    historyIndex: 0,
    entries: [],
    selected: [],
    lastSelectedIndex: -1,
    sortBy: 'name',
    sortAsc: true,
    filter: '',
    searchRecursive: false,
    viewMode,
    loading: true,
    locked: false,
    error: null,
  };
}

interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

type ActiveModal =
  | { type: 'new-folder' }
  | { type: 'new-file' }
  | { type: 'rename'; entry: FileEntry }
  | { type: 'batch-rename'; entries: FileEntry[] }
  | { type: 'delete'; entries: FileEntry[] }
  | { type: 'compare-sync' }
  | { type: 'quick-look'; index: number }
  | { type: 'help' }
  | { type: 'alert'; title: string; message: string }
  | {
      type: 'drop-choice';
      srcPaneId: PaneId;
      destPaneId: PaneId;
      items: FileEntry[];
      targetFolder?: string;
    }
  | null;

export default function App() {
  const virtualRootRef = useRef<VirtualNode>(loadVirtualRoot());
  const persistVirtual = useCallback(() => {
    saveVirtualRoot(virtualRootRef.current);
  }, []);

  const [darkMode, setDarkMode] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('dual');
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(248);
  const [inspectorVisible, setInspectorVisible] = useState(true);
  const [activePane, setActivePane] = useState<PaneId>('left');
  const [leftPaneRatio, setLeftPaneRatio] = useState(50);
  const [mountedLocals, setMountedLocals] = useState<LocalFSAdapter[]>([]);
  const [driveSlots, setDriveSlots] = useState<Record<DriveSlotKey, DriveSlotState>>({
    C: { adapter: null, hasSavedHandle: false },
    D: { adapter: null, hasSavedHandle: false },
  });
  const savedDriveHandlesRef = useRef<Partial<Record<DriveSlotKey, FileSystemDirectoryHandle>>>({});

  const [paneTabs, setPaneTabs] = useState<Record<PaneId, TabState[]>>(() => {
    const leftAdapter = new VirtualFSAdapter(virtualRootRef.current, ['Documents'], persistVirtual);
    const rightAdapter = new VirtualFSAdapter(
      virtualRootRef.current,
      ['Backup_Archive'],
      persistVirtual
    );
    return {
      left: [
        createTab(leftAdapter, 'list'),
        createTab(
          new VirtualFSAdapter(virtualRootRef.current, ['Projects'], persistVirtual),
          'columns'
        ),
      ],
      right: [createTab(rightAdapter, 'list')],
    };
  });

  const [activeTabIds, setActiveTabIds] = useState<Record<PaneId, string>>(() => ({
    left: paneTabs.left[0].id,
    right: paneTabs.right[0].id,
  }));

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      { id: 'fav_proj', name: 'Projects', adapterType: 'virtual', path: ['Projects'] },
      { id: 'fav_media', name: 'Media_Assets', adapterType: 'virtual', path: ['Media_Assets'] },
      { id: 'fav_backup', name: 'Backup_Archive', adapterType: 'virtual', path: ['Backup_Archive'] },
    ];
  });

  const [tags, setTags] = useState<Record<string, ColorTag>>(() => {
    try {
      const saved = localStorage.getItem(TAGS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      'virtual:Documents/Project_Proposal_2026.md': 'blue',
      'virtual:Documents/Budget_Summary_Q4.csv': 'amber',
      'virtual:Projects/syncEngine.ts': 'green',
    };
  });

  const [activeTagFilter, setActiveTagFilter] = useState<ColorTag>('none');
  const [shelf, setShelf] = useState<ShelfItem[]>([]);
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [compareMode, setCompareMode] = useState(false);

  const [transfer, setTransfer] = useState<TransferProgress>({
    active: false,
    label: '',
    percent: 0,
  });
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [modal, setModal] = useState<ActiveModal>(null);
  const [conflictPrompt, setConflictPrompt] = useState<{
    conflicts: string[];
    resolve: (choice: ConflictStrategy | null) => void;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    paneId: PaneId;
    entry: FileEntry;
  } | null>(null);

  const dragStateRef = useRef<{
    sourcePaneId: PaneId;
    items: FileEntry[];
  } | null>(null);

  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites]);

  useEffect(() => {
    try {
      localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
    } catch {
      // ignore
    }
  }, [tags]);

  const showToast = useCallback(
    (message: string, type: ToastItem['type'] = 'info') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  const addLog = useCallback(
    (message: string, type: TaskLog['type'] = 'info') => {
      setLogs((prev) => [
        { id: `log_${Date.now()}_${Math.random()}`, timestamp: Date.now(), message, type },
        ...prev.slice(0, 99),
      ]);
    },
    []
  );

  const getActiveTab = useCallback(
    (paneId: PaneId): TabState => {
      const list = paneTabs[paneId];
      return list.find((t) => t.id === activeTabIds[paneId]) || list[0];
    },
    [paneTabs, activeTabIds]
  );

  const updateTab = useCallback(
    (paneId: PaneId, tabId: string, updater: (tab: TabState) => TabState) => {
      setPaneTabs((prev) => ({
        ...prev,
        [paneId]: prev[paneId].map((t) => (t.id === tabId ? updater(t) : t)),
      }));
    },
    []
  );

  const refreshTab = useCallback(
    async (paneId: PaneId, tabId: string, overrideAdapter?: FileAdapter, overrideSearch?: { filter: string; recursive: boolean }) => {
      let targetTab: TabState | undefined;
      setPaneTabs((prev) => {
        targetTab = prev[paneId].find((t) => t.id === tabId);
        return {
          ...prev,
          [paneId]: prev[paneId].map((t) =>
            t.id === tabId ? { ...t, loading: true, error: null } : t
          ),
        };
      });

      const adapter = overrideAdapter || targetTab?.adapter;
      if (!adapter) return;
      const useRecursive = overrideSearch ? overrideSearch.recursive : targetTab?.searchRecursive;
      const filterText = overrideSearch ? overrideSearch.filter : targetTab?.filter || '';

      try {
        const raw =
          useRecursive && filterText.trim()
            ? await adapter.searchRecursive(filterText)
            : await adapter.listEntries();

        setPaneTabs((prev) => ({
          ...prev,
          [paneId]: prev[paneId].map((t) => {
            if (t.id !== tabId) return t;
            const sorted = sortEntriesList(raw, t.sortBy, t.sortAsc);
            const validNames = new Set(sorted.map((e) => e.name));
            const crumbs = adapter.getBreadcrumbs();
            return {
              ...t,
              title: crumbs[crumbs.length - 1]?.name || 'Root',
              entries: sorted,
              selected: t.selected.filter((n) => validNames.has(n)),
              loading: false,
              error: null,
            };
          }),
        }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถอ่านข้อมูลได้';
        setPaneTabs((prev) => ({
          ...prev,
          [paneId]: prev[paneId].map((t) =>
            t.id === tabId ? { ...t, loading: false, error: msg } : t
          ),
        }));
      }
    },
    []
  );

  // Initial load of all initial tabs
  useEffect(() => {
    (['left', 'right'] as PaneId[]).forEach((pId) => {
      paneTabs[pId].forEach((tab) => {
        refreshTab(pId, tab.id, tab.adapter);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate saved C: and D: handles from IndexedDB
  useEffect(() => {
    (['C', 'D'] as DriveSlotKey[]).forEach(async (slot) => {
      const handle = await loadDriveHandle(slot);
      if (!handle) return;
      savedDriveHandlesRef.current[slot] = handle;
      const label = slot === 'C' ? 'OS (C:)' : 'DATA (D:)';
      try {
        const permHandle = handle as FileSystemDirectoryHandle & {
          queryPermission?: (opts: { mode: string }) => Promise<string>;
        };
        const status = permHandle.queryPermission
          ? await permHandle.queryPermission({ mode: 'readwrite' })
          : 'prompt';
        if (status === 'granted') {
          setDriveSlots((prev) => ({
            ...prev,
            [slot]: {
              adapter: new LocalFSAdapter(handle, [], label),
              hasSavedHandle: true,
            },
          }));
        } else {
          setDriveSlots((prev) => ({
            ...prev,
            [slot]: { adapter: null, hasSavedHandle: true },
          }));
        }
      } catch {
        setDriveSlots((prev) => ({
          ...prev,
          [slot]: { adapter: null, hasSavedHandle: true },
        }));
      }
    });
  }, []);

  const refreshActiveTab = useCallback(
    async (paneId: PaneId) => {
      const tab = getActiveTab(paneId);
      await refreshTab(paneId, tab.id, tab.adapter);
    },
    [getActiveTab, refreshTab]
  );

  const navigateTabAdapter = useCallback(
    async (paneId: PaneId, nextAdapter: FileAdapter, pushHistory = true) => {
      const tab = getActiveTab(paneId);
      const crumbs = nextAdapter.getBreadcrumbs();
      const nextTitle = crumbs[crumbs.length - 1]?.name || 'Root';

      updateTab(paneId, tab.id, (t) => {
        const nextHistory = pushHistory
          ? [...t.history.slice(0, t.historyIndex + 1), nextAdapter]
          : t.history;
        const nextIdx = pushHistory ? nextHistory.length - 1 : t.historyIndex;
        return {
          ...t,
          title: nextTitle,
          adapter: nextAdapter,
          history: nextHistory,
          historyIndex: nextIdx,
          selected: [],
          lastSelectedIndex: -1,
          filter: '',
          searchRecursive: false,
        };
      });

      await refreshTab(paneId, tab.id, nextAdapter, { filter: '', recursive: false });
    },
    [getActiveTab, refreshTab, updateTab]
  );

  const handleBack = useCallback(
    async (paneId: PaneId) => {
      const tab = getActiveTab(paneId);
      if (tab.historyIndex <= 0) return;
      const nextIdx = tab.historyIndex - 1;
      const targetAdapter = tab.history[nextIdx];
      updateTab(paneId, tab.id, (t) => ({
        ...t,
        adapter: targetAdapter,
        historyIndex: nextIdx,
        selected: [],
        filter: '',
        searchRecursive: false,
      }));
      await refreshTab(paneId, tab.id, targetAdapter, { filter: '', recursive: false });
    },
    [getActiveTab, refreshTab, updateTab]
  );

  const handleForward = useCallback(
    async (paneId: PaneId) => {
      const tab = getActiveTab(paneId);
      if (tab.historyIndex >= tab.history.length - 1) return;
      const nextIdx = tab.historyIndex + 1;
      const targetAdapter = tab.history[nextIdx];
      updateTab(paneId, tab.id, (t) => ({
        ...t,
        adapter: targetAdapter,
        historyIndex: nextIdx,
        selected: [],
        filter: '',
        searchRecursive: false,
      }));
      await refreshTab(paneId, tab.id, targetAdapter, { filter: '', recursive: false });
    },
    [getActiveTab, refreshTab, updateTab]
  );

  const handleUp = useCallback(
    async (paneId: PaneId) => {
      const tab = getActiveTab(paneId);
      const crumbs = tab.adapter.getBreadcrumbs();
      if (crumbs.length <= 1) return;
      const parent = tab.adapter.navigateToBreadcrumb(crumbs.length - 2);
      await navigateTabAdapter(paneId, parent, true);
    },
    [getActiveTab, navigateTabAdapter]
  );

  const handleMountLocalFolder = useCallback(
    async (paneId: PaneId) => {
      setActivePane(paneId);
      const picker = (
        window as unknown as {
          showDirectoryPicker?: (opts?: { mode?: string }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;

      if (typeof picker !== 'function') {
        setModal({
          type: 'alert',
          title: 'เบราว์เซอร์ไม่รองรับ File System Access API',
          message:
            'เบราว์เซอร์ของคุณ (หรือโหมด iframe Preview ที่จำกัดสิทธิ์) ไม่รองรับการเปิดโฟลเดอร์จริงในเครื่องโดยตรง\n\nคุณสามารถลากไฟล์จากเครื่องคอมพิวเตอร์มาวางในหน้าต่างนี้ หรือกดปุ่มอัปโหลดเพื่อใช้งานไฟล์จริงได้ทันที หรือเปิดแอปในหน้าต่างเบราว์เซอร์ Chrome / Edge โดยตรงเพื่อเข้าถึงโฟลเดอร์ PC',
        });
        return;
      }

      try {
        const dirHandle = await picker({ mode: 'readwrite' });
        const localAdapter = new LocalFSAdapter(dirHandle);
        setMountedLocals((prev) => {
          const exists = prev.some((a) => a.getRootName() === localAdapter.getRootName());
          return exists ? prev : [...prev, localAdapter];
        });
        await navigateTabAdapter(paneId, localAdapter, true);
        addLog(`เชื่อมต่อโฟลเดอร์จริง "${dirHandle.name}" ที่ฝั่ง${paneId === 'left' ? 'ซ้าย' : 'ขวา'}`, 'success');
        showToast(`เชื่อมต่อโฟลเดอร์ "${dirHandle.name}" สำเร็จ`, 'success');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setModal({
            type: 'alert',
            title: 'ไม่สามารถเข้าถึงโฟลเดอร์ในเครื่องได้',
            message: `${err.message}\n\nหมายเหตุ: หากเปิดแอปใน iframe preview ที่จำกัดสิทธิ์ สามารถเปิดแท็บใหม่หรือลากไฟล์จากเครื่องเข้ามาวางแทนได้`,
          });
        }
      }
    },
    [addLog, navigateTabAdapter, showToast]
  );

  const handleOpenDriveSlot = useCallback(
    async (slot: DriveSlotKey) => {
      const label = slot === 'C' ? 'OS (C:)' : 'DATA (D:)';
      const existingAdapter = driveSlots[slot].adapter;
      if (existingAdapter) {
        await navigateTabAdapter(activePane, existingAdapter, true);
        return;
      }

      const savedHandle = savedDriveHandlesRef.current[slot];
      if (savedHandle) {
        try {
          const permHandle = savedHandle as FileSystemDirectoryHandle & {
            requestPermission?: (opts: { mode: string }) => Promise<string>;
          };
          const res = permHandle.requestPermission
            ? await permHandle.requestPermission({ mode: 'readwrite' })
            : 'granted';
          if (res === 'granted') {
            const adapter = new LocalFSAdapter(savedHandle, [], label);
            setDriveSlots((prev) => ({
              ...prev,
              [slot]: { adapter, hasSavedHandle: true },
            }));
            await navigateTabAdapter(activePane, adapter, true);
            return;
          }
        } catch {
          // fallback to picker below
        }
      }

      const picker = (
        window as unknown as {
          showDirectoryPicker?: (opts?: {
            mode?: string;
            id?: string;
          }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;

      if (typeof picker !== 'function') {
        setModal({
          type: 'alert',
          title: `ไม่สามารถเปิด ${label} โดยตรงในหน้าต่างนี้`,
          message:
            `เนื่องจากข้อจำกัดด้านความปลอดภัยของเบราว์เซอร์ (หรือ iframe Preview) ไม่สามารถเข้าถึงไดรฟ์ ${slot}: โดยอัตโนมัติได้\n\nวิธีใช้งานกับไฟล์จริงใน ${label}:\n1. เปิดแอปนี้ในแท็บเบราว์เซอร์ Chrome / Edge โดยตรง แล้วคลิก ${label} เพื่อเลือกไดรฟ์ ${slot}:\\ หรือโฟลเดอร์ที่ต้องการ (ระบบจะจำค่าไว้ให้)\n2. หรือใช้วิธีลากไฟล์จาก ${label} ในเครื่องมาวางลงในหน้าต่างนี้ได้ทันที`,
        });
        return;
      }

      try {
        const dirHandle = await picker({ mode: 'readwrite', id: `drive_${slot}` });
        savedDriveHandlesRef.current[slot] = dirHandle;
        await saveDriveHandle(slot, dirHandle);
        const adapter = new LocalFSAdapter(dirHandle, [], label);
        setDriveSlots((prev) => ({
          ...prev,
          [slot]: { adapter, hasSavedHandle: true },
        }));
        await navigateTabAdapter(activePane, adapter, true);
        addLog(`เชื่อมต่อ ${label} (${dirHandle.name}) สำเร็จ`, 'success');
        showToast(`เชื่อมต่อ ${label} (${dirHandle.name}) สำเร็จ`, 'success');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          setModal({
            type: 'alert',
            title: `ไม่สามารถเข้าถึง ${label} ได้`,
            message: `${err.message}\n\nหมายเหตุ: เบราว์เซอร์บางตัวอาจไม่อนุญาตให้เลือก Root ของไดรฟ์ระบบ (C:\\) ทั้งหมดโดยตรง แนะนำให้เลือกโฟลเดอร์ย่อย (เช่น Users, Work, Projects) บนไดรฟ์ ${slot}: แทนครับ`,
          });
        }
      }
    },
    [activePane, addLog, driveSlots, navigateTabAdapter, showToast]
  );

  const handleUnlinkDriveSlot = useCallback(
    async (slot: DriveSlotKey) => {
      delete savedDriveHandlesRef.current[slot];
      await removeDriveHandle(slot);
      setDriveSlots((prev) => ({
        ...prev,
        [slot]: { adapter: null, hasSavedHandle: false },
      }));
      showToast(`ยกเลิกการเชื่อมต่อไดรฟ์ ${slot}: แล้ว`, 'info');
    },
    [showToast]
  );

  const askConflictResolution = useCallback((conflicts: string[]) => {
    return new Promise<ConflictStrategy | null>((resolve) => {
      setConflictPrompt({ conflicts, resolve });
    });
  }, []);

  const executeTransfer = useCallback(
    async (
      mode: 'copy' | 'move',
      srcAdapter: FileAdapter,
      destAdapter: FileAdapter,
      items: FileEntry[],
      srcPaneToRefresh?: PaneId,
      destPaneToRefresh?: PaneId
    ) => {
      if (items.length === 0) return;

      if (
        srcAdapter.type === destAdapter.type &&
        srcAdapter.getPathString() === destAdapter.getPathString()
      ) {
        showToast('โฟลเดอร์ต้นทางและปลายทางเป็นตำแหน่งเดียวกัน', 'warning');
        return;
      }

      const conflicts: string[] = [];
      for (const item of items) {
        if (await destAdapter.hasEntry(item.name)) {
          conflicts.push(item.name);
        }
      }

      let strategy: ConflictStrategy = 'overwrite';
      if (conflicts.length > 0) {
        const chosen = await askConflictResolution(conflicts);
        if (!chosen) return;
        strategy = chosen;
      }

      const actionLabel = mode === 'copy' ? 'กำลังคัดลอก' : 'กำลังย้าย';
      setTransfer({ active: true, label: `${actionLabel}...`, percent: 8 });

      let processed = 0;
      let successCount = 0;

      try {
        for (const item of items) {
          let targetName = item.name;
          const exists = await destAdapter.hasEntry(targetName);
          if (exists) {
            if (strategy === 'skip') {
              processed++;
              setTransfer({
                active: true,
                label: `${actionLabel}: ข้าม ${item.name}`,
                percent: Math.round((processed / items.length) * 100),
              });
              continue;
            }
            if (strategy === 'rename') {
              targetName = await generateUniqueName(destAdapter, item.name);
            }
          }

          setTransfer({
            active: true,
            label: `${actionLabel}: ${item.name}`,
            percent: Math.round(((processed + 0.35) / items.length) * 100),
          });

          await copyEntryBetweenAdapters(srcAdapter, item, destAdapter, targetName);
          if (mode === 'move') {
            await srcAdapter.deleteEntry(item.name);
          }
          successCount++;
          processed++;
          setTransfer({
            active: true,
            label: `${actionLabel}: ${item.name}`,
            percent: Math.round((processed / items.length) * 100),
          });
        }

        if (srcPaneToRefresh) await refreshActiveTab(srcPaneToRefresh);
        if (destPaneToRefresh && destPaneToRefresh !== srcPaneToRefresh) {
          await refreshActiveTab(destPaneToRefresh);
        }

        const verb = mode === 'copy' ? 'คัดลอก' : 'ย้าย';
        const msg = `${verb}สำเร็จ ${successCount} รายการ ไปยัง ${destAdapter.getPathString()}`;
        addLog(msg, 'success');
        showToast(msg, 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'โอนย้ายไฟล์ไม่สำเร็จ';
        addLog(`ข้อผิดพลาด: ${msg}`, 'error');
        showToast(msg, 'error');
      } finally {
        setTimeout(() => setTransfer({ active: false, label: '', percent: 0 }), 500);
      }
    },
    [addLog, askConflictResolution, refreshActiveTab, showToast]
  );

  const activeTab = getActiveTab(activePane);
  const oppositePane: PaneId = activePane === 'left' ? 'right' : 'left';
  const oppositeTab = getActiveTab(oppositePane);

  const selectedEntries = useMemo(() => {
    const sel = new Set(activeTab.selected);
    return activeTab.entries.filter((e) => sel.has(e.name));
  }, [activeTab.entries, activeTab.selected]);

  const triggerCopyToOther = useCallback(async () => {
    if (selectedEntries.length === 0) {
      showToast('กรุณาเลือกไฟล์หรือโฟลเดอร์ที่ต้องการคัดลอกก่อน', 'warning');
      return;
    }
    await executeTransfer(
      'copy',
      activeTab.adapter,
      oppositeTab.adapter,
      selectedEntries,
      activePane,
      oppositePane
    );
  }, [
    activePane,
    activeTab.adapter,
    executeTransfer,
    oppositePane,
    oppositeTab.adapter,
    selectedEntries,
    showToast,
  ]);

  const triggerMoveToOther = useCallback(async () => {
    if (selectedEntries.length === 0) {
      showToast('กรุณาเลือกไฟล์หรือโฟลเดอร์ที่ต้องการย้ายก่อน', 'warning');
      return;
    }
    await executeTransfer(
      'move',
      activeTab.adapter,
      oppositeTab.adapter,
      selectedEntries,
      activePane,
      oppositePane
    );
  }, [
    activePane,
    activeTab.adapter,
    executeTransfer,
    oppositePane,
    oppositeTab.adapter,
    selectedEntries,
    showToast,
  ]);

  // Folder Compare Map between Left and Right active tabs
  const compareStats = useMemo(() => {
    const leftEntries = getActiveTab('left').entries;
    const rightEntries = getActiveTab('right').entries;
    const leftMap = new Map(leftEntries.map((e) => [e.name, e]));
    const rightMap = new Map(rightEntries.map((e) => [e.name, e]));

    const leftStatus: Record<string, CompareStatus> = {};
    const rightStatus: Record<string, CompareStatus> = {};
    let onlyLeft = 0;
    let onlyRight = 0;
    let newerLeft = 0;
    let newerRight = 0;

    for (const [name, lEntry] of leftMap) {
      const rEntry = rightMap.get(name);
      if (!rEntry) {
        leftStatus[name] = 'only-left';
        onlyLeft++;
      } else if (lEntry.kind === 'directory' && rEntry.kind === 'directory') {
        leftStatus[name] = 'same';
      } else if (lEntry.size === rEntry.size && Math.abs(lEntry.lastModified - rEntry.lastModified) < 2000) {
        leftStatus[name] = 'same';
      } else if (lEntry.lastModified > rEntry.lastModified + 2000) {
        leftStatus[name] = 'newer';
        newerLeft++;
      } else if (rEntry.lastModified > lEntry.lastModified + 2000) {
        leftStatus[name] = 'older';
      } else {
        leftStatus[name] = 'different';
      }
    }

    for (const [name, rEntry] of rightMap) {
      const lEntry = leftMap.get(name);
      if (!lEntry) {
        rightStatus[name] = 'only-right';
        onlyRight++;
      } else if (lEntry.kind === 'directory' && rEntry.kind === 'directory') {
        rightStatus[name] = 'same';
      } else if (lEntry.size === rEntry.size && Math.abs(lEntry.lastModified - rEntry.lastModified) < 2000) {
        rightStatus[name] = 'same';
      } else if (rEntry.lastModified > lEntry.lastModified + 2000) {
        rightStatus[name] = 'newer';
        newerRight++;
      } else if (lEntry.lastModified > rEntry.lastModified + 2000) {
        rightStatus[name] = 'older';
      } else {
        rightStatus[name] = 'different';
      }
    }

    return { leftStatus, rightStatus, onlyLeft, onlyRight, newerLeft, newerRight };
  }, [getActiveTab]);

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts = {} as Record<Exclude<ColorTag, 'none'>, number>;
    (Object.keys(COLOR_TAG_META) as Exclude<ColorTag, 'none'>[]).forEach((k) => {
      counts[k] = 0;
    });
    Object.values(tags).forEach((t) => {
      if (t !== 'none' && t in counts) counts[t]++;
    });
    return counts;
  }, [tags]);

  const handleSetTag = useCallback(
    (entries: FileEntry[], tag: ColorTag) => {
      setTags((prev) => {
        const next = { ...prev };
        for (const e of entries) {
          if (tag === 'none') delete next[e.pathKey];
          else next[e.pathKey] = tag;
        }
        return next;
      });
    },
    []
  );

  // Download single file or export multi-file/folder ZIP
  const handleDownloadEntries = useCallback(
    async (adapter: FileAdapter, entries: FileEntry[]) => {
      if (entries.length === 0) return;
      try {
        let blob: Blob;
        let filename: string;
        if (entries.length === 1 && entries[0].kind === 'file') {
          blob = await adapter.readFileBlob(entries[0]);
          filename = entries[0].name;
        } else {
          showToast('กำลังสร้างไฟล์ .ZIP...', 'info');
          blob = await createZipBlob(adapter, entries);
          filename =
            entries.length === 1 ? `${entries[0].name}.zip` : `CommanderWeb_Archive.zip`;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        addLog(`ดาวน์โหลด "${filename}"`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'ดาวน์โหลดไม่สำเร็จ', 'error');
      }
    },
    [addLog, showToast]
  );

  // Upload or drop files from external PC desktop
  const handleExternalFiles = useCallback(
    async (paneId: PaneId, files: FileList) => {
      const tab = getActiveTab(paneId);
      setTransfer({ active: true, label: 'กำลังนำเข้าไฟล์...', percent: 20 });
      try {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          await tab.adapter.writeFileFromBlob(f.name, f, f.lastModified);
          setTransfer({
            active: true,
            label: `นำเข้า: ${f.name}`,
            percent: Math.round(((i + 1) / files.length) * 100),
          });
        }
        await refreshActiveTab(paneId);
        addLog(`นำเข้าไฟล์จากเครื่อง ${files.length} ไฟล์ ไปยัง ${tab.adapter.getPathString()}`, 'success');
        showToast(`นำเข้า ${files.length} ไฟล์สำเร็จ`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'นำเข้าไฟล์ล้มเหลว', 'error');
      } finally {
        setTimeout(() => setTransfer({ active: false, label: '', percent: 0 }), 400);
      }
    },
    [addLog, getActiveTab, refreshActiveTab, showToast]
  );

  // Clipboard Paste
  const handleClipboardPaste = useCallback(async () => {
    if (!clipboard) {
      showToast('คลิปบอร์ดว่างเปล่า', 'warning');
      return;
    }
    const destTab = getActiveTab(activePane);
    await executeTransfer(
      clipboard.mode === 'cut' ? 'move' : 'copy',
      clipboard.sourceAdapter,
      destTab.adapter,
      clipboard.entries,
      undefined,
      activePane
    );
    if (clipboard.mode === 'cut') {
      setClipboard(null);
    }
  }, [activePane, clipboard, executeTransfer, getActiveTab, showToast]);

  // Swap Left and Right Panes
  const handleSwapPanes = useCallback(() => {
    setPaneTabs((prev) => ({ left: prev.right, right: prev.left }));
    setActiveTabIds((prev) => ({ left: prev.right, right: prev.left }));
    setActivePane((p) => (p === 'left' ? 'right' : 'left'));
    showToast('สลับหน้าต่างซ้าย ↔ ขวา แล้ว', 'info');
  }, [showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modal || conflictPrompt) {
        if (e.key === 'Escape') {
          setModal(null);
          if (conflictPrompt) {
            conflictPrompt.resolve(null);
            setConflictPrompt(null);
          }
        }
        return;
      }

      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        if (layoutMode === 'dual') {
          setActivePane((p) => (p === 'left' ? 'right' : 'left'));
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        triggerCopyToOther();
      } else if (e.key === 'F6') {
        e.preventDefault();
        triggerMoveToOther();
      } else if (e.key === 'F7' && e.shiftKey) {
        e.preventDefault();
        setModal({ type: 'new-file' });
      } else if (e.key === 'F7') {
        e.preventDefault();
        setModal({ type: 'new-folder' });
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (selectedEntries.length === 1) {
          setModal({ type: 'rename', entry: selectedEntries[0] });
        } else if (selectedEntries.length > 1) {
          setModal({ type: 'batch-rename', entries: selectedEntries });
        } else {
          showToast('กรุณาเลือกรายการที่ต้องการเปลี่ยนชื่อ', 'warning');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const targets = selectedEntries.length > 0 ? selectedEntries : activeTab.entries;
        if (targets.length > 0) setModal({ type: 'batch-rename', entries: targets });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setCompareMode((c) => !c);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        filterInputRef.current?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
        e.preventDefault();
        handleSwapPanes();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const newTab = createTab(activeTab.adapter, activeTab.viewMode);
        setPaneTabs((prev) => ({ ...prev, [activePane]: [...prev[activePane], newTab] }));
        setActiveTabIds((prev) => ({ ...prev, [activePane]: newTab.id }));
        refreshTab(activePane, newTab.id, newTab.adapter);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        const list = paneTabs[activePane];
        if (list.length > 1 && !activeTab.locked) {
          const filtered = list.filter((t) => t.id !== activeTab.id);
          setPaneTabs((prev) => ({ ...prev, [activePane]: filtered }));
          setActiveTabIds((prev) => ({ ...prev, [activePane]: filtered[filtered.length - 1].id }));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedEntries.length > 0) {
          e.preventDefault();
          setClipboard({
            mode: 'copy',
            sourceAdapter: activeTab.adapter,
            entries: selectedEntries,
            sourcePathString: activeTab.adapter.getPathString(),
          });
          showToast(`คัดลอก ${selectedEntries.length} รายการลงคลิปบอร์ด`, 'info');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selectedEntries.length > 0) {
          e.preventDefault();
          setClipboard({
            mode: 'cut',
            sourceAdapter: activeTab.adapter,
            entries: selectedEntries,
            sourcePathString: activeTab.adapter.getPathString(),
          });
          showToast(`ตัด ${selectedEntries.length} รายการลงคลิปบอร์ด`, 'info');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handleClipboardPaste();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        updateTab(activePane, activeTab.id, (t) => ({
          ...t,
          selected: t.entries.map((item) => item.name),
        }));
      } else if (e.key === 'Delete') {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          setModal({ type: 'delete', entries: selectedEntries });
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleUp(activePane);
      } else if (e.key === ' ') {
        e.preventDefault();
        if (selectedEntries.length > 0) {
          const idx = activeTab.entries.findIndex((item) => item.name === selectedEntries[0].name);
          setModal({ type: 'quick-look', index: Math.max(0, idx) });
        }
      } else if (e.key === 'Enter' && selectedEntries.length === 1) {
        const target = selectedEntries[0];
        if (target.kind === 'directory') {
          activeTab.adapter.getChildAdapter(target.name).then((child) => {
            navigateTabAdapter(activePane, child, true);
          });
        } else {
          const idx = activeTab.entries.findIndex((item) => item.name === target.name);
          setModal({ type: 'quick-look', index: Math.max(0, idx) });
        }
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack(activePane);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleForward(activePane);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePane,
    activeTab,
    conflictPrompt,
    handleBack,
    handleClipboardPaste,
    handleForward,
    handleSwapPanes,
    handleUp,
    layoutMode,
    modal,
    navigateTabAdapter,
    paneTabs,
    refreshTab,
    selectedEntries,
    showToast,
    triggerCopyToOther,
    triggerMoveToOther,
    updateTab,
  ]);

  // Resizable Sidebar divider
  const startSidebarResizing = () => {
    const onMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const nextWidth = Math.min(380, Math.max(180, e.clientX - rect.left));
      setSidebarWidth(nextWidth);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Resizable Dual Pane divider
  const startResizing = () => {
    const onMove = (e: MouseEvent) => {
      if (!workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const effectiveSidebarWidth = sidebarVisible ? sidebarWidth : 44;
      const inspectorWidth = inspectorVisible ? 320 : 0;
      const available = Math.max(300, rect.width - effectiveSidebarWidth - inspectorWidth);
      const x = e.clientX - rect.left - effectiveSidebarWidth;
      const pct = Math.min(75, Math.max(25, (x / available) * 100));
      setLeftPaneRatio(pct);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Helper to render each pane
  const renderPane = (paneId: PaneId) => {
    const tab = getActiveTab(paneId);
    const currentVirtualPath =
      tab.adapter instanceof VirtualFSAdapter ? tab.adapter.path : null;
    const isFav =
      currentVirtualPath !== null &&
      favorites.some(
        (f) => f.adapterType === 'virtual' && f.path.join('/') === currentVirtualPath.join('/')
      );

    return (
      <FilePane
        key={paneId}
        paneId={paneId}
        isActive={activePane === paneId}
        tabs={paneTabs[paneId]}
        activeTabId={tab.id}
        tags={tags}
        activeTagFilter={activeTagFilter}
        isFavorited={isFav}
        compareMode={compareMode && layoutMode === 'dual'}
        compareMap={paneId === 'left' ? compareStats.leftStatus : compareStats.rightStatus}
        filterInputRef={filterInputRef}
        onFocusPane={() => setActivePane(paneId)}
        onSelectTab={(tabId) => setActiveTabIds((prev) => ({ ...prev, [paneId]: tabId }))}
        onAddTab={() => {
          const newTab = createTab(tab.adapter, tab.viewMode);
          setPaneTabs((prev) => ({ ...prev, [paneId]: [...prev[paneId], newTab] }));
          setActiveTabIds((prev) => ({ ...prev, [paneId]: newTab.id }));
          refreshTab(paneId, newTab.id, newTab.adapter);
        }}
        onCloseTab={(tabId) => {
          setPaneTabs((prev) => {
            const list = prev[paneId];
            if (list.length <= 1) return prev;
            const next = list.filter((t) => t.id !== tabId);
            if (activeTabIds[paneId] === tabId) {
              setActiveTabIds((ids) => ({ ...ids, [paneId]: next[next.length - 1].id }));
            }
            return { ...prev, [paneId]: next };
          });
        }}
        onToggleLockTab={(tabId) => {
          updateTab(paneId, tabId, (t) => ({ ...t, locked: !t.locked }));
        }}
        onMountLocal={() => handleMountLocalFolder(paneId)}
        onSwitchVirtual={() => {
          const v = new VirtualFSAdapter(virtualRootRef.current, [], persistVirtual);
          navigateTabAdapter(paneId, v, true);
        }}
        onToggleFavorite={() => {
          if (tab.adapter.type !== 'virtual') {
            showToast('สามารถปักหมุดโฟลเดอร์ได้บน VirtualDrive (V:)', 'info');
            return;
          }
          const vAdapter = tab.adapter as VirtualFSAdapter;
          const pathKey = vAdapter.path.join('/');
          const name = vAdapter.path[vAdapter.path.length - 1] || 'V: Root';
          setFavorites((prev) => {
            const exists = prev.some((f) => f.path.join('/') === pathKey);
            if (exists) return prev.filter((f) => f.path.join('/') !== pathKey);
            return [
              ...prev,
              { id: `fav_${Date.now()}`, name, adapterType: 'virtual', path: [...vAdapter.path] },
            ];
          });
        }}
        onBack={() => handleBack(paneId)}
        onForward={() => handleForward(paneId)}
        onUp={() => handleUp(paneId)}
        onNavigateBreadcrumb={(idx) => {
          const target = tab.adapter.navigateToBreadcrumb(idx);
          navigateTabAdapter(paneId, target, true);
        }}
        onNavigatePathText={(pathText) => {
          if (tab.adapter.type === 'virtual') {
            const clean = pathText
              .replace(/^V:\/*/, '')
              .split('/')
              .map((s) => s.trim())
              .filter(Boolean);
            const next = new VirtualFSAdapter(virtualRootRef.current, clean, persistVirtual);
            navigateTabAdapter(paneId, next, true);
          } else {
            showToast('กรุณาคลิก Breadcrumb เพื่อนำทางในโฟลเดอร์ PC Local', 'info');
          }
        }}
        onNavigateToAdapter={(nextAdapter) => navigateTabAdapter(paneId, nextAdapter, true)}
        onRefresh={() => refreshActiveTab(paneId)}
        onToggleSort={(field) => {
          updateTab(paneId, tab.id, (t) => {
            const nextAsc = t.sortBy === field ? !t.sortAsc : true;
            return {
              ...t,
              sortBy: field,
              sortAsc: nextAsc,
              entries: sortEntriesList(t.entries, field, nextAsc),
            };
          });
        }}
        onSetFilter={(val) => {
          updateTab(paneId, tab.id, (t) => ({ ...t, filter: val }));
          if (tab.searchRecursive) {
            refreshTab(paneId, tab.id, tab.adapter, { filter: val, recursive: true });
          }
        }}
        onToggleRecursiveSearch={() => {
          const nextRec = !tab.searchRecursive;
          updateTab(paneId, tab.id, (t) => ({ ...t, searchRecursive: nextRec }));
          refreshTab(paneId, tab.id, tab.adapter, {
            filter: tab.filter,
            recursive: nextRec,
          });
        }}
        onSetViewMode={(mode) => updateTab(paneId, tab.id, (t) => ({ ...t, viewMode: mode }))}
        onRowClick={(e, idx, entry) => {
          e.stopPropagation();
          setActivePane(paneId);
          const visible = tab.entries.filter((item) =>
            tab.filter.trim() && !tab.searchRecursive
              ? matchWildcardFilter(item.name, tab.filter)
              : true
          );

          updateTab(paneId, tab.id, (t) => {
            if (e.shiftKey && t.lastSelectedIndex !== -1) {
              const start = Math.min(t.lastSelectedIndex, idx);
              const end = Math.max(t.lastSelectedIndex, idx);
              const base = e.ctrlKey || e.metaKey ? new Set(t.selected) : new Set<string>();
              for (let i = start; i <= end; i++) {
                if (visible[i]) base.add(visible[i].name);
              }
              return { ...t, selected: Array.from(base) };
            }
            if (e.ctrlKey || e.metaKey) {
              const next = t.selected.includes(entry.name)
                ? t.selected.filter((n) => n !== entry.name)
                : [...t.selected, entry.name];
              return { ...t, selected: next, lastSelectedIndex: idx };
            }
            return { ...t, selected: [entry.name], lastSelectedIndex: idx };
          });
        }}
        onCheckboxClick={(e, idx, entry) => {
          e.stopPropagation();
          setActivePane(paneId);
          updateTab(paneId, tab.id, (t) => {
            const next = t.selected.includes(entry.name)
              ? t.selected.filter((n) => n !== entry.name)
              : [...t.selected, entry.name];
            return { ...t, selected: next, lastSelectedIndex: idx };
          });
        }}
        onSelectAll={(visibleNames) => {
          setActivePane(paneId);
          updateTab(paneId, tab.id, (t) => {
            const allSelected =
              visibleNames.length > 0 && visibleNames.every((n) => t.selected.includes(n));
            return { ...t, selected: allSelected ? [] : visibleNames };
          });
        }}
        onOpenEntry={async (entry) => {
          setActivePane(paneId);
          if (entry.kind === 'directory') {
            if (entry.relativePath && tab.adapter.type === 'virtual') {
              const v = tab.adapter as VirtualFSAdapter;
              const segs = [...v.path, ...entry.relativePath.split('/')];
              await navigateTabAdapter(
                paneId,
                new VirtualFSAdapter(virtualRootRef.current, segs, persistVirtual),
                true
              );
            } else {
              const child = await tab.adapter.getChildAdapter(entry.name);
              await navigateTabAdapter(paneId, child, true);
            }
          } else {
            const idx = tab.entries.findIndex((item) => item.name === entry.name);
            setModal({ type: 'quick-look', index: Math.max(0, idx) });
          }
        }}
        onQuickLook={() => {
          const selName = tab.selected[0];
          const idx = tab.entries.findIndex((item) => item.name === selName);
          if (idx >= 0) setModal({ type: 'quick-look', index: idx });
        }}
        onDragStartEntries={(entryName) => {
          setActivePane(paneId);
          const sel = tab.selected.includes(entryName)
            ? tab.entries.filter((e) => tab.selected.includes(e.name))
            : tab.entries.filter((e) => e.name === entryName);
          if (!tab.selected.includes(entryName)) {
            updateTab(paneId, tab.id, (t) => ({ ...t, selected: [entryName] }));
          }
          dragStateRef.current = { sourcePaneId: paneId, items: sel };
        }}
        onDropFromOtherPane={async (shiftKey, targetFolderName) => {
          const payload = dragStateRef.current;
          dragStateRef.current = null;
          if (!payload || payload.items.length === 0) return;

          const srcTab = getActiveTab(payload.sourcePaneId);
          let destAdapter = tab.adapter;
          if (targetFolderName) {
            destAdapter = await tab.adapter.getChildAdapter(targetFolderName);
          } else if (payload.sourcePaneId === paneId) {
            return;
          }

          if (shiftKey) {
            await executeTransfer(
              'move',
              srcTab.adapter,
              destAdapter,
              payload.items,
              payload.sourcePaneId,
              paneId
            );
          } else if (payload.sourcePaneId === paneId && targetFolderName) {
            await executeTransfer(
              'move',
              srcTab.adapter,
              destAdapter,
              payload.items,
              paneId,
              paneId
            );
          } else {
            setModal({
              type: 'drop-choice',
              srcPaneId: payload.sourcePaneId,
              destPaneId: paneId,
              items: payload.items,
              targetFolder: targetFolderName,
            });
          }
        }}
        onDropExternalFiles={(files) => handleExternalFiles(paneId, files)}
        onUploadFiles={(files) => handleExternalFiles(paneId, files)}
        onContextMenu={(e, entry) => {
          e.preventDefault();
          e.stopPropagation();
          setActivePane(paneId);
          if (!tab.selected.includes(entry.name)) {
            updateTab(paneId, tab.id, (t) => ({ ...t, selected: [entry.name] }));
          }
          setContextMenu({ x: e.clientX, y: e.clientY, paneId, entry });
        }}
        onCopyPath={(p) => {
          navigator.clipboard?.writeText(p).catch(() => undefined);
          showToast(`คัดลอก Path "${p}" แล้ว`, 'info');
        }}
        onMillerSelect={(names) => {
          updateTab(paneId, tab.id, (t) => ({ ...t, selected: names }));
        }}
      />
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50 text-slate-900 dark:bg-[#0f1217] dark:text-slate-100">
      {/* TOP BAR CONTRACT: Brand — Navigation/Layout — Primary Action */}
      <header className="h-12 px-4 border-b border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#14171d] flex items-center justify-between gap-8 shrink-0">
        {/* Zone 1: Single-line Wordmark */}
        <div className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          CommanderWeb
        </div>

        {/* Zone 2: Clean Layout & Panel Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setSidebarVisible((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              sidebarVisible ? 'text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PanelLeft className="w-3.5 h-3.5" />
            <span>Sidebar</span>
          </button>

          <button
            onClick={() => setLayoutMode('dual')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              layoutMode === 'dual' ? 'text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>Dual Pane</span>
          </button>

          <button
            onClick={() => setLayoutMode('single')}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              layoutMode === 'single' ? 'text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Square className="w-3.5 h-3.5" />
            <span>Single Pane</span>
          </button>

          <button
            onClick={() => setInspectorVisible((v) => !v)}
            className={`flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
              inspectorVisible ? 'text-blue-600 dark:text-blue-400' : 'hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            onClick={() => setModal({ type: 'help' })}
            className="flex items-center gap-1.5 whitespace-nowrap shrink-0 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Shortcuts</span>
          </button>
        </nav>

        {/* Zone 3: Theme Switch */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setDarkMode((d) => !d)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#2c3240] bg-slate-100 dark:bg-[#1b2029] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#232935] whitespace-nowrap shrink-0 transition-colors"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </header>

      {/* COMMAND TOOLBAR RIBBON */}
      <div className="px-3 py-1.5 border-b border-slate-200 dark:border-[#262b35] bg-slate-50 dark:bg-[#12151b] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={triggerCopyToOther}
          disabled={layoutMode !== 'dual'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy</span>
          <kbd className="text-[10px] font-mono opacity-80 hidden sm:inline">F5</kbd>
        </button>

        <button
          onClick={triggerMoveToOther}
          disabled={layoutMode !== 'dual'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
        >
          <MoveRight className="w-3.5 h-3.5" />
          <span>Move</span>
          <kbd className="text-[10px] font-mono opacity-80 hidden sm:inline">F6</kbd>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-[#2c3240] mx-1 shrink-0" />

        <button
          onClick={() => setModal({ type: 'new-folder' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] whitespace-nowrap shrink-0 transition-colors"
        >
          <FolderPlus className="w-3.5 h-3.5 text-emerald-500" />
          <span>New Folder</span>
        </button>

        <button
          onClick={() => setModal({ type: 'new-file' })}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] whitespace-nowrap shrink-0 transition-colors"
        >
          <FilePlus className="w-3.5 h-3.5 text-sky-500" />
          <span>New File</span>
        </button>

        <button
          onClick={() => {
            if (selectedEntries.length === 1) {
              setModal({ type: 'rename', entry: selectedEntries[0] });
            } else {
              showToast('กรุณาเลือก 1 รายการเพื่อเปลี่ยนชื่อ', 'warning');
            }
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] whitespace-nowrap shrink-0 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-blue-500" />
          <span>Rename</span>
        </button>

        <button
          onClick={() => {
            const targets = selectedEntries.length > 0 ? selectedEntries : activeTab.entries;
            if (targets.length === 0) {
              showToast('ไม่มีไฟล์ให้เปลี่ยนชื่อในโฟลเดอร์นี้', 'warning');
              return;
            }
            setModal({ type: 'batch-rename', entries: targets });
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] whitespace-nowrap shrink-0 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Batch Rename</span>
        </button>

        <button
          onClick={() => {
            if (selectedEntries.length === 0) {
              showToast('กรุณาเลือกรายการที่ต้องการลบ', 'warning');
              return;
            }
            setModal({ type: 'delete', entries: selectedEntries });
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 whitespace-nowrap shrink-0 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-[#2c3240] mx-1 shrink-0" />

        {clipboard && (
          <button
            onClick={handleClipboardPaste}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-600/15 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600/25 whitespace-nowrap shrink-0 transition-colors"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>Paste ({clipboard.entries.length})</span>
          </button>
        )}

        <button
          onClick={() => handleDownloadEntries(activeTab.adapter, selectedEntries)}
          disabled={selectedEntries.length === 0}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] disabled:opacity-40 whitespace-nowrap shrink-0 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export ZIP</span>
        </button>

        {layoutMode === 'dual' && (
          <>
            <button
              onClick={() => setCompareMode((c) => !c)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                compareMode
                  ? 'bg-blue-600/15 text-blue-600 dark:text-blue-300 border border-blue-500/30'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d]'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare</span>
            </button>

            {compareMode && (
              <button
                onClick={() => setModal({ type: 'compare-sync' })}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap shrink-0"
              >
                Sync Panes...
              </button>
            )}

            <button
              onClick={handleSwapPanes}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f242d] whitespace-nowrap shrink-0 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Swap</span>
            </button>
          </>
        )}
      </div>

      {/* MAIN WORKSPACE */}
      <main ref={workspaceRef} className="flex-1 flex overflow-hidden relative">
        <Sidebar
          visible={sidebarVisible}
          width={sidebarWidth}
          currentPathString={activeTab.adapter.getPathString()}
          virtualRoot={virtualRootRef.current}
          driveSlots={driveSlots}
          mountedLocals={mountedLocals}
          favorites={favorites}
          shelf={shelf}
          activeTagFilter={activeTagFilter}
          tagCounts={tagCounts}
          onToggleCollapse={() => setSidebarVisible((v) => !v)}
          onOpenVirtualPath={(path) => {
            const v = new VirtualFSAdapter(virtualRootRef.current, path, persistVirtual);
            navigateTabAdapter(activePane, v, true);
          }}
          onOpenDriveSlot={handleOpenDriveSlot}
          onUnlinkDriveSlot={handleUnlinkDriveSlot}
          onOpenLocalAdapter={(localAdapter) => {
            navigateTabAdapter(activePane, localAdapter, true);
          }}
          onOpenTrash={() => {
            const v = new VirtualFSAdapter(virtualRootRef.current, ['.Trash'], persistVirtual);
            navigateTabAdapter(activePane, v, true);
          }}
          onMountLocal={() => handleMountLocalFolder(activePane)}
          onOpenFavorite={(fav) => {
            const v = new VirtualFSAdapter(virtualRootRef.current, fav.path, persistVirtual);
            navigateTabAdapter(activePane, v, true);
          }}
          onRemoveFavorite={(id) => setFavorites((prev) => prev.filter((f) => f.id !== id))}
          onSelectTagFilter={(t) => setActiveTagFilter(t)}
          onShelfCopyHere={async () => {
            for (const item of shelf) {
              await executeTransfer(
                'copy',
                item.sourceAdapter,
                activeTab.adapter,
                [item.entry],
                undefined,
                activePane
              );
            }
          }}
          onShelfMoveHere={async () => {
            for (const item of shelf) {
              await executeTransfer(
                'move',
                item.sourceAdapter,
                activeTab.adapter,
                [item.entry],
                undefined,
                activePane
              );
            }
            setShelf([]);
          }}
          onRemoveShelfItem={(id) => setShelf((prev) => prev.filter((i) => i.id !== id))}
          onClearShelf={() => setShelf([])}
          onDropToShelf={() => {
            const payload = dragStateRef.current;
            dragStateRef.current = null;
            if (!payload || payload.items.length === 0) return;
            const srcTab = getActiveTab(payload.sourcePaneId);
            setShelf((prev) => {
              const existing = new Set(prev.map((i) => i.id));
              const additions: ShelfItem[] = [];
              for (const entry of payload.items) {
                const id = `${srcTab.adapter.getPathString()}::${entry.name}`;
                if (!existing.has(id)) {
                  additions.push({
                    id,
                    sourceAdapter: srcTab.adapter,
                    entry,
                    sourcePathString: srcTab.adapter.getPathString(),
                  });
                }
              }
              return [...prev, ...additions];
            });
            showToast(`เพิ่ม ${payload.items.length} รายการเข้า Drop Shelf`, 'info');
          }}
          onResetSandbox={() => {
            virtualRootRef.current = createInitialVirtualRoot();
            persistVirtual();
            const leftV = new VirtualFSAdapter(virtualRootRef.current, ['Documents'], persistVirtual);
            const rightV = new VirtualFSAdapter(virtualRootRef.current, ['Backup_Archive'], persistVirtual);
            navigateTabAdapter('left', leftV, false);
            navigateTabAdapter('right', rightV, false);
            showToast('รีเซ็ต VirtualDrive (V:) กลับสู่ค่าเริ่มต้นแล้ว', 'success');
          }}
        />

        {sidebarVisible && (
          <div
            onMouseDown={startSidebarResizing}
            title="ลากเพื่อปรับความกว้างแผงด้านซ้าย"
            className="w-1 bg-transparent hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
          />
        )}

        {/* PANES CONTAINER */}
        <div className="flex-1 min-w-0 flex flex-col lg:flex-row overflow-hidden">
          {layoutMode === 'single' ? (
            renderPane(activePane)
          ) : (
            <>
              <div
                style={{ flex: `0 0 ${leftPaneRatio}%` }}
                className="min-w-0 min-h-0 flex flex-col overflow-hidden"
              >
                {renderPane('left')}
              </div>

              <div
                onMouseDown={startResizing}
                title="ลากเพื่อปรับขนาดหน้าต่างซ้าย-ขวา"
                className="hidden lg:block w-1.5 bg-slate-200 dark:bg-[#0f1217] hover:bg-blue-500 cursor-col-resize shrink-0 transition-colors"
              />

              <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
                {renderPane('right')}
              </div>
            </>
          )}
        </div>

        <InspectorPanel
          visible={inspectorVisible}
          adapter={activeTab.adapter}
          entries={activeTab.entries}
          selectedEntries={selectedEntries}
          tags={tags}
          onClose={() => setInspectorVisible(false)}
          onSetTag={handleSetTag}
          onCopyToOther={triggerCopyToOther}
          onMoveToOther={triggerMoveToOther}
          onDownloadSelected={() => handleDownloadEntries(activeTab.adapter, selectedEntries)}
          onOpenQuickLook={() => {
            if (selectedEntries.length > 0) {
              const idx = activeTab.entries.findIndex((e) => e.name === selectedEntries[0].name);
              setModal({ type: 'quick-look', index: Math.max(0, idx) });
            }
          }}
          onSaveTextEdit={async (entry, newContent) => {
            const blob = new Blob([newContent], { type: entry.mimeType || 'text/plain' });
            await activeTab.adapter.writeFileFromBlob(entry.name, blob, Date.now());
            await refreshActiveTab(activePane);
            addLog(`บันทึกการแก้ไขไฟล์ "${entry.name}"`, 'success');
            showToast(`บันทึก "${entry.name}" สำเร็จ`, 'success');
          }}
        />
      </main>

      {/* BOTTOM TRANSFER PROGRESS & ACTIVITY BAR */}
      <footer className="border-t border-slate-200 dark:border-[#262b35] bg-white dark:bg-[#14171d] shrink-0">
        <div className="px-3.5 py-1.5 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {transfer.active ? (
              <div className="flex items-center gap-2.5 flex-1 max-w-md">
                <span className="font-medium text-blue-600 dark:text-blue-400 truncate">
                  {transfer.label}
                </span>
                <div className="w-32 h-1.5 rounded-full bg-slate-200 dark:bg-[#262b35] overflow-hidden shrink-0">
                  <div
                    className="h-full bg-blue-500 transition-all duration-150"
                    style={{ width: `${transfer.percent}%` }}
                  />
                </div>
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  {transfer.percent}%
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 truncate">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {activePane === 'left' ? 'Left Pane' : 'Right Pane'}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate font-mono text-[11px]">
                  {activeTab.adapter.getPathString()}
                </span>
                {logs[0] && (
                  <>
                    <span className="hidden md:inline" aria-hidden="true">
                      ·
                    </span>
                    <span className="hidden md:inline truncate text-[11px]">
                      {logs[0].message}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => setLogsOpen((o) => !o)}
            className="px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-[#1b2029] hover:bg-slate-200 dark:hover:bg-[#232935] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#262b35] whitespace-nowrap shrink-0 tabular-nums"
          >
            ประวัติการทำงาน ({logs.length})
          </button>
        </div>

        {logsOpen && (
          <div className="max-h-32 overflow-y-auto border-t border-slate-200 dark:border-[#262b35] bg-slate-50 dark:bg-[#0f1217] px-4 py-2 font-mono text-[11px] space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-400">ยังไม่มีประวัติการทำงาน</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="text-slate-600 dark:text-slate-300">
                  [{new Date(l.timestamp).toLocaleTimeString('th-TH')}] {l.message}
                </div>
              ))
            )}
          </div>
        )}
      </footer>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          entry={contextMenu.entry}
          selectedCount={getActiveTab(contextMenu.paneId).selected.length}
          onClose={() => setContextMenu(null)}
          onOpen={async () => {
            const tab = getActiveTab(contextMenu.paneId);
            if (contextMenu.entry.kind === 'directory') {
              const child = await tab.adapter.getChildAdapter(contextMenu.entry.name);
              navigateTabAdapter(contextMenu.paneId, child, true);
            }
          }}
          onOpenInNewTab={async () => {
            const tab = getActiveTab(contextMenu.paneId);
            const child = await tab.adapter.getChildAdapter(contextMenu.entry.name);
            const newTab = createTab(child, tab.viewMode);
            setPaneTabs((prev) => ({
              ...prev,
              [contextMenu.paneId]: [...prev[contextMenu.paneId], newTab],
            }));
            setActiveTabIds((prev) => ({ ...prev, [contextMenu.paneId]: newTab.id }));
            refreshTab(contextMenu.paneId, newTab.id, child);
          }}
          onQuickLook={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const idx = tab.entries.findIndex((e) => e.name === contextMenu.entry.name);
            setModal({ type: 'quick-look', index: Math.max(0, idx) });
          }}
          onCopyToOther={triggerCopyToOther}
          onMoveToOther={triggerMoveToOther}
          onClipboardCopy={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            setClipboard({
              mode: 'copy',
              sourceAdapter: tab.adapter,
              entries: items,
              sourcePathString: tab.adapter.getPathString(),
            });
            showToast(`คัดลอก ${items.length} รายการลงคลิปบอร์ด`, 'info');
          }}
          onClipboardCut={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            setClipboard({
              mode: 'cut',
              sourceAdapter: tab.adapter,
              entries: items,
              sourcePathString: tab.adapter.getPathString(),
            });
            showToast(`ตัด ${items.length} รายการลงคลิปบอร์ด`, 'info');
          }}
          onRename={() => setModal({ type: 'rename', entry: contextMenu.entry })}
          onBatchRename={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            setModal({
              type: 'batch-rename',
              entries: items.length > 0 ? items : [contextMenu.entry],
            });
          }}
          onAddToShelf={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            setShelf((prev) => {
              const existing = new Set(prev.map((i) => i.id));
              const add: ShelfItem[] = [];
              for (const entry of items) {
                const id = `${tab.adapter.getPathString()}::${entry.name}`;
                if (!existing.has(id)) {
                  add.push({
                    id,
                    sourceAdapter: tab.adapter,
                    entry,
                    sourcePathString: tab.adapter.getPathString(),
                  });
                }
              }
              return [...prev, ...add];
            });
            showToast(`เพิ่มเข้า Drop Shelf แล้ว`, 'info');
          }}
          onDownload={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            handleDownloadEntries(tab.adapter, items);
          }}
          onSetTag={(tag) => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            handleSetTag(items, tag);
          }}
          onDelete={() => {
            const tab = getActiveTab(contextMenu.paneId);
            const items = tab.entries.filter((e) => tab.selected.includes(e.name));
            setModal({ type: 'delete', entries: items });
          }}
        />
      )}

      {/* MODALS */}
      {modal?.type === 'new-folder' && (
        <InputModal
          title="สร้างโฟลเดอร์ใหม่ (New Folder)"
          subtitle={activeTab.adapter.getPathString()}
          defaultValue="New Folder"
          confirmLabel="สร้างโฟลเดอร์"
          icon="folder"
          onClose={() => setModal(null)}
          onConfirm={async (name) => {
            try {
              await activeTab.adapter.createDirectory(name);
              setModal(null);
              await refreshActiveTab(activePane);
              addLog(`สร้างโฟลเดอร์ "${name}"`, 'success');
              showToast(`สร้างโฟลเดอร์ "${name}" สำเร็จ`, 'success');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'สร้างโฟลเดอร์ไม่สำเร็จ', 'error');
            }
          }}
        />
      )}

      {modal?.type === 'new-file' && (
        <InputModal
          title="สร้างไฟล์ใหม่ (New File)"
          subtitle={activeTab.adapter.getPathString()}
          defaultValue="untitled.md"
          selectBasename
          confirmLabel="สร้างไฟล์"
          icon="file"
          onClose={() => setModal(null)}
          onConfirm={async (name) => {
            try {
              await activeTab.adapter.createFile(name, '');
              setModal(null);
              await refreshActiveTab(activePane);
              updateTab(activePane, activeTab.id, (t) => ({ ...t, selected: [name] }));
              addLog(`สร้างไฟล์ "${name}"`, 'success');
              showToast(`สร้างไฟล์ "${name}" สำเร็จ`, 'success');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'สร้างไฟล์ไม่สำเร็จ', 'error');
            }
          }}
        />
      )}

      {modal?.type === 'rename' && (
        <InputModal
          title="เปลี่ยนชื่อ (Rename)"
          subtitle={`ชื่อเดิม: ${modal.entry.name}`}
          defaultValue={modal.entry.name}
          selectBasename={modal.entry.kind === 'file'}
          confirmLabel="บันทึกชื่อใหม่"
          icon="edit"
          onClose={() => setModal(null)}
          onConfirm={async (newName) => {
            try {
              await activeTab.adapter.renameEntry(modal.entry.name, newName);
              setModal(null);
              await refreshActiveTab(activePane);
              updateTab(activePane, activeTab.id, (t) => ({ ...t, selected: [newName] }));
              addLog(`เปลี่ยนชื่อ "${modal.entry.name}" เป็น "${newName}"`, 'success');
              showToast(`เปลี่ยนชื่อเป็น "${newName}" สำเร็จ`, 'success');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'เปลี่ยนชื่อไม่สำเร็จ', 'error');
            }
          }}
        />
      )}

      {modal?.type === 'batch-rename' && (
        <BatchRenameModal
          entries={modal.entries}
          onClose={() => setModal(null)}
          onApply={async (renames) => {
            for (const pair of renames) {
              await activeTab.adapter.renameEntry(pair.oldName, pair.newName);
            }
            await refreshActiveTab(activePane);
            addLog(`Batch Rename สำเร็จ ${renames.length} รายการ`, 'success');
            showToast(`เปลี่ยนชื่อ ${renames.length} รายการเรียบร้อย`, 'success');
          }}
        />
      )}

      {modal?.type === 'delete' && (
        <DeleteModal
          entries={modal.entries}
          isLocal={activeTab.adapter.type === 'local'}
          isInTrash={activeTab.adapter.getPathString().includes('.Trash')}
          onClose={() => setModal(null)}
          onConfirm={async (permanent) => {
            setModal(null);
            try {
              for (const item of modal.entries) {
                if (!permanent && activeTab.adapter instanceof VirtualFSAdapter) {
                  await activeTab.adapter.moveToTrash(item.name);
                } else {
                  await activeTab.adapter.deleteEntry(item.name);
                }
              }
              await refreshActiveTab(activePane);
              addLog(
                `${permanent ? 'ลบถาวร' : 'ย้ายลงถังขยะ'} ${modal.entries.length} รายการ`,
                'success'
              );
              showToast(
                `${permanent ? 'ลบข้อมูล' : 'ย้ายลงถังขยะ'} ${modal.entries.length} รายการแล้ว`,
                'success'
              );
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'ลบข้อมูลไม่สำเร็จ', 'error');
            }
          }}
        />
      )}

      {modal?.type === 'drop-choice' && (
        <DropChoiceModal
          count={modal.items.length}
          onClose={() => setModal(null)}
          onChoose={async (mode) => {
            const { srcPaneId, destPaneId, items, targetFolder } = modal;
            setModal(null);
            const srcTab = getActiveTab(srcPaneId);
            const destTab = getActiveTab(destPaneId);
            const destAdapter = targetFolder
              ? await destTab.adapter.getChildAdapter(targetFolder)
              : destTab.adapter;
            await executeTransfer(
              mode,
              srcTab.adapter,
              destAdapter,
              items,
              srcPaneId,
              destPaneId
            );
          }}
        />
      )}

      {modal?.type === 'compare-sync' && (
        <CompareSyncModal
          onlyLeft={compareStats.onlyLeft}
          onlyRight={compareStats.onlyRight}
          newerLeft={compareStats.newerLeft}
          newerRight={compareStats.newerRight}
          onClose={() => setModal(null)}
          onSyncLeftToRight={async () => {
            setModal(null);
            const leftTab = getActiveTab('left');
            const rightTab = getActiveTab('right');
            const items = leftTab.entries.filter((e) => {
              const st = compareStats.leftStatus[e.name];
              return st === 'only-left' || st === 'newer';
            });
            await executeTransfer('copy', leftTab.adapter, rightTab.adapter, items, 'left', 'right');
          }}
          onSyncRightToLeft={async () => {
            setModal(null);
            const leftTab = getActiveTab('left');
            const rightTab = getActiveTab('right');
            const items = rightTab.entries.filter((e) => {
              const st = compareStats.rightStatus[e.name];
              return st === 'only-right' || st === 'newer';
            });
            await executeTransfer('copy', rightTab.adapter, leftTab.adapter, items, 'right', 'left');
          }}
        />
      )}

      {modal?.type === 'quick-look' && (
        <QuickLookModal
          adapter={activeTab.adapter}
          entries={activeTab.entries}
          currentIndex={modal.index}
          onChangeIndex={(idx) => setModal({ type: 'quick-look', index: idx })}
          onDownload={(entry) => handleDownloadEntries(activeTab.adapter, [entry])}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === 'help' && <HelpModal onClose={() => setModal(null)} />}

      {modal?.type === 'alert' && (
        <AlertModal title={modal.title} message={modal.message} onClose={() => setModal(null)} />
      )}

      {conflictPrompt && (
        <ConflictModal
          conflicts={conflictPrompt.conflicts}
          onResolve={(strategy) => {
            conflictPrompt.resolve(strategy);
            setConflictPrompt(null);
          }}
        />
      )}

      {/* TOASTS */}
      <div className="fixed bottom-10 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cls =
            t.type === 'success'
              ? 'bg-emerald-600 text-white'
              : t.type === 'error'
                ? 'bg-rose-600 text-white'
                : t.type === 'warning'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-800 dark:bg-[#1e2430] text-white border border-slate-700';
          return (
            <div
              key={t.id}
              className={`px-4 py-2 rounded-xl shadow-lg text-xs font-medium ${cls}`}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </div>
  );
}
