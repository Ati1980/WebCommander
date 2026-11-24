import { useMemo, useState } from 'react';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import { BatchRenameRule, FileEntry } from '../types/files';
import { applyBatchRenameRule } from '../utils/format';

interface BatchRenameModalProps {
  entries: FileEntry[];
  onClose: () => void;
  onApply: (renames: Array<{ oldName: string; newName: string }>) => Promise<void>;
}

export function BatchRenameModal({ entries, onClose, onApply }: BatchRenameModalProps) {
  const [rule, setRule] = useState<BatchRenameRule>({
    findText: '',
    replaceText: '',
    useRegex: false,
    caseSensitive: false,
    prefix: '',
    suffix: '',
    caseMode: 'keep',
    useCounter: false,
    counterStart: 1,
    counterStep: 1,
    counterDigits: 2,
    counterPosition: 'suffix',
    newExtension: '',
  });
  const [applying, setApplying] = useState(false);

  const previews = useMemo(() => {
    const usedNames = new Set<string>();
    return entries.map((entry, idx) => {
      const candidate = applyBatchRenameRule(entry, idx, rule);
      const duplicate = usedNames.has(candidate);
      usedNames.add(candidate);
      return {
        oldName: entry.name,
        newName: candidate,
        changed: candidate !== entry.name,
        duplicate,
      };
    });
  }, [entries, rule]);

  const hasDuplicates = previews.some((p) => p.duplicate);
  const changedCount = previews.filter((p) => p.changed).length;

  const handleApply = async () => {
    if (hasDuplicates || changedCount === 0) return;
    setApplying(true);
    try {
      await onApply(
        previews
          .filter((p) => p.changed)
          .map((p) => ({ oldName: p.oldName, newName: p.newName }))
      );
      onClose();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#262b35] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              เปลี่ยนชื่อหลายไฟล์พร้อมกัน (Batch Rename)
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {entries.length} รายการ
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-slate-200 dark:border-[#262b35] bg-slate-50/70 dark:bg-[#14171d] overflow-y-auto">
          {/* Find & Replace */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              ค้นหาและแทนที่ (Find & Replace)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="ค้นหาคำ..."
                value={rule.findText}
                onChange={(e) => setRule({ ...rule, findText: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="แทนที่ด้วย..."
                value={rule.replaceText}
                onChange={(e) => setRule({ ...rule, replaceText: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.useRegex}
                  onChange={(e) => setRule({ ...rule, useRegex: e.target.checked })}
                  className="rounded border-slate-400"
                />
                <span>ใช้ Regex</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.caseSensitive}
                  onChange={(e) => setRule({ ...rule, caseSensitive: e.target.checked })}
                  className="rounded border-slate-400"
                />
                <span>ตรงตัวพิมพ์ใหญ่-เล็ก</span>
              </label>
            </div>
          </div>

          {/* Prefix / Suffix / Case / Ext */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              เติมคำหน้า-หลัง & รูปแบบตัวอักษร
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Prefix (หน้าชื่อ)"
                value={rule.prefix}
                onChange={(e) => setRule({ ...rule, prefix: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Suffix (หลังชื่อ)"
                value={rule.suffix}
                onChange={(e) => setRule({ ...rule, suffix: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={rule.caseMode}
                onChange={(e) =>
                  setRule({ ...rule, caseMode: e.target.value as BatchRenameRule['caseMode'] })
                }
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none"
              >
                <option value="keep">คงตัวอักษรเดิม</option>
                <option value="lower">ตัวพิมพ์เล็กทั้งหมด (lower)</option>
                <option value="upper">ตัวพิมพ์ใหญ่ทั้งหมด (UPPER)</option>
                <option value="title">ตัวแรกพิมพ์ใหญ่ (Title Case)</option>
              </select>
              <input
                type="text"
                placeholder="เปลี่ยนนามสกุล (เช่น md)"
                value={rule.newExtension}
                onChange={(e) => setRule({ ...rule, newExtension: e.target.value })}
                className="px-2.5 py-1.5 rounded-lg text-xs border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Counter */}
          <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={rule.useCounter}
                onChange={(e) => setRule({ ...rule, useCounter: e.target.checked })}
                className="rounded border-slate-400"
              />
              <span>รันตัวเลขอัตโนมัติ (Counter)</span>
            </label>

            {rule.useCounter && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={rule.counterPosition}
                  onChange={(e) =>
                    setRule({
                      ...rule,
                      counterPosition: e.target.value as BatchRenameRule['counterPosition'],
                    })
                  }
                  className="px-2 py-1 rounded-lg border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white"
                >
                  <option value="suffix">ต่อท้ายชื่อ</option>
                  <option value="prefix">นำหน้าชื่อ</option>
                  <option value="replace">ใช้เลขแทนชื่อเดิม</option>
                </select>
                <label className="flex items-center gap-1 text-slate-500">
                  <span>เริ่ม:</span>
                  <input
                    type="number"
                    value={rule.counterStart}
                    onChange={(e) =>
                      setRule({ ...rule, counterStart: Number(e.target.value) || 0 })
                    }
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white font-mono"
                  />
                </label>
                <label className="flex items-center gap-1 text-slate-500">
                  <span>หลัก:</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={rule.counterDigits}
                    onChange={(e) =>
                      setRule({
                        ...rule,
                        counterDigits: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
                      })
                    }
                    className="w-12 px-2 py-1 rounded border border-slate-300 dark:border-[#2c3240] bg-white dark:bg-[#11141a] text-slate-900 dark:text-white font-mono"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="rounded-xl border border-slate-200 dark:border-[#262b35] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-[#14171d] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">ชื่อเดิม</th>
                  <th className="w-8"></th>
                  <th className="text-left px-3 py-2 font-semibold">ชื่อใหม่ (ตัวอย่าง)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#222731]">
                {previews.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-[#1d222b]">
                    <td className="px-3 py-1.5 font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                      {p.oldName}
                    </td>
                    <td className="text-center text-slate-400">
                      <ArrowRight className="w-3.5 h-3.5 inline" />
                    </td>
                    <td
                      className={`px-3 py-1.5 font-mono truncate max-w-[260px] ${
                        p.duplicate
                          ? 'text-rose-500 font-semibold'
                          : p.changed
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-slate-400'
                      }`}
                    >
                      {p.newName} {p.duplicate ? '(ชื่อซ้ำ!)' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-[#262b35] flex items-center justify-between bg-slate-50 dark:bg-[#14171d]">
          <span className="text-xs text-slate-500">
            {hasDuplicates
              ? 'มีชื่อไฟล์ซ้ำกัน กรุณาปรับกติกาหรือเปิด Counter'
              : `จะเปลี่ยนชื่อ ${changedCount} จาก ${entries.length} รายการ`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#222731]"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleApply}
              disabled={applying || hasDuplicates || changedCount === 0}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white"
            >
              {applying ? 'กำลังเปลี่ยนชื่อ...' : 'ยืนยันเปลี่ยนชื่อทั้งหมด'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
