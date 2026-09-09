// Client gọi thẳng Ollama local (mặc định http://localhost:11434) — không qua
// server trung gian nào, đúng tinh thần "chạy hẳn trên máy khách". Ollama tự
// set CORS cho phép origin localhost (đã xác nhận qua preflight) nên gọi được
// thẳng từ webview, không cần proxy.

export const OLLAMA_BASE_URL = 'http://localhost:11434';

export interface OllamaTagModel {
  name: string;
  size: number;
  parameterSize: string;
}

export class OllamaUnreachableError extends Error {
  constructor() {
    super('Không kết nối được tới Ollama — kiểm tra Ollama đã chạy trên máy chưa.');
    this.name = 'OllamaUnreachableError';
  }
}

async function ollamaFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${OLLAMA_BASE_URL}${path}`, init);
  } catch {
    throw new OllamaUnreachableError();
  }
}

/** Model đã có sẵn trên máy (đã `ollama pull`) — dùng để đồng bộ trạng thái
 * "đã tải" thật, không dựa vào localStorage (khách có thể đã tải qua terminal
 * hoặc gỡ bớt model ở nơi khác, localStorage dễ lệch với thực tế đĩa). */
export async function listLocalModels(): Promise<OllamaTagModel[]> {
  const res = await ollamaFetch('/api/tags');
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status} khi lấy danh sách model`);
  const json = (await res.json()) as { models?: Array<{ name: string; size: number; details?: { parameter_size?: string } }> };
  return (json.models ?? []).map((m) => ({ name: m.name, size: m.size, parameterSize: m.details?.parameter_size ?? '' }));
}

/**
 * Tải 1 model — Ollama trả về NDJSON (mỗi dòng 1 object tiến trình) qua
 * response.body dạng stream, KHÔNG phải 1 JSON tổng ở cuối. Gọi onProgress
 * mỗi khi có cập nhật completed/total (byte) để vẽ progress bar % thật, thay
 * vì giả lập bằng setInterval.
 */
export async function pullModel(name: string, onProgress: (percent: number, status: string) => void): Promise<void> {
  const res = await ollamaFetch('/api/pull', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Ollama trả lỗi ${res.status} khi tải model`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as { status: string; completed?: number; total?: number; error?: string };
      if (evt.error) throw new Error(evt.error);
      const percent = evt.total && evt.completed ? Math.min(100, (evt.completed / evt.total) * 100) : evt.status === 'success' ? 100 : 0;
      onProgress(percent, evt.status);
    }
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await ollamaFetch('/api/delete', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: name }),
  });
  if (!res.ok && res.status !== 404) throw new Error(`Ollama trả lỗi ${res.status} khi xóa model`);
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat streaming — cũng NDJSON, mỗi dòng {message:{content: "..."}, done}.
 * onDelta nhận từng mẩu chữ ngay khi model sinh ra, giống hệt hiệu ứng gõ chữ
 * dần của ChatGPT/Claude. Trả lại toàn văn cuối cùng để caller lưu lại.
 */
export async function chatStream(
  model: string,
  messages: OllamaChatMessage[],
  onDelta: (delta: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await ollamaFetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama trả lỗi ${res.status} khi chat${text ? `: ${text.slice(0, 200)}` : ''}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as { message?: { content?: string }; done?: boolean; error?: string };
      if (evt.error) throw new Error(evt.error);
      const delta = evt.message?.content ?? '';
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
  }
  return full;
}
