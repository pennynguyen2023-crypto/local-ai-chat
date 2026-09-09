use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
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

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
