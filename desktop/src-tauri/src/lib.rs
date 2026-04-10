use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Provider {
    pub id: String,
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "apiKey")]
    pub api_key: String,
    #[serde(rename = "modelName")]
    pub model_name: String,
    #[serde(rename = "contextWindow")]
    pub context_window: Option<u32>,
    pub modalities: Vec<String>,
    pub notes: Option<String>,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_providers,
            add_provider,
            update_provider,
            delete_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
