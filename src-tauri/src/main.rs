#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod contracts;
mod system;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            system::m01_system_discover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
