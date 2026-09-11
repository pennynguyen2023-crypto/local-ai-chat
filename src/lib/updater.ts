import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdate(): Promise<Update | null> {
  try {
    return await check();
  } catch (err) {
    console.error('[updater] lỗi kiểm tra bản cập nhật:', err);
    return null;
  }
}

/** Tải + cài bản cập nhật, gọi onProgress theo % dựa trên byte đã tải (nếu
 * server trả content-length; nếu không thì chỉ báo trạng thái, không có %). */
export async function installUpdate(update: Update, onProgress: (percent: number | null) => void): Promise<void> {
  let total = 0;
  let downloaded = 0;
  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onProgress(total > 0 ? 0 : null);
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress(total > 0 ? Math.min(100, (downloaded / total) * 100) : null);
        break;
      case 'Finished':
        onProgress(100);
        break;
    }
  });
  await relaunch();
}
