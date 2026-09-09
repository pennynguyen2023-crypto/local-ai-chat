import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Paperclip, Sparkles, WifiOff } from 'lucide-react';
import type { ChatSession, LocalModel } from '../types';
import ModelSelector from './ModelSelector';

interface ChatAreaProps {
  chat: ChatSession | null;
  onSend: (text: string) => void;
  downloadedModels: LocalModel[];
  activeModelId: string | null;
  onSelectModel: (id: string) => void;
  onOpenSettings: () => void;
  isGenerating: boolean;
  ollamaOffline: boolean;
}

export default function ChatArea({
  chat,
  onSend,
  downloadedModels,
  activeModelId,
  onSelectModel,
  onOpenSettings,
  isGenerating,
  ollamaOffline,
}: ChatAreaProps) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const hasModel = downloadedModels.length > 0;
  const canSend = hasModel && !isGenerating && !ollamaOffline;
  const messages = chat?.messages ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, messages[messages.length - 1]?.content]);

  function handleSend() {
    const value = text.trim();
    if (!value || !canSend) return;
    onSend(value);
    setText('');
  }

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-[var(--bg)]">
      {ollamaOffline && (
        <div className="flex items-center justify-center gap-2 bg-[var(--danger)]/10 px-4 py-2 text-xs font-medium text-[var(--danger)]">
          <WifiOff size={13} />
          Không kết nối được tới Ollama trên máy — mở ứng dụng Ollama rồi thử lại.
        </div>
      )}
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Sparkles size={28} className="text-[var(--accent)]" />
          <h1 className="text-2xl font-medium text-[var(--text)]">Hôm nay bạn muốn làm gì?</h1>
          {!hasModel && !ollamaOffline && (
            <p className="max-w-sm text-sm text-[var(--text-muted)]">
              Chưa có model nào được tải — vào <button onClick={onOpenSettings} className="text-[var(--accent)] underline underline-offset-2">Cài đặt</button> để tải 1 model phù hợp với máy của bạn trước khi bắt đầu.
            </p>
          )}
        </div>
      ) : (
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-2xl flex-col gap-5 px-6 py-8">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-input)] text-[var(--text)]'
                  }`}
                >
                  {m.content || (isGenerating && m.role === 'assistant' ? <TypingDots /> : '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-5 pt-2">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-input)] p-2.5 shadow-sm">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={hasModel ? 'Nhắn gì đó...' : 'Tải model ở Cài đặt để bắt đầu trò chuyện'}
              disabled={!hasModel || ollamaOffline}
              rows={1}
              className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-[var(--text-faint)] disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-2">
                <button
                  title="Đính kèm tệp"
                  className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-active)]"
                >
                  <Paperclip size={17} />
                </button>
                <ModelSelector
                  downloadedModels={downloadedModels}
                  activeModelId={activeModelId}
                  onSelect={onSelectModel}
                  onOpenSettings={onOpenSettings}
                />
              </div>
              <button
                onClick={handleSend}
                disabled={!canSend || !text.trim()}
                title={isGenerating ? 'Model đang trả lời...' : undefined}
                className="rounded-full bg-[var(--accent)] p-2 text-white transition-opacity disabled:opacity-30"
              >
                <ArrowUp size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-faint)] [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-faint)] [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-faint)]" />
    </span>
  );
}
