import { useState } from 'react';
import { X, Download, Check, Trash2, HardDrive, Cpu, WifiOff, RefreshCw } from 'lucide-react';
import type { LocalModel } from '../types';
import MemorySettings from './MemorySettings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  models: LocalModel[];
  activeModelId: string | null;
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string) => void;
  ollamaOffline: boolean;
  onRetryConnection: () => void;
}

export default function SettingsModal({
  open,
  onClose,
  models,
  activeModelId,
  onDownload,
  onDelete,
  onSetActive,
  ollamaOffline,
  onRetryConnection,
}: SettingsModalProps) {
  const [tab, setTab] = useState<'model' | 'memory'>('model');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--text)]">Cài đặt</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {tab === 'model'
                ? 'Tải model chạy ngay trên máy của bạn — không cần internet sau khi tải xong.'
                : 'Cách xưng hô cố định + tài liệu riêng cho AI dùng khi trả lời.'}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border)] px-5 pt-2">
          {(['model', 'memory'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                tab === t ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'model' ? 'Model' : 'Memory'}
            </button>
          ))}
        </div>

        {tab === 'memory' && (
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <MemorySettings />
          </div>
        )}

        {tab === 'model' && ollamaOffline && (
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--danger)]/10 px-5 py-2.5 text-xs font-medium text-[var(--danger)]">
            <span className="flex items-center gap-1.5">
              <WifiOff size={13} />
              Không kết nối được tới Ollama — mở ứng dụng Ollama trên máy rồi thử lại.
            </span>
            <button onClick={onRetryConnection} className="flex items-center gap-1 rounded-full bg-[var(--danger)]/15 px-2 py-1 hover:bg-[var(--danger)]/25">
              <RefreshCw size={12} />
              Thử lại
            </button>
          </div>
        )}

        {tab === 'model' && (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {models.map((m) => (
            <div key={m.id} className="rounded-xl border border-[var(--border)] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[var(--text)]">{m.name}</span>
                    {m.id === activeModelId && (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent)]">
                        Đang dùng
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{m.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-[var(--text-faint)]">
                    <span className="flex items-center gap-1">
                      <HardDrive size={12} /> {m.fileSize}
                    </span>
                    <span className="flex items-center gap-1">
                      <Cpu size={12} /> {m.ramRequirement}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {m.status === 'not_downloaded' && (
                    <button
                      onClick={() => onDownload(m.id)}
                      disabled={ollamaOffline}
                      className="flex items-center gap-1.5 rounded-full bg-[var(--bg-active)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Download size={13} />
                      Tải về
                    </button>
                  )}
                  {m.status === 'downloading' && (
                    <div className="flex items-center gap-1.5 rounded-full bg-[var(--bg-active)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]">
                      {Math.round(m.progress ?? 0)}%
                    </div>
                  )}
                  {m.status === 'downloaded' && m.id !== activeModelId && (
                    <button
                      onClick={() => onSetActive(m.id)}
                      className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                    >
                      Dùng model này
                    </button>
                  )}
                  {m.status === 'downloaded' && m.id === activeModelId && (
                    <div className="flex items-center gap-1 px-2 py-1.5 text-[var(--accent)]">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              </div>

              {m.status === 'downloading' && (
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-input)]">
                  <div
                    className="h-full rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${m.progress ?? 0}%` }}
                  />
                </div>
              )}

              {m.status === 'downloaded' && (
                <button
                  onClick={() => onDelete(m.id)}
                  className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--danger)]"
                >
                  <Trash2 size={12} />
                  Xóa model khỏi máy
                </button>
              )}
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
