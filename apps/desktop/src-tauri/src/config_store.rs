//! Gerenciador nativo de configuração e cache offline do Echo Desktop.
//! Armazena arquivos em `%APPDATA%\Echo` no Windows (ou equivalente no macOS/Linux),
//! similar à arquitetura do Discord (`config.json` para preferências e `cache.json` para estado offline).
//!
//! Fornece leitura instantânea em memória e escrita atômica segura em disco.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use tauri::{AppHandle, Manager};

static CONFIG_CACHE: RwLock<Option<Value>> = RwLock::new(None);
static DATA_CACHE: RwLock<Option<Value>> = RwLock::new(None);

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageInfo {
    pub dir_path: String,
    pub config_file_path: String,
    pub cache_file_path: String,
    pub config_size_bytes: u64,
    pub cache_size_bytes: u64,
}

/// Retorna o diretório base do Echo para arquivos de configuração e cache.
/// No Windows: `%APPDATA%\Echo` (ex: `C:\Users\<user>\AppData\Roaming\Echo`).
pub fn get_echo_dir(app: &AppHandle) -> PathBuf {
    #[cfg(target_os = "windows")]
    if let Ok(appdata) = std::env::var("APPDATA") {
        let p = PathBuf::from(appdata).join("Echo");
        let _ = fs::create_dir_all(&p);
        return p;
    }

    if let Ok(p) = app.path().app_config_dir() {
        let _ = fs::create_dir_all(&p);
        return p;
    }

    PathBuf::from(".")
}

fn config_path(app: &AppHandle) -> PathBuf {
    get_echo_dir(app).join("config.json")
}

fn cache_path(app: &AppHandle) -> PathBuf {
    get_echo_dir(app).join("cache.json")
}

/// Escrita atômica segura: grava em arquivo temporário `.tmp` e renomeia
/// para evitar corrupção em caso de queda de energia ou fechamento abrupto.
fn atomic_write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let tmp_path = path.with_extension("tmp");
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| format!("Falha ao serializar JSON: {}", e))?;

    {
        let mut file = File::create(&tmp_path)
            .map_err(|e| format!("Falha ao criar arquivo temporário: {}", e))?;
        file.write_all(content.as_bytes())
            .map_err(|e| format!("Falha ao escrever arquivo temporário: {}", e))?;
        file.sync_all()
            .map_err(|e| format!("Falha ao sincronizar arquivo temporário: {}", e))?;
    }

    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Falha ao renomear arquivo temporário para {:?}: {}", path, e))?;

    Ok(())
}

fn read_json_from_disk(path: &Path) -> Option<Value> {
    if !path.exists() {
        return None;
    }
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).ok(),
        Err(_) => None,
    }
}

// ── Comandos de Configuração (settings/preferences) ──────────────────────

#[tauri::command]
pub fn read_app_config(app: AppHandle) -> Result<Value, String> {
    // 1. Tenta memória rápida (nanossegundos)
    if let Ok(guard) = CONFIG_CACHE.read() {
        if let Some(ref val) = *guard {
            return Ok(val.clone());
        }
    }

    // 2. Lê do disco
    let p = config_path(&app);
    let val = read_json_from_disk(&p).unwrap_or_else(|| json!({}));

    // 3. Atualiza cache em memória
    if let Ok(mut guard) = CONFIG_CACHE.write() {
        *guard = Some(val.clone());
    }

    Ok(val)
}

#[tauri::command]
pub fn write_app_config(app: AppHandle, config: Value) -> Result<(), String> {
    // 1. Atualiza memória imediatamente
    if let Ok(mut guard) = CONFIG_CACHE.write() {
        *guard = Some(config.clone());
    }

    // 2. Persiste atomicamente em disco
    let p = config_path(&app);
    atomic_write_json(&p, &config)
}

#[tauri::command]
pub fn update_app_config_key(app: AppHandle, key: String, value: Value) -> Result<Value, String> {
    let mut current = read_app_config(app.clone())?;
    if let Value::Object(ref mut map) = current {
        map.insert(key, value);
    } else {
        current = json!({ key: value });
    }

    write_app_config(app, current.clone())?;
    Ok(current)
}

// ── Comandos de Cache Offline (guilds, channels, profiles, friends) ──────

#[tauri::command]
pub fn read_app_cache(app: AppHandle) -> Result<Value, String> {
    // 1. Tenta memória rápida
    if let Ok(guard) = DATA_CACHE.read() {
        if let Some(ref val) = *guard {
            return Ok(val.clone());
        }
    }

    // 2. Lê do disco
    let p = cache_path(&app);
    let val = read_json_from_disk(&p).unwrap_or_else(|| json!({}));

    // 3. Atualiza cache em memória
    if let Ok(mut guard) = DATA_CACHE.write() {
        *guard = Some(val.clone());
    }

    Ok(val)
}

#[tauri::command]
pub fn write_app_cache(app: AppHandle, cache: Value) -> Result<(), String> {
    // 1. Atualiza memória imediatamente
    if let Ok(mut guard) = DATA_CACHE.write() {
        *guard = Some(cache.clone());
    }

    // 2. Persiste em disco
    let p = cache_path(&app);
    atomic_write_json(&p, &cache)
}

#[tauri::command]
pub fn update_app_cache_key(app: AppHandle, key: String, value: Value) -> Result<Value, String> {
    let mut current = read_app_cache(app.clone())?;
    if let Value::Object(ref mut map) = current {
        map.insert(key, value);
    } else {
        current = json!({ key: value });
    }

    write_app_cache(app, current.clone())?;
    Ok(current)
}

#[tauri::command]
pub fn clear_app_cache(app: AppHandle) -> Result<(), String> {
    if let Ok(mut guard) = DATA_CACHE.write() {
        *guard = Some(json!({}));
    }

    let p = cache_path(&app);
    if p.exists() {
        let _ = fs::remove_file(p);
    }

    Ok(())
}

#[tauri::command]
pub fn get_app_storage_info(app: AppHandle) -> Result<StorageInfo, String> {
    let dir = get_echo_dir(&app);
    let c_path = config_path(&app);
    let d_path = cache_path(&app);

    let config_size = fs::metadata(&c_path).map(|m| m.len()).unwrap_or(0);
    let cache_size = fs::metadata(&d_path).map(|m| m.len()).unwrap_or(0);

    Ok(StorageInfo {
        dir_path: dir.to_string_lossy().to_string(),
        config_file_path: c_path.to_string_lossy().to_string(),
        cache_file_path: d_path.to_string_lossy().to_string(),
        config_size_bytes: config_size,
        cache_size_bytes: cache_size,
    })
}
