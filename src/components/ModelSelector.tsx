import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Settings2 } from 'lucide-react';
import type { LocalModel } from '../types';

interface ModelSelectorProps {
  downloadedModels: LocalModel[];
  activeModelId: string | null;
  onSelect: (id: string) => void;
  onOpenSettings: () => void;
}

export default function ModelSelector({ downloadedModels, activeModelId, onSelect, onOpenSettings }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeModel = downloadedModels.find((m) => m.id === activeModelId) ?? null;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (downloadedModels.length === 0) {
    return (
      <button
        onClick={onOpenSettings}
        className="flex items-center gap-1.5 rounded-full border border-dashed border-[var(--text-faint)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
      >
        <Settings2 size={13} />
        Tải model để bắt đầu
      </button>
    );
  }

  // Chỉ 1 model đã tải -> khỏi cần cho chọn, hiện thẳng tên (đúng yêu cầu:
  // "mặc định là model được tải nếu chỉ có tải 1 model").
  if (downloadedModels.length === 1) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-[var(--bg-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
        {downloadedModels[0].name}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full bg-[var(--bg-input)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-active)]"
      >
        {activeModel?.name ?? 'Chọn model'}
        <ChevronDown size={13} className="text-[var(--text-faint)]" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] py-1 shadow-lg">
          {downloadedModels.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onSelect(m.id);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--bg-hover)]"
            >
              <span className="min-w-0 truncate">{m.name}</span>
              {m.id === activeModelId && <Check size={14} className="shrink-0 text-[var(--accent)]" />}
            </button>
          ))}
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
          >
            <Settings2 size={14} />
            Quản lý model
          </button>
        </div>
      )}
    </div>
  );
}
