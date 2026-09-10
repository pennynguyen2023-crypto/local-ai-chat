use std::net::{SocketAddr, TcpStream};
use std::sync::Mutex;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{Manager, RunEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_shell::process::CommandChild;
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
    .manage(OllamaSidecar(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

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
            let lib_dir = app
              .path()
              .resolve("resources/ollama-libs", BaseDirectory::Resource)
              .ok();
            let mut cmd = cmd.arg("serve");
            if let Some(dir) = &lib_dir {
              cmd = cmd.env("OLLAMA_LIBRARY_PATH", dir.to_string_lossy().to_string());
            }
            match cmd.spawn() {
              Ok((_rx, child)) => {
                *app.state::<OllamaSidecar>().0.lock().unwrap() = Some(child);
                log::info!("Đã tự chạy Ollama đóng gói sẵn cho khách (chưa cài Ollama riêng).");
              }
              Err(e) => log::warn!("Không khởi động được Ollama đóng gói sẵn: {e}"),
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
