use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{Manager, RunEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Tiến trình Ollama do CHÍNH app này khởi động (nếu có) — chỉ app tự tắt
/// tiến trình này lúc thoát, không bao giờ đụng tới Ollama khách tự cài/chạy
/// sẵn từ trước (trường hợp đó is_ollama_running() đã true, không lưu gì ở đây).
struct OllamaSidecar(Mutex<Option<CommandChild>>);

fn is_ollama_running() -> bool {
  let addr: SocketAddr = "127.0.0.1:11434".parse().expect("địa chỉ hợp lệ");
  TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(OllamaSidecar(Mutex::new(None)))
    .setup(|app| {
      // Ghi log ra FILE luôn, kể cả bản release (không chỉ lúc `tauri dev`
      // như trước) — không có bước này thì lúc khách báo lỗi, không có cách
      // nào biết chuyện gì đang xảy ra bên trong app đã đóng gói. macOS:
      // ~/Library/Logs/com.pennybuilder.localchat/ ; Windows/Linux: xem
      // đường dẫn `app_log_dir` Tauri in ra tương ứng từng OS.
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .targets([Target::new(TargetKind::LogDir { file_name: None }), Target::new(TargetKind::Stdout)])
          .build(),
      )?;

      // Mở app là tự bật auto-start khi khởi động máy (đúng yêu cầu: "dù tắt
      // máy thì app desktop vẫn chạy lại khi mở máy lên") — chỉ set 1 lần lúc
      // chưa bật, không ép lại mỗi lần mở app (khách có quyền tự tắt trong hệ
      // thống, không nên tự động bật lại đè lên lựa chọn đó).
      use tauri_plugin_autostart::ManagerExt;
      let autolaunch = app.autolaunch();
      if let Ok(false) = autolaunch.is_enabled() {
        let _ = autolaunch.enable();
      }

      // Ollama đóng gói sẵn (CPU-only — xem .github/workflows/build.yml) để
      // khách KHÔNG cần tự cài Ollama riêng. Chỉ tự chạy khi cổng 11434 CHƯA
      // có gì lắng nghe — nếu khách đã tự cài Ollama riêng (vd để dùng GPU),
      // dùng luôn cái đó, không giành cổng/chạy chồng 2 tiến trình.
      if is_ollama_running() {
        log::info!("Đã có Ollama chạy sẵn trên máy — dùng luôn, không tự chạy bản đóng gói.");
      } else {
        match app.shell().sidecar("ollama") {
          Ok(cmd) => {
            // Thư mục chứa các file backend (ggml/llama...) đóng gói kèm —
            // dùng OLLAMA_LIBRARY_PATH thay vì để Ollama tự đoán theo cấu
            // trúc thư mục tương đối mặc định (dễ vỡ giữa các cách đóng gói
            // khác nhau của Tauri trên từng hệ điều hành).
            let lib_dir = app.path().resolve("resources/ollama-libs", BaseDirectory::Resource);
            match &lib_dir {
              Ok(p) => log::info!("OLLAMA_LIBRARY_PATH sẽ set = {}", p.display()),
              Err(e) => log::warn!("Không resolve được resources/ollama-libs: {e} — Ollama sẽ tự đoán đường dẫn mặc định, có thể lỗi."),
            }
            let mut cmd = cmd.arg("serve");
            if let Ok(dir) = &lib_dir {
              cmd = cmd.env("OLLAMA_LIBRARY_PATH", dir.to_string_lossy().to_string());
            }
            match cmd.spawn() {
              Ok((mut rx, child)) => {
                log::info!("Đã spawn tiến trình Ollama đóng gói sẵn (pid={}).", child.pid());
                *app.state::<OllamaSidecar>().0.lock().unwrap() = Some(child);
                // Log lại toàn bộ stdout/stderr thật của Ollama — trước đây
                // bỏ qua hoàn toàn (_rx), nên nếu Ollama tự thoát ngay vì lỗi
                // thiếu thư viện backend, app không hề biết/log lại gì cả.
                tauri::async_runtime::spawn(async move {
                  while let Some(event) = rx.recv().await {
                    match event {
                      CommandEvent::Stdout(line) => log::info!("[ollama] {}", String::from_utf8_lossy(&line)),
                      CommandEvent::Stderr(line) => log::warn!("[ollama] {}", String::from_utf8_lossy(&line)),
                      CommandEvent::Error(err) => log::error!("[ollama] lỗi tiến trình: {err}"),
                      CommandEvent::Terminated(payload) => {
                        log::warn!("[ollama] tiến trình đã thoát: {:?}", payload);
                        break;
                      }
                      _ => {}
                    }
                  }
                });
              }
              Err(e) => log::error!("Không khởi động được Ollama đóng gói sẵn: {e}"),
            }
          }
          // Bình thường khi chạy `tauri dev` (chưa tải binary Ollama về) —
          // app vẫn hoạt động như trước, chỉ là khách phải tự cài Ollama.
          Err(e) => log::warn!("Không tìm thấy Ollama đóng gói sẵn: {e}"),
        }
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let RunEvent::ExitRequested { .. } = event {
        if let Some(child) = app_handle.state::<OllamaSidecar>().0.lock().unwrap().take() {
          let _ = child.kill();
        }
      }
    });
}
