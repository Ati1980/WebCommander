import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Copy,
  FilePlus,
  FolderPlus,
  GitCompare,
  HelpCircle,
  MoveRight,
  X,
} from 'lucide-react';
import { ConflictStrategy, FileEntry } from '../types/files';

export function InputModal({
  title,
  subtitle,
  defaultValue,
  confirmLabel,
  selectBasename = false,
  icon = 'folder',
  onConfirm,
  onClose,
}: {
  title: string;
  subtitle?: string;
  defaultValue: string;
  confirmLabel: string;
  selectBasename?: boolean;
  icon?: 'folder' | 'file' | 'edit';
  onConfirm: (val: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    const inp = document.getElementById('modal-text-input') as HTMLInputElement | null;
    if (inp) {
      inp.focus();
      if (selectBasename) {
        const dotIdx = defaultValue.lastIndexOf('.');
        if (dotIdx > 0) inp.setSelectionRange(0, dotIdx);
        else inp.select();
      } else {
        inp.select();
      }
    }
  }, [defaultValue, selectBasename]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <div className="flex items-center gap-2.5 mb-1">
          {icon === 'folder' && <FolderPlus className="w-5 h-5 text-emerald-500" />}
          {icon === 'file' && <FilePlus className="w-5 h-5 text-blue-500" />}
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 truncate">{subtitle}</p>
        )}
        <input
          id="modal-text-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim()) onConfirm(value.trim());
            if (e.key === 'Escape') onClose();
          }}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 dark:border-[#2c3240] bg-slate-50 dark:bg-[#11141a] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#232833]"
          >
            ยกเลิก
          </button>
          <button
            onClick={() => value.trim() && onConfirm(value.trim())}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteModal({
  entries,
  isLocal,
  isInTrash,
  onConfirm,
  onClose,
}: {
  entries: FileEntry[];
  isLocal: boolean;
  isInTrash: boolean;
  onConfirm: (permanent: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <div className="flex items-center gap-3 text-rose-500 mb-3">
          <div className="p-2.5 rounded-full bg-rose-500/10">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              ยืนยันการลบข้อมูล ({entries.length} รายการ)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isLocal || isInTrash
                ? 'การลบรายการนี้จะเป็นการลบถาวร'
                : 'สามารถย้ายไปที่ถังขยะ (V:/.Trash) หรือลบถาวรได้'}
            </p>
          </div>
        </div>

        <ul className="text-xs bg-slate-100 dark:bg-[#11141a] p-3 rounded-xl space-y-1 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#262b35]">
          {entries.slice(0, 5).map((e) => (
            <li key={e.name} className="truncate">
              • {e.name}
            </li>
          ))}
          {entries.length > 5 && (
            <li className="text-slate-400">...และอีก {entries.length - 5} รายการ</li>
          )}
        </ul>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#232833]"
          >
            ยกเลิก
          </button>
          {!isLocal && !isInTrash && (
            <button
              onClick={() => onConfirm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white"
            >
              ย้ายลงถังขยะ
            </button>
          )}
          <button
            onClick={() => onConfirm(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
          >
            ลบถาวร
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConflictModal({
  conflicts,
  onResolve,
}: {
  conflicts: string[];
  onResolve: (strategy: ConflictStrategy | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          พบไฟล์ชื่อซ้ำในโฟลเดอร์ปลายทาง
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          พบ {conflicts.length} รายการที่มีชื่อตรงกัน เช่น{' '}
          <span className="font-semibold text-amber-500">{conflicts[0]}</span>
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onResolve('overwrite')}
            className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#262b35] hover:border-blue-500 bg-slate-50 dark:bg-[#14171d] transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              เขียนทับไฟล์เดิม (Overwrite)
            </div>
            <div className="text-[11px] text-slate-500">แทนที่ไฟล์ปลายทางด้วยไฟล์ใหม่</div>
          </button>
          <button
            onClick={() => onResolve('rename')}
            className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#262b35] hover:border-blue-500 bg-slate-50 dark:bg-[#14171d] transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              เก็บไว้ทั้งคู่ (Auto-Rename)
            </div>
            <div className="text-[11px] text-slate-500">เติม (1), (2) ต่อท้ายชื่อไฟล์ใหม่อัตโนมัติ</div>
          </button>
          <button
            onClick={() => onResolve('skip')}
            className="w-full text-left px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#262b35] hover:border-blue-500 bg-slate-50 dark:bg-[#14171d] transition-colors"
          >
            <div className="text-xs font-semibold text-slate-900 dark:text-white">
              ข้ามไฟล์ที่ซ้ำ (Skip)
            </div>
            <div className="text-[11px] text-slate-500">ดำเนินการเฉพาะรายการที่ยังไม่มี</div>
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={() => onResolve(null)}
            className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-white"
          >
            ยกเลิกทั้งหมด
          </button>
        </div>
      </div>
    </div>
  );
}

export function DropChoiceModal({
  count,
  onChoose,
  onClose,
}: {
  count: number;
  onChoose: (mode: 'copy' | 'move') => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
          ดำเนินการกับไฟล์ที่ลากมา ({count} รายการ)
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          เลือกการดำเนินการที่ต้องการ (กด Shift ค้างขณะลากเพื่อ Move ทันที)
        </p>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChoose('copy')}
            className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
          >
            <Copy className="w-5 h-5" />
            <span>Copy (คัดลอก)</span>
          </button>
          <button
            onClick={() => onChoose('move')}
            className="flex flex-col items-center gap-1.5 p-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold"
          >
            <MoveRight className="w-5 h-5" />
            <span>Move (ย้ายไฟล์)</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-3 py-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          ยกเลิก
        </button>
      </div>
    </div>
  );
}

export function CompareSyncModal({
  onlyLeft,
  onlyRight,
  newerLeft,
  newerRight,
  onSyncLeftToRight,
  onSyncRightToLeft,
  onClose,
}: {
  onlyLeft: number;
  onlyRight: number;
  newerLeft: number;
  newerRight: number;
  onSyncLeftToRight: () => void;
  onSyncRightToLeft: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GitCompare className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              เปรียบเทียบและ Sync โฟลเดอร์
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs mb-4">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35]">
            <div className="text-slate-500">เฉพาะฝั่งซ้าย</div>
            <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 tabular-nums">
              {onlyLeft}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35]">
            <div className="text-slate-500">เฉพาะฝั่งขวา</div>
            <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {onlyRight}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35]">
            <div className="text-slate-500">ฝั่งซ้ายใหม่กว่า</div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {newerLeft}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35]">
            <div className="text-slate-500">ฝั่งขวาใหม่กว่า</div>
            <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums">
              {newerRight}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={onSyncLeftToRight}
            disabled={onlyLeft + newerLeft === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold"
          >
            Sync ซ้าย → ขวา (คัดลอกไฟล์ที่ขาด/ใหม่กว่า {onlyLeft + newerLeft} รายการ)
          </button>
          <button
            onClick={onSyncRightToLeft}
            disabled={onlyRight + newerRight === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold"
          >
            Sync ขวา → ซ้าย (คัดลอกไฟล์ที่ขาด/ใหม่กว่า {onlyRight + newerRight} รายการ)
          </button>
        </div>
      </div>
    </div>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    ['F5', 'คัดลอกไฟล์ที่เลือกไปอีกหน้าต่าง (Copy)'],
    ['F6', 'ย้ายไฟล์ที่เลือกไปอีกหน้าต่าง (Move)'],
    ['F7', 'สร้างโฟลเดอร์ใหม่ (New Folder)'],
    ['Shift + F7', 'สร้างไฟล์ใหม่ (.txt, .md, .json)'],
    ['F2', 'เปลี่ยนชื่อไฟล์หรือโฟลเดอร์'],
    ['Ctrl + M', 'เปลี่ยนชื่อหลายไฟล์พร้อมกัน (Batch Rename)'],
    ['Ctrl + D', 'เปิด/ปิด เปรียบเทียบโฟลเดอร์ (Compare Panes)'],
    ['Space', 'เปิด Quick Look ดูตัวอย่างไฟล์เต็มจอ'],
    ['Ctrl + F', 'โฟกัสช่องค้นหาและกรองไฟล์'],
    ['Ctrl + T / W', 'เปิดแท็บใหม่ / ปิดแท็บปัจจุบัน'],
    ['Ctrl + U', 'สลับหน้าต่าง ซ้าย ↔ ขวา'],
    ['Tab', 'สลับโฟกัสระหว่างหน้าต่างซ้ายและขวา'],
    ['Ctrl + C / X / V', 'Copy / Cut / Paste ข้ามโฟลเดอร์'],
    ['Delete', 'ลบไฟล์ที่เลือก'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              คีย์ลัดและความสามารถแบบ OneCommander
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-[#262b35] text-xs">
          {shortcuts.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-2 gap-4">
              <span className="text-slate-600 dark:text-slate-300">{desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#11141a] border border-slate-200 dark:border-[#262b35] font-mono text-[11px] font-semibold text-slate-800 dark:text-slate-200 shrink-0">
                {key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
          เชื่อมต่อโฟลเดอร์จริงในเครื่องคอมพิวเตอร์ได้ด้วยปุ่ม <strong>Open PC Folder</strong> บนแต่ละหน้าต่าง (รองรับ Chrome / Edge บนเดสก์ท็อป) หรือลากไฟล์จากเดสก์ท็อปมาวางในหน้าต่างได้โดยตรง
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

export function AlertModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#2c3240] bg-white dark:bg-[#191d25] shadow-2xl p-5"
      >
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed mb-5">
          {message}
        </p>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
