import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { MODEL_CATALOG } from './lib/modelCatalog';
import { loadJSON, saveJSON, uid } from './lib/storage';
import { listLocalModels, pullModel, deleteModel, chatStream, OllamaUnreachableError, type OllamaChatMessage } from './lib/ollama';
import type { ChatSession, LocalModel } from './types';

const CHATS_KEY = 'localchat:chats';
const ACTIVE_MODEL_KEY = 'localchat:activeModel';

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function App() {
  const [chats, setChats] = useState<ChatSession[]>(() => loadJSON(CHATS_KEY, []));
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [models, setModels] = useState<LocalModel[]>(MODEL_CATALOG);
  const [activeModelId, setActiveModelId] = useState<string | null>(() => loadJSON(ACTIVE_MODEL_KEY, null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ollamaOffline, setOllamaOffline] = useState(false);
  const [generatingChatId, setGeneratingChatId] = useState<string | null>(null);

  useEffect(() => saveJSON(CHATS_KEY, chats), [chats]);
  useEffect(() => saveJSON(ACTIVE_MODEL_KEY, activeModelId), [activeModelId]);

  // Nguồn sự thật cho "model đã tải" là chính Ollama (đĩa thật), KHÔNG phải
  // localStorage — khách có thể đã pull/xóa model qua terminal, hoặc app mở
  // lại sau khi máy khởi động lại. Đồng bộ lại mỗi khi app mở.
  useEffect(() => {
    refreshInstalledModels();
  }, []);

  async function refreshInstalledModels() {
    try {
      const installed = await listLocalModels();
      setOllamaOffline(false);
      setModels((prev) => {
        const next: LocalModel[] = prev.map((m) => {
          const found = installed.find((i) => i.name === m.id);
          return found ? { ...m, status: 'downloaded' as const, progress: 100 } : { ...m, status: m.status === 'downloading' ? m.status : ('not_downloaded' as const) };
        });
        // Model khách đã cài qua nơi khác (terminal, app khác) mà không nằm
        // trong danh mục gợi ý sẵn — vẫn phải hiện ra để chọn dùng được, không
        // được "giấu" model thật đã có trên máy.
        for (const i of installed) {
          if (!next.some((m) => m.id === i.name)) {
            next.push({
              id: i.name,
              name: i.name,
              paramSize: i.parameterSize || '—',
              fileSize: formatBytes(i.size),
              ramRequirement: '—',
              description: 'Model đã có sẵn trên máy (cài ngoài danh mục gợi ý).',
              status: 'downloaded',
              progress: 100,
            });
          }
        }
        return next;
      });
    } catch (err) {
      if (err instanceof OllamaUnreachableError) setOllamaOffline(true);
    }
  }

  const downloadedModels = models.filter((m) => m.status === 'downloaded');

  // Mặc định tự chọn model nếu chưa chọn cái nào (đúng yêu cầu: "mặc định là
  // model được tải nếu chỉ có tải 1 model") — cũng tự sửa nếu model đang chọn
  // đã bị xóa ở nơi khác.
  useEffect(() => {
    if (downloadedModels.length === 0) return;
    if (!activeModelId || !downloadedModels.some((m) => m.id === activeModelId)) {
      setActiveModelId(downloadedModels[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadedModels.map((m) => m.id).join(',')]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  function handleNewChat() {
    setActiveChatId(null);
  }

  function ensureChat(): ChatSession {
    if (activeChat) return activeChat;
    const chat: ChatSession = { id: uid(), title: 'Đoạn chat mới', pinned: false, updatedAt: Date.now(), messages: [] };
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    return chat;
  }

  async function handleSend(text: string) {
    if (!activeModelId) return;
    const chat = ensureChat();
    const userMsg = { id: uid(), role: 'user' as const, content: text, createdAt: Date.now() };
    const title = chat.messages.length === 0 ? text.slice(0, 40) : chat.title;
    const historyForModel: OllamaChatMessage[] = [...chat.messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const assistantId = uid();
    setChats((prev) =>
      prev.map((c) =>
        c.id === chat.id
          ? {
              ...c,
              title,
              messages: [...c.messages, userMsg, { id: assistantId, role: 'assistant', content: '', createdAt: Date.now() }],
              updatedAt: Date.now(),
            }
          : c,
      ),
    );

    setGeneratingChatId(chat.id);
    function appendDelta(delta: string) {
      setChats((prev) =>
        prev.map((c) =>
          c.id !== chat.id
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: m.content + delta } : m)) },
        ),
      );
    }

    try {
      await chatStream(activeModelId, historyForModel, appendDelta);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định khi chat với model.';
      appendDelta(`\n\n⚠️ ${message}`);
    } finally {
      setGeneratingChatId(null);
    }
  }

  function handleDeleteChat(id: string) {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  }

  function handleTogglePin(id: string) {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, pinned: !c.pinned } : c)));
  }

  function handleRename(id: string, title: string) {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }

  async function handleDownload(id: string) {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'downloading', progress: 0 } : m)));
    try {
      await pullModel(id, (percent) => {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, progress: percent } : m)));
      });
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'downloaded', progress: 100 } : m)));
    } catch (err) {
      console.error('[handleDownload] lỗi tải model:', err);
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'not_downloaded', progress: 0 } : m)));
    }
  }

  async function handleDeleteModel(id: string) {
    try {
      await deleteModel(id);
    } catch (err) {
      console.error('[handleDeleteModel] lỗi xóa model:', err);
      return;
    }
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'not_downloaded', progress: 0 } : m)));
    if (activeModelId === id) {
      const remaining = models.filter((m) => m.status === 'downloaded' && m.id !== id);
      setActiveModelId(remaining[0]?.id ?? null);
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar
        chats={chats}
        activeId={activeChatId}
        onSelect={setActiveChatId}
        onNew={handleNewChat}
        onDelete={handleDeleteChat}
        onTogglePin={handleTogglePin}
        onRename={handleRename}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatArea
        chat={activeChat}
        onSend={handleSend}
        downloadedModels={downloadedModels}
        activeModelId={activeModelId}
        onSelectModel={setActiveModelId}
        onOpenSettings={() => setSettingsOpen(true)}
        isGenerating={activeChat?.id === generatingChatId}
        ollamaOffline={ollamaOffline}
      />
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        models={models}
        activeModelId={activeModelId}
        onDownload={handleDownload}
        onDelete={handleDeleteModel}
        onSetActive={setActiveModelId}
        ollamaOffline={ollamaOffline}
        onRetryConnection={refreshInstalledModels}
      />
    </div>
  );
}
