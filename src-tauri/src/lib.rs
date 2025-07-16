mod types;
mod chat_service;

use types::*;
use chat_service::ChatService;

// Chat viewer commands
#[tauri::command]
async fn get_all_projects() -> Result<Vec<ProjectFolder>, String> {
    let service = ChatService::new();
    service.get_all_projects().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_chat_messages(session_id: String) -> Result<Vec<ChatMessage>, String> {
    let service = ChatService::new();
    service.get_chat_messages(&session_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn search_chats(query: String) -> Result<Vec<SearchResult>, String> {
    let service = ChatService::new();
    service.search_chats(&query).await.map_err(|e| e.to_string())
}

// Legacy greet command for compatibility
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_all_projects,
            get_chat_messages,
            search_chats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
