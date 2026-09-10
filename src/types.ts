export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  /** Ảnh đính kèm — data URL đầy đủ (data:image/...;base64,...), để hiển thị
   * trực tiếp bằng <img>. Lúc gọi Ollama thì bỏ prefix (lib/ollama.ts
   * stripDataUrlPrefix), Ollama chỉ nhận base64 thuần. */
  images?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: number;
  messages: ChatMessage[];
}

export type ModelStatus = 'not_downloaded' | 'downloading' | 'downloaded';

export interface LocalModel {
  id: string;
  name: string;
  paramSize: string;
  fileSize: string;
  ramRequirement: string;
  description: string;
  status: ModelStatus;
  progress?: number;
  /** Model hiểu được ảnh (multimodal) — dùng để tự route tin nhắn có đính kèm
   * ảnh sang model này, không cần khách tự chọn. */
  vision?: boolean;
}
