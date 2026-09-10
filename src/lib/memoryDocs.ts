import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';
import { OLLAMA_BASE_URL, listLocalModels, pullModel } from './ollama';
import { uid } from './storage';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Ollama trả tên model kèm tag đầy đủ trong /api/tags (vd "nomic-embed-text:
// latest") — dùng tag tường minh ở đây để so khớp chính xác, tránh tưởng
// nhầm "chưa tải" rồi pull lại mỗi lần thêm tài liệu.
export const EMBEDDING_MODEL = 'nomic-embed-text:latest';

export interface MemoryDoc {
  id: string;
  name: string;
  addedAt: number;
  chunkCount: number;
}

interface ChunkRecord {
  id: string;
  docId: string;
  docName: string;
  text: string;
  embedding: number[];
}

const DB_NAME = 'localchat-memory';
const DB_VERSION = 1;
const STORE_DOCS = 'documents';
const STORE_CHUNKS = 'chunks';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DOCS)) {
        db.createObjectStore(STORE_DOCS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const store = db.createObjectStore(STORE_CHUNKS, { keyPath: 'id' });
        store.createIndex('docId', 'docId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function listDocuments(): Promise<MemoryDoc[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_DOCS, 'readonly');
  const docs = await reqToPromise(tx.objectStore(STORE_DOCS).getAll() as IDBRequest<MemoryDoc[]>);
  return docs.sort((a, b) => b.addedAt - a.addedAt);
}

async function getAllChunks(): Promise<ChunkRecord[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_CHUNKS, 'readonly');
  return reqToPromise(tx.objectStore(STORE_CHUNKS).getAll() as IDBRequest<ChunkRecord[]>);
}

export async function deleteDocument(docId: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_DOCS).delete(docId);
    const chunkStore = tx.objectStore(STORE_CHUNKS);
    const index = chunkStore.index('docId');
    const cursorReq = index.openCursor(IDBKeyRange.only(docId));
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        chunkStore.delete(cursor.primaryKey);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Cắt tài liệu thành đoạn nhỏ (~1000 ký tự, chồng lấn 150 ký tự) — lúc trả
// lời chỉ nhét đúng vài đoạn liên quan nhất vào context, KHÔNG nhét nguyên
// file mỗi lần hỏi (giữ context window thấp, đúng yêu cầu).
function chunkText(text: string, chunkSize = 1000, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks.filter(Boolean);
}

async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'pdf') {
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    let text = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => ('str' in it ? (it as { str: string }).str : '')).join(' ') + '\n';
    }
    return text;
  }

  if (ext === 'docx') {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value;
  }

  if (ext === 'doc') {
    throw new Error('File .doc (định dạng Word cũ) chưa hỗ trợ — mở file, "Save As" sang .docx rồi thêm lại.');
  }

  // .txt, .md và các file text khác — đọc thẳng.
  return file.text();
}

export async function ensureEmbeddingModelDownloaded(onProgress?: (percent: number) => void): Promise<void> {
  const installed = await listLocalModels();
  if (installed.some((m) => m.name === EMBEDDING_MODEL)) return;
  await pullModel(EMBEDDING_MODEL, (percent) => onProgress?.(percent));
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: EMBEDDING_MODEL, prompt: text }),
  });
  if (!res.ok) throw new Error(`Ollama trả lỗi ${res.status} khi tạo embedding`);
  const json = (await res.json()) as { embedding: number[] };
  return json.embedding;
}

export interface AddDocumentProgress {
  stage: 'model' | 'extracting' | 'embedding';
  percent: number;
}

export async function addDocument(file: File, onProgress?: (p: AddDocumentProgress) => void): Promise<MemoryDoc> {
  onProgress?.({ stage: 'model', percent: 0 });
  await ensureEmbeddingModelDownloaded((percent) => onProgress?.({ stage: 'model', percent }));

  onProgress?.({ stage: 'extracting', percent: 0 });
  const text = await extractText(file);
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error('Không đọc được nội dung chữ nào từ file này.');

  const docId = uid();
  const docName = file.name;
  const chunkRecords: ChunkRecord[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embed(chunks[i]);
    chunkRecords.push({ id: uid(), docId, docName, text: chunks[i], embedding });
    onProgress?.({ stage: 'embedding', percent: ((i + 1) / chunks.length) * 100 });
  }

  const doc: MemoryDoc = { id: docId, name: docName, addedAt: Date.now(), chunkCount: chunks.length };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_DOCS, STORE_CHUNKS], 'readwrite');
    tx.objectStore(STORE_DOCS).put(doc);
    const chunkStore = tx.objectStore(STORE_CHUNKS);
    for (const c of chunkRecords) chunkStore.put(c);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return doc;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface RetrievedChunk {
  docName: string;
  text: string;
  score: number;
}

/** Tìm các đoạn tài liệu liên quan nhất tới câu hỏi — CHỈ trả về top vài đoạn
 * trong giới hạn ký tự, không phải toàn bộ tài liệu, để context window nhỏ
 * nhất có thể. Trả về [] nếu chưa có tài liệu nào hoặc Ollama không truy cập
 * được (không chặn chat bình thường vì lỗi ở tính năng phụ này). */
export async function searchRelevantChunks(query: string, maxChars = 1600, topK = 6): Promise<RetrievedChunk[]> {
  let chunks: ChunkRecord[];
  try {
    chunks = await getAllChunks();
  } catch {
    return [];
  }
  if (chunks.length === 0) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(query);
  } catch {
    return [];
  }

  const scored = chunks
    .map((c) => ({ docName: c.docName, text: c.text, score: cosineSimilarity(queryEmbedding, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const result: RetrievedChunk[] = [];
  let usedChars = 0;
  for (const c of scored) {
    if (usedChars >= maxChars) break;
    result.push(c);
    usedChars += c.text.length;
  }
  return result;
}

export function buildContextSystemPrompt(chunks: RetrievedChunk[]): string | null {
  if (chunks.length === 0) return null;
  const byDoc = new Map<string, string[]>();
  for (const c of chunks) {
    const list = byDoc.get(c.docName) ?? [];
    list.push(c.text);
    byDoc.set(c.docName, list);
  }
  const sections = [...byDoc.entries()]
    .map(([docName, texts]) => `Từ tài liệu "${docName}":\n${texts.join('\n---\n')}`)
    .join('\n\n');
  return `Dưới đây là các đoạn trích liên quan từ tài liệu người dùng đã cung cấp — dùng để trả lời chính xác theo đúng tài liệu này nếu câu hỏi liên quan, không tự bịa thêm ngoài nội dung này:\n\n${sections}`;
}
