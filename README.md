# Local Chat

App chat AI chạy model local (qua [Ollama](https://ollama.com)) — không gửi dữ liệu lên cloud.

## Phát triển

```bash
npm install
npm run dev          # chỉ chạy giao diện web (localhost:5173), cần Ollama đã bật
npx tauri dev         # chạy như app desktop thật (mở cửa sổ native)
```

Cần cài sẵn [Ollama](https://ollama.com) và đang chạy nền (`ollama serve`, hoặc mở app Ollama) — Local Chat gọi thẳng `http://localhost:11434`, không tự cài Ollama giúp bạn ở bản này.

## Build ra app cài đặt (macOS máy đang dùng)

```bash
npx tauri build
```

Kết quả nằm ở `src-tauri/target/release/bundle/` (`.app` + `.dmg`).

## Phát hành cho cả 3 nền tảng (macOS + Windows + Linux)

Máy Mac không tự dựng được bản Windows/Linux thật — dùng GitHub Actions
(`.github/workflows/build.yml`) đã cấu hình sẵn:

1. Đẩy code lên 1 repo GitHub.
2. Tạo + đẩy 1 tag dạng `v0.1.0`:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```
3. Workflow tự chạy, build song song 4 bản (macOS Apple Silicon, macOS Intel,
   Windows, Linux), tạo sẵn 1 **GitHub Release ở trạng thái nháp** kèm đủ
   file cài đặt.
4. Vào tab **Releases** trên GitHub, kiểm tra rồi bấm **Publish** để công khai.
5. Trang landing ([Local Chat Website](../Local%20Chat%20Website)) trỏ thẳng
   tới `github.com/<repo>/releases/latest` — publish xong là link tải hoạt
   động ngay, không cần đổi gì thêm bên landing.

## Auto-start khi mở máy

Đã bật sẵn trong code (`src-tauri/src/lib.rs`, dùng
`tauri-plugin-autostart`) — cài app xong, lần đầu mở lên sẽ tự đăng ký chạy
cùng lúc khởi động máy. Khách có thể tự tắt trong cài đặt hệ thống
(macOS: System Settings → General → Login Items).
