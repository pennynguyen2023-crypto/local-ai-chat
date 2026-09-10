import { useEffect, useRef, useState } from 'react';
import { FileText, Upload, Trash2, Loader2 } from 'lucide-react';
import { INTRO_MAX_LEN, loadPersona, savePersona, type PersonaSettings } from '../lib/persona';
import { addDocument, deleteDocument, listDocuments, type AddDocumentProgress, type MemoryDoc } from '../lib/memoryDocs';

export default function MemorySettings() {
  const [persona, setPersona] = useState<PersonaSettings>(() => loadPersona());
  const [docs, setDocs] = useState<MemoryDoc[]>([]);
  const [uploading, setUploading] = useState<{ name: string; progress: AddDocumentProgress } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listDocuments().then(setDocs);
  }, []);

  function updatePersona(patch: Partial<PersonaSettings>) {
    setPersona((prev) => {
      const next = { ...prev, ...patch };
      savePersona(next);
      return next;
    });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (const file of Array.from(files)) {
      setUploading({ name: file.name, progress: { stage: 'model', percent: 0 } });
      try {
        const doc = await addDocument(file, (progress) => setUploading({ name: file.name, progress }));
        setDocs((prev) => [doc, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Lỗi không xác định khi thêm "${file.name}".`);
      } finally {
        setUploading(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleDelete(id: string) {
    await deleteDocument(id);
    setDocs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-medium text-[var(--text)]">Xưng hô & giới thiệu</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Áp dụng cho mọi model, mọi đoạn chat — model nào cũng trả lời theo đúng cách xưng hô này.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">AI gọi bạn là gì?</label>
            <input
              value={persona.calledAs}
              onChange={(e) => updatePersona({ calledAs: e.target.value })}
              placeholder="Vd: Anh Penny"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-muted)]">AI tự xưng là gì?</label>
            <input
              value={persona.aiName}
              onChange={(e) => updatePersona({ aiName: e.target.value })}
              placeholder="Vd: Em"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-muted)]">Giới thiệu chung</label>
              <span className="text-[11px] text-[var(--text-faint)]">
                {persona.intro.length}/{INTRO_MAX_LEN}
              </span>
            </div>
            <input
              value={persona.intro}
              maxLength={INTRO_MAX_LEN}
              onChange={(e) => updatePersona({ intro: e.target.value.slice(0, INTRO_MAX_LEN) })}
              placeholder="Vd: Trợ lý AI hỗ trợ công việc hàng ngày"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-[var(--text)]">Tài liệu (cơ sở kiến thức riêng)</h3>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          Thêm file .pdf/.docx/.txt — khi chat, app tự tìm đoạn liên quan trong tài liệu để trả lời đúng chuyên môn (không
          gửi nguyên file mỗi lần hỏi). Lần đầu thêm tài liệu sẽ tự tải model tìm kiếm (~274 MB).
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!!uploading}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-[var(--bg-active)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload size={13} />
          Thêm tài liệu
        </button>

        {uploading && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
            <Loader2 size={13} className="animate-spin" />
            <span className="min-w-0 flex-1 truncate">
              {uploading.progress.stage === 'model' && `Đang tải model tìm kiếm... ${Math.round(uploading.progress.percent)}%`}
              {uploading.progress.stage === 'extracting' && `Đang đọc "${uploading.name}"...`}
              {uploading.progress.stage === 'embedding' &&
                `Đang xử lý "${uploading.name}"... ${Math.round(uploading.progress.percent)}%`}
            </span>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-[var(--danger)]">⚠️ {error}</p>}

        <div className="mt-3 space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={14} className="shrink-0 text-[var(--text-faint)]" />
                <span className="min-w-0 truncate text-xs text-[var(--text)]">{d.name}</span>
                <span className="shrink-0 text-[11px] text-[var(--text-faint)]">{d.chunkCount} đoạn</span>
              </div>
              <button onClick={() => handleDelete(d.id)} className="shrink-0 text-[var(--text-faint)] hover:text-[var(--danger)]">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {docs.length === 0 && !uploading && <p className="text-xs text-[var(--text-faint)]">Chưa có tài liệu nào.</p>}
        </div>
      </section>
    </div>
  );
}
