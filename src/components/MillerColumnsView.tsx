import React, { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { ColorTag, FileAdapter, FileEntry } from '../types/files';
import { formatBytes } from '../utils/format';
import { FileIcon } from './FileIcon';

interface MillerColumnData {
  adapter: FileAdapter;
  title: string;
  entries: FileEntry[];
  activeChildName?: string;
}

interface MillerColumnsViewProps {
  adapter: FileAdapter;
  selectedNames: string[];
  tags: Record<string, ColorTag>;
  filterQuery: string;
  onSelectEntries: (names: string[], entry?: FileEntry, targetAdapter?: FileAdapter) => void;
  onNavigateToAdapter: (adapter: FileAdapter) => void;
  onQuickLook: () => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
}

export function MillerColumnsView({
  adapter,
  selectedNames,
  tags,
  filterQuery,
  onSelectEntries,
  onNavigateToAdapter,
  onQuickLook,
  onContextMenu,
}: MillerColumnsViewProps) {
  const [columns, setColumns] = useState<MillerColumnData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const buildColumns = async () => {
      setLoading(true);
      try {
        const crumbs = adapter.getBreadcrumbs();
        const cols: MillerColumnData[] = [];

        for (let i = 0; i < crumbs.length; i++) {
          const colAdapter = adapter.navigateToBreadcrumb(i);
          const rawEntries = await colAdapter.listEntries();
          const sorted = [...rawEntries].sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
          });
          const nextCrumbName = i + 1 < crumbs.length ? crumbs[i + 1].name : undefined;
          cols.push({
            adapter: colAdapter,
            title: crumbs[i].name,
            entries: sorted,
            activeChildName: nextCrumbName,
          });
        }

        if (!cancelled) {
          setColumns(cols);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    buildColumns();
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  if (loading && columns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
        กำลังโหลดโครงสร้างคอลัมน์...
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-x-auto overflow-y-hidden bg-white dark:bg-[#161920] divide-x divide-slate-200 dark:divide-[#262b35]">
      {columns.map((col, colIdx) => {
        const isLastCol = colIdx === columns.length - 1;
        const visibleEntries =
          isLastCol && filterQuery.trim()
            ? col.entries.filter((e) =>
                e.name.toLowerCase().includes(filterQuery.trim().toLowerCase())
              )
            : col.entries;

        return (
          <div
            key={`${colIdx}-${col.title}`}
            className="w-52 sm:w-56 shrink-0 flex flex-col h-full overflow-hidden"
          >
            <div className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1a1e26] border-b border-slate-200 dark:border-[#262b35] truncate flex items-center justify-between">
              <span className="truncate">{col.title}</span>
              <span className="font-mono text-[10px] tabular-nums text-slate-400">
                {visibleEntries.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
              {visibleEntries.length === 0 ? (
                <div className="px-2 py-6 text-center text-[11px] text-slate-400">
                  โฟลเดอร์ว่างเปล่า
                </div>
              ) : (
                visibleEntries.map((entry) => {
                  const isActiveBranch = col.activeChildName === entry.name;
                  const isSelected = isLastCol && selectedNames.includes(entry.name);
                  const tag = tags[entry.pathKey] || 'none';

                  return (
                    <div
                      key={entry.name}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (entry.kind === 'directory') {
                          const child = await col.adapter.getChildAdapter(entry.name);
                          onNavigateToAdapter(child);
                        } else {
                          if (!isLastCol) {
                            onNavigateToAdapter(col.adapter);
                          }
                          onSelectEntries([entry.name], entry, col.adapter);
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (entry.kind === 'file') {
                          onSelectEntries([entry.name], entry, col.adapter);
                          onQuickLook();
                        }
                      }}
                      onContextMenu={(e) => {
                        if (isLastCol) onContextMenu(e, entry);
                      }}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white font-medium'
                          : isActiveBranch
                            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#222731]'
                      }`}
                    >
                      <FileIcon entry={entry} size="sm" tag={tag} />
                      <span className="truncate flex-1">{entry.name}</span>
                      {entry.kind === 'directory' ? (
                        <ChevronRight
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isSelected || isActiveBranch ? 'opacity-90' : 'text-slate-400'
                          }`}
                        />
                      ) : (
                        <span
                          className={`font-mono text-[10px] shrink-0 tabular-nums ${
                            isSelected ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {formatBytes(entry.size)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
