import { BreadcrumbItem, FileAdapter, FileEntry } from '../types/files';
import { guessMimeType } from '../utils/format';

export interface VirtualNode {
  name: string;
  kind: 'file' | 'directory';
  size?: number;
  lastModified: number;
  mimeType?: string;
  content?: string;
  blob?: Blob;
  children?: Record<string, VirtualNode>;
}

const STORAGE_KEY = 'commanderweb_virtual_fs_v1';

export function createInitialVirtualRoot(): VirtualNode {
  const now = Date.now();
  return {
    name: 'VirtualDrive (V:)',
    kind: 'directory',
    lastModified: now - 86400000 * 7,
    children: {
      Documents: {
        name: 'Documents',
        kind: 'directory',
        lastModified: now - 86400000 * 2,
        children: {
          'Project_Proposal_2026.md': {
            name: 'Project_Proposal_2026.md',
            kind: 'file',
            size: 1024,
            lastModified: now - 3600000 * 4,
            mimeType: 'text/markdown',
            content: `# แผนงานพัฒนาเว็บไซต์องค์กร 2026

## 1. วัตถุประสงค์หลัก
- ยกระดับการจัดการไฟล์ด้วย **Dual-Pane** และ **Miller Columns**
- รองรับ **Batch Rename** และ **Folder Sync** ภายในเบราว์เซอร์
- เชื่อมต่อโฟลเดอร์จริงในเครื่องผ่าน **File System Access API**

## 2. ขอบเขตการทำงาน
1. การคัดลอก (F5) และย้ายไฟล์ (F6) ข้ามหน้าต่างแบบมี Conflict Resolution
2. ระบบ Drop Shelf สำหรับรวบรวมไฟล์จากหลายโฟลเดอร์
3. แผง Quick Preview สำหรับรูปภาพ, Markdown, CSV และโค้ด พร้อมแก้ไขได้ทันที

> สถานะ: พร้อมใช้งานจริงแล้ววันนี้`,
          },
          'Budget_Summary_Q4.csv': {
            name: 'Budget_Summary_Q4.csv',
            kind: 'file',
            size: 512,
            lastModified: now - 86400000,
            mimeType: 'text/csv',
            content: `Category,Department,Planned_THB,Actual_THB,Status
Cloud Infrastructure,Engineering,45000,42300,Under Budget
Software Licenses,Design & Dev,28000,28000,On Track
Workstation Hardware,Operations,120000,115500,Completed
Team Workshop,HR & Product,30000,18500,In Progress
Security Audit,Infra,35000,34200,Completed`,
          },
          'Meeting_Notes.txt': {
            name: 'Meeting_Notes.txt',
            kind: 'file',
            size: 420,
            lastModified: now - 7200000,
            mimeType: 'text/plain',
            content: `สรุปการประชุมทีมพัฒนา
----------------------------------------
1. ทดสอบฟีเจอร์ Copy (F5) และ Move (F6) ระหว่างหน้าต่างซ้าย-ขวา
2. ทดสอบมุมมอง Miller Columns สำหรับโฟลเดอร์ที่ซ้อนกันหลายชั้น
3. ทดลองเลือกหลายไฟล์แล้วกด Ctrl+M เพื่อเปิด Batch Rename
4. กด Space บนไฟล์ใดก็ได้เพื่อเปิด Quick Look แบบเต็มจอ`,
          },
          Reports: {
            name: 'Reports',
            kind: 'directory',
            lastModified: now - 86400000 * 3,
            children: {
              'Q3_Performance.csv': {
                name: 'Q3_Performance.csv',
                kind: 'file',
                size: 280,
                lastModified: now - 86400000 * 3,
                mimeType: 'text/csv',
                content: `Metric,Q1,Q2,Q3
Active Users,1240,1890,2650
Transfer Speed MB/s,42.5,58.0,74.2
Error Rate %,0.8,0.4,0.1`,
              },
            },
          },
        },
      },
      Projects: {
        name: 'Projects',
        kind: 'directory',
        lastModified: now - 86400000 * 3,
        children: {
          'app.config.json': {
            name: 'app.config.json',
            kind: 'file',
            size: 320,
            lastModified: now - 1800000,
            mimeType: 'application/json',
            content: JSON.stringify(
              {
                appName: 'CommanderWeb',
                architecture: 'DualPane + MillerColumns',
                features: {
                  multiTabs: true,
                  batchRename: true,
                  folderCompare: true,
                  dropShelf: true,
                  localFileSystemAPI: true,
                },
              },
              null,
              2
            ),
          },
          'syncEngine.ts': {
            name: 'syncEngine.ts',
            kind: 'file',
            size: 540,
            lastModified: now - 5400000,
            mimeType: 'text/typescript',
            content: `export interface SyncOptions {
  mirror: boolean;
  overwriteNewer: boolean;
}

export async function syncDirectories(
  sourcePath: string,
  targetPath: string,
  options: SyncOptions
): Promise<{ copied: number; skipped: number }> {
  console.log('Syncing', sourcePath, '->', targetPath, options);
  return { copied: 4, skipped: 1 };
}`,
          },
          Frontend: {
            name: 'Frontend',
            kind: 'directory',
            lastModified: now - 86400000 * 2,
            children: {
              Components: {
                name: 'Components',
                kind: 'directory',
                lastModified: now - 86400000,
                children: {
                  'Button.tsx': {
                    name: 'Button.tsx',
                    kind: 'file',
                    size: 210,
                    lastModified: now - 86400000,
                    mimeType: 'text/typescript',
                    content: `export function Button({ label }: { label: string }) {\n  return <button className="px-4 py-2 rounded-lg bg-blue-600 text-white">{label}</button>;\n}`,
                  },
                },
              },
            },
          },
        },
      },
      Media_Assets: {
        name: 'Media_Assets',
        kind: 'directory',
        lastModified: now - 86400000 * 4,
        children: {
          'Banner_Preview.svg': {
            name: 'Banner_Preview.svg',
            kind: 'file',
            size: 620,
            lastModified: now - 86400000,
            mimeType: 'image/svg+xml',
            content: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2563eb"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="480" height="260" rx="16" fill="url(#g)"/><circle cx="390" cy="60" r="85" fill="rgba(255,255,255,0.08)"/><rect x="36" y="42" width="64" height="8" rx="4" fill="#60a5fa"/><text x="36" y="118" fill="#ffffff" font-family="sans-serif" font-size="28" font-weight="700">CommanderWeb</text><text x="36" y="150" fill="#cbd5e1" font-family="sans-serif" font-size="14">Dual-Pane &amp; Miller Columns Workspace</text></svg>`,
          },
          'Architecture_Diagram.svg': {
            name: 'Architecture_Diagram.svg',
            kind: 'file',
            size: 740,
            lastModified: now - 86400000 * 2,
            mimeType: 'image/svg+xml',
            content: `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="260" viewBox="0 0 480 260"><rect width="480" height="260" rx="16" fill="#0f172a"/><rect x="36" y="65" width="160" height="125" rx="10" fill="#1e293b" stroke="#3b82f6" stroke-width="2"/><text x="116" y="122" fill="#93c5fd" font-family="sans-serif" font-size="15" text-anchor="middle" font-weight="600">Left Pane</text><text x="116" y="144" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">Source / Tabs</text><rect x="284" y="65" width="160" height="125" rx="10" fill="#1e293b" stroke="#10b981" stroke-width="2"/><text x="364" y="122" fill="#6ee7b7" font-family="sans-serif" font-size="15" text-anchor="middle" font-weight="600">Right Pane</text><text x="364" y="144" fill="#64748b" font-family="sans-serif" font-size="12" text-anchor="middle">Target / Sync</text><path d="M206 112 L274 112 M264 104 L274 112 L264 120" stroke="#f59e0b" stroke-width="2.5" fill="none"/><path d="M274 146 L206 146 M216 138 L206 146 L216 154" stroke="#60a5fa" stroke-width="2.5" fill="none"/></svg>`,
          },
          'photo_01.svg': {
            name: 'photo_01.svg',
            kind: 'file',
            size: 410,
            lastModified: now - 86400000 * 4,
            mimeType: 'image/svg+xml',
            content: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260"><rect width="400" height="260" fill="#1e293b"/><polygon points="0,260 140,110 270,260" fill="#334155"/><polygon points="160,260 280,90 400,260" fill="#475569"/><circle cx="310" cy="65" r="24" fill="#f59e0b"/></svg>`,
          },
        },
      },
      Backup_Archive: {
        name: 'Backup_Archive',
        kind: 'directory',
        lastModified: now - 86400000 * 5,
        children: {
          'README_Backup.txt': {
            name: 'README_Backup.txt',
            kind: 'file',
            size: 210,
            lastModified: now - 86400000 * 5,
            mimeType: 'text/plain',
            content: `โฟลเดอร์สำหรับทดสอบการ Copy (F5), Move (F6) และ Compare & Sync (Ctrl+D) ระหว่างหน้าต่างฝั่งซ้ายและฝั่งขวา`,
          },
          'Project_Proposal_2026.md': {
            name: 'Project_Proposal_2026.md',
            kind: 'file',
            size: 180,
            lastModified: now - 86400000 * 6,
            mimeType: 'text/markdown',
            content: `# แผนงานพัฒนาเว็บไซต์องค์กร 2026 (ฉบับร่างเก่า)\n\nอยู่ระหว่างรวบรวมข้อมูล`,
          },
        },
      },
      '.Trash': {
        name: '.Trash',
        kind: 'directory',
        lastModified: now - 86400000,
        children: {},
      },
      'Quick_Start_Guide.txt': {
        name: 'Quick_Start_Guide.txt',
        kind: 'file',
        size: 620,
        lastModified: now - 600000,
        mimeType: 'text/plain',
        content: `ยินดีต้อนรับสู่ CommanderWeb!

ฟีเจอร์หลักสไตล์ OneCommander:
1. Dual-Pane + Multi-Tab: เปิดหลายแท็บแยกอิสระทั้งฝั่งซ้ายและขวา
2. Miller Columns View: สลับมุมมองเป็นคอลัมน์เพื่อเจาะลึกโครงสร้างโฟลเดอร์
3. Open PC Folder: เชื่อมต่อโฟลเดอร์จริงจากเครื่องคอมพิวเตอร์ของคุณ
4. Drop Shelf: โยนไฟล์จากหลายโฟลเดอร์มาพักไว้ที่ Shelf ด้านซ้าย แล้ว Copy/Move ทีเดียว
5. Batch Rename (Ctrl+M): เปลี่ยนชื่อหลายไฟล์พร้อมกันด้วย Find/Replace, Counter, Case
6. Compare & Sync (Ctrl+D): เทียบไฟล์ที่ต่างกันระหว่างสองฝั่งและ Sync ได้ทันที
7. Quick Look (Space) & Inline Editor: กด Space เพื่อดูตัวอย่างหรือแก้ไขไฟล์ข้อความได้ทันที`,
      },
    },
  };
}

export function loadVirtualRoot(): VirtualNode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialVirtualRoot();
    const parsed = JSON.parse(raw) as VirtualNode;
    if (parsed && parsed.kind === 'directory' && parsed.children) {
      if (!parsed.children['.Trash']) {
        parsed.children['.Trash'] = {
          name: '.Trash',
          kind: 'directory',
          lastModified: Date.now(),
          children: {},
        };
      }
      return parsed;
    }
  } catch {
    // fallback to default
  }
  return createInitialVirtualRoot();
}

export function saveVirtualRoot(root: VirtualNode): void {
  try {
    const stripBlobs = (node: VirtualNode): VirtualNode => {
      if (node.kind === 'file') {
        const { blob: _blob, ...rest } = node;
        return rest;
      }
      const children: Record<string, VirtualNode> = {};
      for (const [k, v] of Object.entries(node.children || {})) {
        children[k] = stripBlobs(v);
      }
      return {
        ...node,
        children,
      };
    };
    const serialized = JSON.stringify(stripBlobs(root));
    if (serialized.length < 3_500_000) {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
  } catch {
    // ignore quota errors
  }
}

export class VirtualFSAdapter implements FileAdapter {
  public type = 'virtual' as const;
  public root: VirtualNode;
  public path: string[];
  private onMutate?: () => void;

  constructor(root: VirtualNode, path: string[] = [], onMutate?: () => void) {
    this.root = root;
    this.path = [...path];
    this.onMutate = onMutate;
  }

  getRootName(): string {
    return this.root.name;
  }

  getPathString(): string {
    return this.path.length === 0 ? 'V:/' : `V:/${this.path.join('/')}`;
  }

  getCurrentNode(): VirtualNode {
    let curr = this.root;
    for (const seg of this.path) {
      if (curr.children && curr.children[seg]) {
        curr = curr.children[seg];
      } else {
        this.path = [];
        return this.root;
      }
    }
    return curr;
  }

  getBreadcrumbs(): BreadcrumbItem[] {
    return [
      { name: 'V:', path: [] },
      ...this.path.map((name, idx) => ({
        name,
        path: this.path.slice(0, idx + 1),
      })),
    ];
  }

  private toFileEntry(node: VirtualNode, pathSegments: string[], relativePath?: string): FileEntry {
    const size =
      node.kind === 'directory'
        ? 0
        : node.size ?? (node.content ? new Blob([node.content]).size : 0);
    return {
      name: node.name,
      kind: node.kind,
      size,
      lastModified: node.lastModified || Date.now(),
      mimeType: node.kind === 'directory' ? '' : node.mimeType || guessMimeType(node.name),
      pathKey: `virtual:${pathSegments.join('/')}`,
      relativePath,
      raw: node,
    };
  }

  async listEntries(): Promise<FileEntry[]> {
    const node = this.getCurrentNode();
    const children = Object.values(node.children || {});
    return children
      .filter((child) => !(this.path.length === 0 && child.name === '.Trash'))
      .map((child) => this.toFileEntry(child, [...this.path, child.name]));
  }

  async searchRecursive(query: string, maxResults = 150): Promise<FileEntry[]> {
    const q = query.trim().toLowerCase();
    const results: FileEntry[] = [];
    const startNode = this.getCurrentNode();

    const walk = (node: VirtualNode, segs: string[], relSegs: string[]) => {
      if (results.length >= maxResults) return;
      for (const child of Object.values(node.children || {})) {
        if (segs.length === 0 && child.name === '.Trash') continue;
        const nextSegs = [...segs, child.name];
        const nextRel = [...relSegs, child.name];
        if (!q || child.name.toLowerCase().includes(q)) {
          results.push(this.toFileEntry(child, nextSegs, nextRel.join('/')));
          if (results.length >= maxResults) return;
        }
        if (child.kind === 'directory') {
          walk(child, nextSegs, nextRel);
        }
      }
    };

    walk(startNode, this.path, []);
    return results;
  }

  async createDirectory(name: string): Promise<void> {
    const node = this.getCurrentNode();
    if (!node.children) node.children = {};
    if (node.children[name]) {
      throw new Error(`มีไฟล์หรือโฟลเดอร์ชื่อ "${name}" อยู่แล้ว`);
    }
    node.children[name] = {
      name,
      kind: 'directory',
      lastModified: Date.now(),
      children: {},
    };
    this.onMutate?.();
  }

  async createFile(name: string, content = ''): Promise<void> {
    const node = this.getCurrentNode();
    if (!node.children) node.children = {};
    if (node.children[name]) {
      throw new Error(`มีไฟล์หรือโฟลเดอร์ชื่อ "${name}" อยู่แล้ว`);
    }
    const blob = new Blob([content], { type: guessMimeType(name) });
    node.children[name] = {
      name,
      kind: 'file',
      size: blob.size,
      lastModified: Date.now(),
      mimeType: guessMimeType(name),
      content,
    };
    this.onMutate?.();
  }

  async renameEntry(oldName: string, newName: string): Promise<void> {
    const node = this.getCurrentNode();
    if (!node.children?.[oldName]) throw new Error('ไม่พบไฟล์หรือโฟลเดอร์ต้นทาง');
    if (oldName === newName) return;
    if (node.children[newName]) throw new Error(`มีชื่อ "${newName}" อยู่แล้วในโฟลเดอร์นี้`);
    const item = node.children[oldName];
    item.name = newName;
    item.lastModified = Date.now();
    if (item.kind === 'file') {
      item.mimeType = guessMimeType(newName);
    }
    node.children[newName] = item;
    delete node.children[oldName];
    this.onMutate?.();
  }

  async deleteEntry(name: string): Promise<void> {
    const node = this.getCurrentNode();
    if (node.children?.[name]) {
      delete node.children[name];
      this.onMutate?.();
    }
  }

  async moveToTrash(name: string): Promise<void> {
    const node = this.getCurrentNode();
    const item = node.children?.[name];
    if (!item) return;
    if (this.path[0] === '.Trash') {
      delete node.children![name];
      this.onMutate?.();
      return;
    }
    const trash = this.root.children?.['.Trash'];
    if (!trash) {
      delete node.children![name];
      this.onMutate?.();
      return;
    }
    if (!trash.children) trash.children = {};
    let targetName = name;
    let count = 1;
    while (trash.children[targetName]) {
      const dot = name.lastIndexOf('.');
      targetName = dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`;
      count++;
    }
    trash.children[targetName] = { ...item, name: targetName, lastModified: Date.now() };
    delete node.children![name];
    this.onMutate?.();
  }

  async hasEntry(name: string): Promise<boolean> {
    const node = this.getCurrentNode();
    return Boolean(node.children?.[name]);
  }

  async readFileBlob(entry: FileEntry): Promise<Blob> {
    const raw = entry.raw as VirtualNode;
    if (raw.blob) return raw.blob;
    return new Blob([raw.content || ''], { type: raw.mimeType || guessMimeType(entry.name) });
  }

  async writeFileFromBlob(name: string, blob: Blob, lastModified = Date.now()): Promise<void> {
    const node = this.getCurrentNode();
    if (!node.children) node.children = {};
    let textContent: string | undefined;
    const mime = blob.type || guessMimeType(name);
    if (
      (mime.startsWith('text/') ||
        mime === 'application/json' ||
        mime === 'image/svg+xml' ||
        /\.(txt|md|json|js|ts|tsx|jsx|html|css|csv|xml|svg|py|java|cpp|log|yaml|yml|sql)$/i.test(name)) &&
      blob.size < 1_500_000
    ) {
      textContent = await blob.text();
    }
    node.children[name] = {
      name,
      kind: 'file',
      size: blob.size,
      lastModified,
      mimeType: mime,
      content: textContent,
      blob: textContent !== undefined ? undefined : blob,
    };
    this.onMutate?.();
  }

  async getChildAdapter(dirName: string): Promise<FileAdapter> {
    const node = this.getCurrentNode();
    if (!node.children?.[dirName]) {
      if (!node.children) node.children = {};
      node.children[dirName] = {
        name: dirName,
        kind: 'directory',
        lastModified: Date.now(),
        children: {},
      };
      this.onMutate?.();
    }
    return new VirtualFSAdapter(this.root, [...this.path, dirName], this.onMutate);
  }

  navigateToBreadcrumb(index: number): FileAdapter {
    const crumbs = this.getBreadcrumbs();
    const targetPath = crumbs[index]?.path || [];
    return new VirtualFSAdapter(this.root, targetPath, this.onMutate);
  }
}
