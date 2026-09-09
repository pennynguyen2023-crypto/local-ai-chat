export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
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
}
