import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import SettingsModal from './components/SettingsModal';
import { MODEL_CATALOG, VISION_MODEL_ID } from './lib/modelCatalog';
import { loadJSON, saveJSON, uid } from './lib/storage';
import {
  listLocalModels,
  pullModel,
  deleteModel,
  chatStream,
  stripDataUrlPrefix,
  OllamaUnreachableError,
  type OllamaChatMessage,
} from './lib/ollama';
import { loadPersona, buildPersonaSystemPrompt } from './lib/persona';
import { searchRelevantChunks, buildContextSystemPrompt } from './lib/memoryDocs';
import { stripCJK } from './lib/textFilter';
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

  // KHÔNG tự chọn model mặc định — máy mới cài phải trống hoàn toàn, khách tự
  // chọn model muốn dùng (chọn model chưa tải sẽ tự tải về rồi dùng luôn, xem
  // handleDownload). Chỉ tự bỏ chọn nếu model đang dùng bị xóa ở nơi khác.
  useEffect(() => {
    if (activeModelId && !downloadedModels.some((m) => m.id === activeModelId)) {
      setActiveModelId(null);
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

  async function handleSend(text: string, images?: string[]) {
    const hasImages = !!images && images.length > 0;

    // Có ảnh -> tự route sang model hiểu ảnh, chạy ẩn, không cần khách chọn
    // tay. Không có model đó thì báo luôn, không âm thầm gửi ảnh cho model
    // không hiểu ảnh (sẽ trả lời sai/bịa).
    let modelForThisTurn = activeModelId;
    if (hasImages) {
      const visionReady = models.some((m) => m.id === VISION_MODEL_ID && m.status === 'downloaded');
      if (!visionReady) {
        const chat = ensureChat();
        setChats((prev) =>
          prev.map((c) =>
            c.id === chat.id
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    {
                      id: uid(),
                      role: 'assistant',
                      content: '⚠️ Cần tải model hiểu ảnh (Qwen 2.5 VL 7B) trong Cài đặt trước khi gửi ảnh nhé.',
                      createdAt: Date.now(),
                    },
                  ],
                }
              : c,
          ),
        );
        return;
      }
      modelForThisTurn = VISION_MODEL_ID;
    }
    if (!modelForThisTurn) return;

    const chat = ensureChat();
    const userMsg = { id: uid(), role: 'user' as const, content: text, createdAt: Date.now(), images };
    const title = chat.messages.length === 0 ? (text || 'Ảnh đính kèm').slice(0, 40) : chat.title;

    // System prompt xưng hô/emoji/định dạng — CỐ ĐỊNH cho mọi model, không
    // lưu vào lịch sử chat hiển thị (chỉ gửi kèm mỗi lần gọi model).
    const systemMessages: OllamaChatMessage[] = [{ role: 'system', content: buildPersonaSystemPrompt(loadPersona()) }];

    // Tìm đoạn tài liệu liên quan (nếu có) — chỉ vài đoạn liên quan nhất,
    // không nhét cả file, giữ context window thấp.
    if (text.trim()) {
      const relevantChunks = await searchRelevantChunks(text);
      const contextPrompt = buildContextSystemPrompt(relevantChunks);
      if (contextPrompt) systemMessages.push({ role: 'system', content: contextPrompt });
    }

    const historyForModel: OllamaChatMessage[] = [
      ...systemMessages,
      ...[...chat.messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
        images: m.images?.map(stripDataUrlPrefix),
      })),
    ];

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
      // Lọc ký tự tiếng Trung ngay trên từng mẩu chữ stream về — áp dụng cho
      // MỌI model, không riêng model nào (xem lib/textFilter.ts).
      const filtered = stripCJK(delta);
      if (!filtered) return;
      setChats((prev) =>
        prev.map((c) =>
          c.id !== chat.id
            ? c
            : { ...c, messages: c.messages.map((m) => (m.id === assistantId ? { ...m, content: m.content + filtered } : m)) },
        ),
      );
    }

    try {
      await chatStream(modelForThisTurn, historyForModel, appendDelta);
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

  // Tải model = luôn kèm "dùng model này" khi xong (đúng yêu cầu: khách bấm
  // dùng model nào thì tự tải model đó về, không tách 2 bước / không có model
  // mặc định nào được tự chọn sẵn).
  async function handleDownload(id: string) {
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'downloading', progress: 0 } : m)));
    try {
      await pullModel(id, (percent) => {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, progress: percent } : m)));
      });
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'downloaded', progress: 100 } : m)));
      setActiveModelId(id);
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
    // Không tự chọn model khác thay thế — về lại trạng thái "chưa chọn model
    // nào", khách tự chọn tiếp (đúng yêu cầu không có model mặc định).
    if (activeModelId === id) setActiveModelId(null);
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
