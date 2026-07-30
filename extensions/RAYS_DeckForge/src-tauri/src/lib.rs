use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Spawn FastAPI sidecar
      #[cfg(not(mobile))]
      {
        let shell = app.handle().shell();
        let sidecar = shell.sidecar("fastapi");
        match sidecar {
          Ok(sidecar) => {
            let sidecar = sidecar
              .env("DISABLE_AUTH", "true")
              .args(["--port", "8000", "--reload", "false"]);
            match sidecar.spawn() {
              Ok((mut _rx, _child)) => {
                println!("Successfully spawned FastAPI sidecar process");
              }
              Err(err) => {
                eprintln!("Failed to spawn FastAPI sidecar process: {}", err);
              }
            }
          }
          Err(err) => {
            eprintln!("Failed to create FastAPI sidecar command: {}", err);
          }
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

