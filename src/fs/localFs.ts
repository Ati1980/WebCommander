import { BreadcrumbItem, FileAdapter, FileEntry } from '../types/files';
import { guessMimeType } from '../utils/format';

export interface LocalStackItem {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export class LocalFSAdapter implements FileAdapter {
  public type = 'local' as const;
  public rootHandle: FileSystemDirectoryHandle;
  public stack: LocalStackItem[];

  constructor(rootHandle: FileSystemDirectoryHandle, stack: LocalStackItem[] = []) {
    this.rootHandle = rootHandle;
    this.stack = stack.length > 0 ? stack : [{ name: rootHandle.name, handle: rootHandle }];
  }

  getRootName(): string {
    return this.rootHandle.name;
  }

  getPathString(): string {
    return this.stack.map((s) => s.name).join('/');
  }

  getCurrentHandle(): FileSystemDirectoryHandle {
    return this.stack[this.stack.length - 1].handle;
  }

  getBreadcrumbs(): BreadcrumbItem[] {
    return this.stack.map((item, idx) => ({
      name: item.name,
      stackIndex: idx,
    }));
  }

  async listEntries(): Promise<FileEntry[]> {
    const dirHandle = this.getCurrentHandle();
    const items: FileEntry[] = [];
    const basePath = this.getPathString();

    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file') {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          items.push({
            name,
            kind: 'file',
            size: file.size,
            lastModified: file.lastModified,
            mimeType: file.type || guessMimeType(name),
            pathKey: `local:${basePath}/${name}`,
            raw: handle,
          });
        } catch {
          items.push({
            name,
            kind: 'file',
            size: 0,
            lastModified: Date.now(),
            mimeType: guessMimeType(name),
            pathKey: `local:${basePath}/${name}`,
            raw: handle,
          });
        }
      } else {
        items.push({
          name,
          kind: 'directory',
          size: 0,
          lastModified: Date.now(),
          mimeType: '',
          pathKey: `local:${basePath}/${name}`,
          raw: handle,
        });
      }
    }
    return items;
  }

  async searchRecursive(query: string, maxResults = 120): Promise<FileEntry[]> {
    const q = query.trim().toLowerCase();
    const results: FileEntry[] = [];
    const basePath = this.getPathString();

    const walk = async (dirHandle: FileSystemDirectoryHandle, relParts: string[]) => {
      if (results.length >= maxResults) return;
      for await (const [name, handle] of dirHandle.entries()) {
        if (results.length >= maxResults) return;
        const nextRel = [...relParts, name];
        const relStr = nextRel.join('/');
        if (!q || name.toLowerCase().includes(q)) {
          if (handle.kind === 'file') {
            try {
              const file = await (handle as FileSystemFileHandle).getFile();
              results.push({
                name,
                kind: 'file',
                size: file.size,
                lastModified: file.lastModified,
                mimeType: file.type || guessMimeType(name),
                pathKey: `local:${basePath}/${relStr}`,
                relativePath: relStr,
                raw: handle,
              });
            } catch {
              results.push({
                name,
                kind: 'file',
                size: 0,
                lastModified: Date.now(),
                mimeType: guessMimeType(name),
                pathKey: `local:${basePath}/${relStr}`,
                relativePath: relStr,
                raw: handle,
              });
            }
          } else {
            results.push({
              name,
              kind: 'directory',
              size: 0,
              lastModified: Date.now(),
              mimeType: '',
              pathKey: `local:${basePath}/${relStr}`,
              relativePath: relStr,
              raw: handle,
            });
          }
        }
        if (handle.kind === 'directory') {
          await walk(handle as FileSystemDirectoryHandle, nextRel);
        }
      }
    };

    await walk(this.getCurrentHandle(), []);
    return results;
  }

  async createDirectory(name: string): Promise<void> {
    const dirHandle = this.getCurrentHandle();
    await dirHandle.getDirectoryHandle(name, { create: true });
  }

  async createFile(name: string, content = ''): Promise<void> {
    const blob = new Blob([content], { type: guessMimeType(name) });
    await this.writeFileFromBlob(name, blob);
  }

  async hasEntry(name: string): Promise<boolean> {
    const dirHandle = this.getCurrentHandle();
    try {
      await dirHandle.getFileHandle(name);
      return true;
    } catch {
      try {
        await dirHandle.getDirectoryHandle(name);
        return true;
      } catch {
        return false;
      }
    }
  }

  async renameEntry(oldName: string, newName: string): Promise<void> {
    if (oldName === newName) return;
    const dirHandle = this.getCurrentHandle();
    let entryHandle: FileSystemHandle;
    try {
      entryHandle = await dirHandle.getFileHandle(oldName);
    } catch {
      entryHandle = await dirHandle.getDirectoryHandle(oldName);
    }

    const movable = entryHandle as FileSystemHandle & { move?: (newName: string) => Promise<void> };
    if (typeof movable.move === 'function') {
      await movable.move(newName);
    } else {
      await copyEntryBetweenAdapters(
        this,
        {
          name: oldName,
          kind: entryHandle.kind,
          size: 0,
          lastModified: Date.now(),
          mimeType: guessMimeType(oldName),
          pathKey: `local:${this.getPathString()}/${oldName}`,
          raw: entryHandle,
        },
        this,
        newName
      );
      await this.deleteEntry(oldName);
    }
  }

  async deleteEntry(name: string): Promise<void> {
    const dirHandle = this.getCurrentHandle();
    await dirHandle.removeEntry(name, { recursive: true });
  }

  async readFileBlob(entry: FileEntry): Promise<Blob> {
    const handle = entry.raw as FileSystemFileHandle;
    return await handle.getFile();
  }

  async writeFileFromBlob(name: string, blob: Blob): Promise<void> {
    const dirHandle = this.getCurrentHandle();
    const fileHandle = await dirHandle.getFileHandle(name, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
  }

  async getChildAdapter(dirName: string): Promise<FileAdapter> {
    const dirHandle = this.getCurrentHandle();
    const childHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
    return new LocalFSAdapter(this.rootHandle, [...this.stack, { name: dirName, handle: childHandle }]);
  }

  navigateToBreadcrumb(index: number): FileAdapter {
    const newStack = this.stack.slice(0, index + 1);
    return new LocalFSAdapter(this.rootHandle, newStack);
  }
}

export async function copyEntryBetweenAdapters(
  srcAdapter: FileAdapter,
  entry: FileEntry,
  destAdapter: FileAdapter,
  targetName: string = entry.name,
  onProgress?: (name: string) => void
): Promise<void> {
  if (entry.kind === 'file') {
    const blob = await srcAdapter.readFileBlob(entry);
    await destAdapter.writeFileFromBlob(targetName, blob, entry.lastModified);
    onProgress?.(targetName);
  } else {
    await destAdapter.createDirectory(targetName).catch(() => undefined);
    const childSrc = await srcAdapter.getChildAdapter(entry.name);
    const childDest = await destAdapter.getChildAdapter(targetName);
    const children = await childSrc.listEntries();
    for (const child of children) {
      await copyEntryBetweenAdapters(childSrc, child, childDest, child.name, onProgress);
    }
    onProgress?.(`${targetName}/`);
  }
}

export async function generateUniqueName(
  adapter: FileAdapter,
  originalName: string
): Promise<string> {
  const dotIdx = originalName.lastIndexOf('.');
  const base = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;
  const ext = dotIdx > 0 ? originalName.slice(dotIdx) : '';
  let counter = 1;
  let candidate = `${base} (${counter})${ext}`;
  while (await adapter.hasEntry(candidate)) {
    counter++;
    candidate = `${base} (${counter})${ext}`;
  }
  return candidate;
}

export async function calculateFolderStats(
  adapter: FileAdapter,
  dirName: string
): Promise<{ files: number; folders: number; totalSize: number }> {
  let files = 0;
  let folders = 0;
  let totalSize = 0;

  const walk = async (curr: FileAdapter) => {
    const entries = await curr.listEntries();
    for (const e of entries) {
      if (e.kind === 'file') {
        files++;
        totalSize += e.size;
      } else {
        folders++;
        const child = await curr.getChildAdapter(e.name);
        await walk(child);
      }
    }
  };

  const target = await adapter.getChildAdapter(dirName);
  await walk(target);
  return { files, folders, totalSize };
}
