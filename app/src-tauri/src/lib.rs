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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "provider", skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage: Option<String>,
    #[serde(rename = "modelsEndpoint", skip_serializing_if = "Option::is_none")]
    pub models_endpoint: Option<String>,
    #[serde(rename = "modelsAuthStyle", skip_serializing_if = "Option::is_none")]
    pub models_auth_style: Option<String>,
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

fn wallet_dir() -> PathBuf {
    let home = dirs_next::home_dir().expect("Cannot find home directory");
    home.join(".llm-wallet")
}

fn wallet_path() -> PathBuf {
    wallet_dir().join("wallet.json")
}

fn log_path() -> PathBuf {
    wallet_dir().join("log").join("connectivity.log")
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

fn append_log(entry: &str) {
    let path = log_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let now = chrono::Utc::now().to_rfc3339();
    let line = format!("[{}] {}\n", now, entry);
    use std::io::Write;
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(&path) {
        let _ = f.write_all(line.as_bytes());
    }
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
    if !path.exists() {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&path, r#"{"version":"1.0.0","providers":[]}"#)
            .map_err(|e| e.to_string())?;
    }
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Open a URL in the default browser
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Append a connectivity test result to the log file
#[tauri::command]
fn log_connectivity(entry: String) {
    append_log(&entry);
}

/// Fetch models from a provider endpoint (bypasses webview CORS/CSP restrictions)
#[tauri::command]
async fn fetch_models(
    url: String,
    api_key: String,
    auth_style: String,
) -> Result<Vec<serde_json::Value>, String> {
    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let fetch_url = if auth_style == "query_key" {
        let sep = if url.contains('?') { "&" } else { "?" };
        format!("{}{}key={}", url, sep, api_key)
    } else {
        url.clone()
    };

    let mut req = client.get(&fetch_url);

    match auth_style.as_str() {
        "none" | "query_key" => {}
        "github" => {
            req = req
                .header("Authorization", format!("Bearer {}", api_key))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28");
        }
        _ => {
            // "bearer" — default
            req = req.header("Authorization", format!("Bearer {}", api_key));
        }
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    if !status.is_success() {
        let body = res.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status.as_u16(), body.chars().take(300).collect::<String>()));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    // Normalise to array
    let items = if json.is_array() {
        json.as_array().cloned().unwrap_or_default()
    } else if let Some(data) = json.get("data").and_then(|v| v.as_array()) {
        data.clone()
    } else if let Some(models) = json.get("models").and_then(|v| v.as_array()) {
        models.clone()
    } else {
        vec![]
    };

    Ok(items)
}
#[tauri::command]
fn get_known_providers() -> Vec<serde_json::Value> {
    // Try to read from the resource directory
    let candidates = vec![
        // Bundled resource path (production)
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("providers.json"))),
        // Dev: repo root relative to executable
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().and_then(|d| d.parent()).and_then(|d| d.parent()).and_then(|d| d.parent()).and_then(|d| d.parent()).map(|d| d.join("providers.json"))),
    ];

    for candidate in candidates.into_iter().flatten() {
        if candidate.exists() {
            if let Ok(raw) = fs::read_to_string(&candidate) {
                if let Ok(val) = serde_json::from_str::<Vec<serde_json::Value>>(&raw) {
                    return val;
                }
            }
        }
    }
    vec![]
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
            open_url,
            log_connectivity,
            get_known_providers,
            fetch_models,
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
