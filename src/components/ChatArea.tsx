import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Paperclip, WifiOff, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatSession, LocalModel } from '../types';
import ModelSelector from './ModelSelector';
import logo from '../assets/logo.png';

interface ChatAreaProps {
  chat: ChatSession | null;
  onSend: (text: string, images?: string[]) => void;
  downloadedModels: LocalModel[];
  activeModelId: string | null;
  onSelectModel: (id: string) => void;
  onOpenSettings: () => void;
  isGenerating: boolean;
  ollamaOffline: boolean;
}

interface Attachment {
  id: string;
  dataUrl: string;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasModel = downloadedModels.length > 0;
  const canSend = hasModel && !isGenerating && !ollamaOffline;
  const messages = chat?.messages ?? [];

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, messages[messages.length - 1]?.content]);

  async function addImageFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    const withUrls = await Promise.all(
      images.map(async (f) => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, dataUrl: await fileToDataUrl(f) })),
    );
    setAttachments((prev) => [...prev, ...withUrls]);
  }

  function handleSend() {
    const value = text.trim();
    if ((!value && attachments.length === 0) || !canSend) return;
    onSend(value, attachments.length > 0 ? attachments.map((a) => a.dataUrl) : undefined);
    setText('');
    setAttachments([]);
  }

  return (
    <main
      className="relative flex h-full min-w-0 flex-1 flex-col bg-[var(--bg)]"
      onDragOver={(e) => {
        e.preventDefault();
        if (e.dataTransfer.types.includes('Files')) setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        addImageFiles(Array.from(e.dataTransfer.files));
      }}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--accent)] bg-[var(--accent-soft)]/60">
          <span className="text-sm font-medium text-[var(--accent)]">Thả ảnh vào đây</span>
        </div>
      )}
      {ollamaOffline && (
        <div className="flex items-center justify-center gap-2 bg-[var(--danger)]/10 px-4 py-2 text-xs font-medium text-[var(--danger)]">
          <WifiOff size={13} />
          Không kết nối được tới Ollama trên máy — mở ứng dụng Ollama rồi thử lại.
        </div>
      )}
      {messages.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <img src={logo} alt="" className="h-16 w-16" />
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
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    m.role === 'user' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-input)] text-[var(--text)]'
                  }`}
                >
                  {m.images && m.images.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {m.images.map((src, i) => (
                        <img key={i} src={src} alt="" className="h-24 w-24 rounded-lg object-cover" />
                      ))}
                    </div>
                  )}
                  {m.role === 'assistant' ? (
                    m.content ? (
                      <div className="markdown-body">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      isGenerating && <TypingDots />
                    )
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-6 pb-5 pt-2">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-input)] p-2.5 shadow-sm">
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5 px-1">
                {attachments.map((a) => (
                  <div key={a.id} className="group relative">
                    <img src={a.dataUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                      className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--bg)] p-0.5 text-[var(--text-muted)] shadow hover:text-[var(--danger)]"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.items)
                  .filter((it) => it.kind === 'file' && it.type.startsWith('image/'))
                  .map((it) => it.getAsFile())
                  .filter((f): f is File => !!f);
                if (files.length > 0) {
                  e.preventDefault();
                  addImageFiles(files);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={hasModel ? 'Nhắn gì đó, hoặc dán/kéo thả ảnh vào đây...' : 'Tải model ở Cài đặt để bắt đầu trò chuyện'}
              disabled={!hasModel || ollamaOffline}
              rows={1}
              className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-[15px] outline-none placeholder:text-[var(--text-faint)] disabled:cursor-not-allowed"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addImageFiles(Array.from(e.target.files ?? []));
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <div className="flex items-center justify-between px-1 pt-1">
              <div className="flex items-center gap-2">
                <button
                  title="Đính kèm ảnh"
                  onClick={() => fileInputRef.current?.click()}
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
                disabled={!canSend || (!text.trim() && attachments.length === 0)}
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
