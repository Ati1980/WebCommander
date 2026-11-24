export type PaneId = 'left' | 'right';

export type LayoutMode = 'dual' | 'single';

export type ViewMode = 'list' | 'grid' | 'columns';

export type SortField = 'name' | 'size' | 'type' | 'date';

export type ColorTag =
  | 'none'
  | 'red'
  | 'rose'
  | 'pink'
  | 'orange'
  | 'amber'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'fuchsia';

export type ConflictStrategy = 'overwrite' | 'rename' | 'skip';

export type CompareStatus = 'only-left' | 'only-right' | 'newer' | 'older' | 'different' | 'same';

export interface BreadcrumbItem {
  name: string;
  path?: string[];
  stackIndex?: number;
}

export interface FileEntry {
  name: string;
  kind: 'file' | 'directory';
  size: number;
  lastModified: number;
  mimeType: string;
  pathKey: string;
  relativePath?: string; // populated during recursive search
  raw: unknown;
}

export interface FileAdapter {
  type: 'virtual' | 'local';
  getRootName(): string;
  getPathString(): string;
  getBreadcrumbs(): BreadcrumbItem[];
  listEntries(): Promise<FileEntry[]>;
  searchRecursive(query: string, maxResults?: number): Promise<FileEntry[]>;
  createDirectory(name: string): Promise<void>;
  createFile(name: string, content?: string): Promise<void>;
  renameEntry(oldName: string, newName: string): Promise<void>;
  deleteEntry(name: string): Promise<void>;
  hasEntry(name: string): Promise<boolean>;
  readFileBlob(entry: FileEntry): Promise<Blob>;
  writeFileFromBlob(name: string, blob: Blob, lastModified?: number): Promise<void>;
  getChildAdapter(dirName: string): Promise<FileAdapter>;
  navigateToBreadcrumb(index: number): FileAdapter;
}

export interface TabState {
  id: string;
  title: string;
  adapter: FileAdapter;
  history: FileAdapter[];
  historyIndex: number;
  entries: FileEntry[];
  selected: string[];
  lastSelectedIndex: number;
  sortBy: SortField;
  sortAsc: boolean;
  filter: string;
  searchRecursive: boolean;
  viewMode: ViewMode;
  loading: boolean;
  locked: boolean;
  error?: string | null;
}

export interface FavoriteItem {
  id: string;
  name: string;
  adapterType: 'virtual' | 'local';
  path: string[];
}

export interface ShelfItem {
  id: string;
  sourceAdapter: FileAdapter;
  entry: FileEntry;
  sourcePathString: string;
}

export interface ClipboardState {
  mode: 'copy' | 'cut';
  sourceAdapter: FileAdapter;
  entries: FileEntry[];
  sourcePathString: string;
}

export interface TaskLog {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

export interface TransferProgress {
  active: boolean;
  label: string;
  percent: number;
}

export interface BatchRenameRule {
  findText: string;
  replaceText: string;
  useRegex: boolean;
  caseSensitive: boolean;
  prefix: string;
  suffix: string;
  caseMode: 'keep' | 'lower' | 'upper' | 'title';
  useCounter: boolean;
  counterStart: number;
  counterStep: number;
  counterDigits: number;
  counterPosition: 'prefix' | 'suffix' | 'replace';
  newExtension: string;
}
