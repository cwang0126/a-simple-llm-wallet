use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, Runtime,
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provider {
    pub id: String,
    #[serde(rename = "providerGroup", skip_serializing_if = "Option::is_none")]
    pub provider_group: Option<String>,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "contextWindow", skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    pub modalities: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(rename = "expiresAt", skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WalletData {
    pub version: String,
    pub providers: Vec<Provider>,
}

fn wallet_path() -> PathBuf {
    let home = dirs_next::home_dir().expect("Cannot find home directory");
    home.join(".llm-wallet").join("wallet.json")
}

fn load_wallet() -> WalletData {
    let path = wallet_path();
    if !path.exists() {
        return WalletData {
            version: "1.0.0".to_string(),
            providers: vec![],
        };
    }
    let raw = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&raw).unwrap_or(WalletData {
        version: "1.0.0".to_string(),
        providers: vec![],
    })
}

fn save_wallet(data: &WalletData) -> Result<(), String> {
    let path = wallet_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(data).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn list_providers() -> Vec<Provider> {
    load_wallet().providers
}

#[tauri::command]
fn add_provider(provider: Provider) -> Result<Provider, String> {
    let mut data = load_wallet();
    data.providers.push(provider.clone());
    save_wallet(&data)?;
    Ok(provider)
}

#[tauri::command]
fn update_provider(provider: Provider) -> Result<Provider, String> {
    let mut data = load_wallet();
    let idx = data
        .providers
        .iter()
        .position(|p| p.id == provider.id)
        .ok_or("Provider not found")?;
    data.providers[idx] = provider.clone();
    save_wallet(&data)?;
    Ok(provider)
}

#[tauri::command]
fn delete_provider(id: String) -> Result<(), String> {
    let mut data = load_wallet();
    let before = data.providers.len();
    data.providers.retain(|p| p.id != id);
    if data.providers.len() == before {
        return Err("Provider not found".to_string());
    }
    save_wallet(&data)
}

#[tauri::command]
fn get_wallet_path() -> String {
    wallet_path().to_string_lossy().to_string()
}

#[tauri::command]
fn open_wallet_file() -> Result<(), String> {
    let path = wallet_path();
    // Ensure the file exists before trying to open it
    if !path.exists() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&path, r#"{"version":"1.0.0","providers":[]}"#)
            .map_err(|e| e.to_string())?;
    }
    // macOS: open with default app (TextEdit / VS Code / etc.)
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_providers,
            add_provider,
            update_provider,
            delete_provider,
            get_wallet_path,
            open_wallet_file,
        ])
        .setup(|app| {
            setup_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show LLM Wallet", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .tooltip("LLM Wallet")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
