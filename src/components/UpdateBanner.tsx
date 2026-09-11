import { useState } from 'react';
import { Download, X, Loader2 } from 'lucide-react';
import type { Update } from '@tauri-apps/plugin-updater';
import { installUpdate } from '../lib/updater';

interface UpdateBannerProps {
  update: Update;
  onDismiss: () => void;
}

export default function UpdateBanner({ update, onDismiss }: UpdateBannerProps) {
  const [installing, setInstalling] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleInstall() {
    setInstalling(true);
    setError(null);
    try {
      await installUpdate(update, setPercent);
      // installUpdate tự relaunch app khi xong — code sau dòng này thường
      // không kịp chạy vì app đã khởi động lại.
    } catch (err) {
      setInstalling(false);
      setError(err instanceof Error ? err.message : 'Lỗi không xác định khi cài bản cập nhật.');
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--accent-soft)] px-4 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-2 text-[var(--accent)]">
        <Download size={14} className="shrink-0" />
        <span className="min-w-0 truncate font-medium">
          {installing
            ? percent !== null
              ? `Đang tải bản cập nhật ${update.version}... ${Math.round(percent)}%`
              : `Đang tải bản cập nhật ${update.version}...`
            : `Có bản cập nhật mới: v${update.version}`}
        </span>
      </div>
      {error && <span className="text-[var(--danger)]">⚠️ {error}</span>}
      <div className="flex shrink-0 items-center gap-2">
        {!installing && (
          <>
            <button
              onClick={handleInstall}
              className="rounded-full bg-[var(--accent)] px-3 py-1 font-medium text-white hover:opacity-90"
            >
              Cài đặt & khởi động lại
            </button>
            <button onClick={onDismiss} className="rounded-full p-1 text-[var(--text-faint)] hover:bg-[var(--bg-hover)]">
              <X size={13} />
            </button>
          </>
        )}
        {installing && <Loader2 size={14} className="animate-spin text-[var(--accent)]" />}
      </div>
    </div>
  );
}
