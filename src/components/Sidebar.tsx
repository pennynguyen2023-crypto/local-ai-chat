import { useState } from 'react';
import { Search, SquarePen, Pin, PinOff, Pencil, Trash2, Settings, Check, X } from 'lucide-react';
import type { ChatSession } from '../types';

interface SidebarProps {
  chats: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  chats,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onTogglePin,
  onRename,
  onOpenSettings,
}: SidebarProps) {
  const [query, setQuery] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = chats.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()));
  const pinned = filtered.filter((c) => c.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  const recent = filtered.filter((c) => !c.pinned).sort((a, b) => b.updatedAt - a.updatedAt);

  function startRename(chat: ChatSession) {
    setRenamingId(chat.id);
    setRenameValue(chat.title);
  }

  function commitRename() {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  }

  function renderRow(chat: ChatSession) {
    const isActive = chat.id === activeId;
    const isRenaming = renamingId === chat.id;
    const isConfirming = confirmDeleteId === chat.id;

    return (
      <div
        key={chat.id}
        onClick={() => !isRenaming && onSelect(chat.id)}
        className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 cursor-pointer text-sm ${
          isActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
        }`}
      >
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenamingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="min-w-0 flex-1 rounded-md border border-[var(--accent)] bg-[var(--bg)] px-1.5 py-0.5 text-sm outline-none"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-[var(--text)]">{chat.title}</span>
        )}

        {!isRenaming && !isConfirming && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              title={chat.pinned ? 'Bỏ ghim' : 'Ghim đoạn chat'}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(chat.id);
              }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
            >
              {chat.pinned ? <PinOff size={14} /> : <Pin size={14} />}
            </button>
            <button
              title="Đổi tên"
              onClick={(e) => {
                e.stopPropagation();
                startRename(chat);
              }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--text)]"
            >
              <Pencil size={14} />
            </button>
            <button
              title="Xóa đoạn chat"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(chat.id);
              }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-active)] hover:text-[var(--danger)]"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}

        {isConfirming && (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-[var(--text-muted)]">Xóa?</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(chat.id);
                setConfirmDeleteId(null);
              }}
              className="rounded p-1 text-[var(--danger)] hover:bg-[var(--bg-active)]"
            >
              <Check size={14} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(null);
              }}
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-active)]"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] px-2.5 py-3">
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
        <Search size={15} className="text-[var(--text-faint)]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm đoạn chat"
          className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
        />
      </div>

      <button
        onClick={onNew}
        className="mb-4 flex items-center gap-2 rounded-lg bg-[var(--bg-active)] px-2.5 py-2 text-sm font-medium hover:bg-[var(--bg-hover)]"
      >
        <SquarePen size={16} />
        Đoạn chat mới
      </button>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {pinned.length > 0 && (
          <div>
            <div className="px-2 pb-1 text-xs font-medium text-[var(--text-faint)]">Đã ghim</div>
            <div className="space-y-0.5">{pinned.map(renderRow)}</div>
          </div>
        )}
        <div>
          {recent.length > 0 && (
            <div className="px-2 pb-1 text-xs font-medium text-[var(--text-faint)]">Gần đây</div>
          )}
          <div className="space-y-0.5">{recent.map(renderRow)}</div>
          {filtered.length === 0 && query.trim() && (
            <div className="px-2 py-4 text-center text-xs text-[var(--text-faint)]">Không tìm thấy đoạn chat nào</div>
          )}
          {chats.length === 0 && !query.trim() && (
            <div className="px-2 py-4 text-center text-xs text-[var(--text-faint)]">Đoạn chat của bạn sẽ hiện ở đây</div>
          )}
        </div>
      </div>

      <button
        onClick={onOpenSettings}
        className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"
      >
        <Settings size={16} />
        Cài đặt
      </button>
    </aside>
  );
}
