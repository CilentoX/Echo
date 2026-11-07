//! Persistência da sessão completa no keyring do SO (Windows Credential
//! Manager, via crate `keyring`).
//!
//! Layout das credenciais, todas sob o serviço "eco":
//! - session: entry = `<userId>` (JSON com todos os campos da sessão);
//! - ponteiro: entry = "current_user", guardando o userId da sessão ativa.
//!
//! O ponteiro é necessário porque a sessão vive na entry nomeada pelo
//! próprio userId, e `load_token()` é chamada no boot sem argumentos:
//! sem ele, seria impossível descobrir qual entry ler após reiniciar o app.
//!
//! Comandos Tauri (ver `lib.rs`):
//! - `store_token(user_id, token, refresh_token, device_id, api_base_url, expires_at)`: salva a sessão completa;
//! - `load_token() -> Option<StoredToken>`: lê a sessão persistida;
//! - `clear_token()`: remove as duas entries (idempotente).

use keyring::Entry;
use serde::{Deserialize, Serialize};

/// Serviço compartilhado por todas as credenciais do Eco no keyring.
const SERVICE: &str = "eco";

/// Entry que guarda o userId da sessão ativa (ponteiro para a entry da sessão).
const CURRENT_USER_ENTRY: &str = "current_user";

/// Sessão persistida, devolvida por `load_token` ao frontend.
#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredToken {
    pub user_id: String,
    pub token: String,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub device_id: Option<String>,
    #[serde(default)]
    pub api_base_url: Option<String>,
    #[serde(default)]
    pub expires_at: Option<u64>,
}

/// Salva a sessão completa no keyring e aponta "current_user" para o `user_id`.
pub fn store_token(
    user_id: &str,
    token: &str,
    refresh_token: Option<&str>,
    device_id: Option<&str>,
    api_base_url: Option<&str>,
    expires_at: Option<u64>,
) -> Result<(), String> {
    let stored = StoredToken {
        user_id: user_id.to_string(),
        token: token.to_string(),
        refresh_token: refresh_token.map(|s| s.to_string()),
        device_id: device_id.map(|s| s.to_string()),
        api_base_url: api_base_url.map(|s| s.to_string()),
        expires_at,
    };
    let json = serde_json::to_string(&stored).map_err(|e| format!("falha ao serializar sessão: {e}"))?;
    store_session_in(SERVICE, user_id, &json)
}

/// Lê a sessão persistida; `None` quando não há sessão salva.
pub fn load_token() -> Result<Option<StoredToken>, String> {
    load_token_in(SERVICE)
}

/// Remove o ponteiro e a entry da sessão; não falha se já estiverem ausentes.
pub fn clear_token() -> Result<(), String> {
    clear_token_in(SERVICE)
}

fn store_session_in(service: &str, user_id: &str, json: &str) -> Result<(), String> {
    let entry = Entry::new(service, user_id).map_err(|e| keyring_err("salvar a sessão", e))?;
    entry
        .set_password(json)
        .map_err(|e| keyring_err("salvar a sessão", e))?;

    let pointer =
        Entry::new(service, CURRENT_USER_ENTRY).map_err(|e| keyring_err("salvar a sessão", e))?;
    pointer
        .set_password(user_id)
        .map_err(|e| keyring_err("salvar a sessão", e))?;
    Ok(())
}

fn load_token_in(service: &str) -> Result<Option<StoredToken>, String> {
    let Some(user_id) = read_password(service, CURRENT_USER_ENTRY, "ler o usuário da sessão")?
    else {
        return Ok(None);
    };
    let Some(json) = read_password(service, &user_id, "ler a sessão")? else {
        return Ok(None);
    };

    // Tenta desserializar como StoredToken completo; fallback para formato legado (apenas token string)
    match serde_json::from_str::<StoredToken>(&json) {
        Ok(stored) => Ok(Some(stored)),
        Err(_) => {
            // Formato legado: a entry contém apenas o token plaintext, não JSON
            Ok(Some(StoredToken {
                user_id,
                token: json,
                refresh_token: None,
                device_id: None,
                api_base_url: None,
                expires_at: None,
            }))
        }
    }
}

fn clear_token_in(service: &str) -> Result<(), String> {
    let Some(user_id) = read_password(service, CURRENT_USER_ENTRY, "limpar a sessão")? else {
        return Ok(());
    };
    delete_credential(service, CURRENT_USER_ENTRY)?;
    delete_credential(service, &user_id)?;
    Ok(())
}

/// Lê uma senha do keyring; `None` quando a entry não existe.
fn read_password(service: &str, entry_name: &str, action: &str) -> Result<Option<String>, String> {
    let entry = Entry::new(service, entry_name).map_err(|e| keyring_err(action, e))?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keyring_err(action, e)),
    }
}

/// Remove uma credencial do keyring; `NoEntry` é tratado como sucesso.
fn delete_credential(service: &str, entry_name: &str) -> Result<(), String> {
    let entry = Entry::new(service, entry_name).map_err(|e| keyring_err("limpar a sessão", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keyring_err("limpar a sessão", e)),
    }
}

fn keyring_err(action: &str, err: keyring::Error) -> String {
    format!("falha ao {action} no keyring: {err}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn store_then_load_roundtrips_full_session() {
        let service = "eco-cargo-test-roundtrip-v2";
        clear_token_in(service).expect("estado inicial limpo");

        store_token(
            "@nina:eco.litteris.online",
            "syt-at-test-1",
            Some("syt-rt-test-1"),
            Some("DEVICE01"),
            Some("https://echo-api.litteris.online"),
            Some(1700000000),
        )
        .expect("sessão deve ser salva");

        let loaded = load_token_in(service).expect("sessão deve ser lida").unwrap();
        assert_eq!(loaded.user_id, "@nina:eco.litteris.online");
        assert_eq!(loaded.token, "syt-at-test-1");
        assert_eq!(loaded.refresh_token.as_deref(), Some("syt-rt-test-1"));
        assert_eq!(loaded.device_id.as_deref(), Some("DEVICE01"));
        assert_eq!(loaded.api_base_url.as_deref(), Some("https://echo-api.litteris.online"));
        assert_eq!(loaded.expires_at, Some(1700000000));

        clear_token_in(service).expect("limpeza final");
        assert_eq!(load_token_in(service).expect("leitura"), None);
    }

    #[test]
    fn load_legacy_plaintext_token_returns_stored_token_with_defaults() {
        let service = "eco-cargo-test-legacy";
        clear_token_in(service).expect("estado inicial limpo");

        // Simula formato legado: entry contém apenas o token plaintext
        store_session_in(service, "@legacy:eco.litteris.online", "syt-legacy-token")
            .expect("token legado deve ser salvo");
        // Aponta o current_user
        let pointer = Entry::new(service, CURRENT_USER_ENTRY).unwrap();
        pointer.set_password("@legacy:eco.litteris.online").unwrap();

        let loaded = load_token_in(service).expect("sessão legada deve ser lida").unwrap();
        assert_eq!(loaded.user_id, "@legacy:eco.litteris.online");
        assert_eq!(loaded.token, "syt-legacy-token");
        assert_eq!(loaded.refresh_token, None);
        assert_eq!(loaded.device_id, None);
        assert_eq!(loaded.api_base_url, None);
        assert_eq!(loaded.expires_at, None);

        clear_token_in(service).expect("limpeza final");
    }

    #[test]
    fn load_returns_none_without_session() {
        let service = "eco-cargo-test-empty-v2";
        clear_token_in(service).expect("estado inicial limpo");
        assert_eq!(load_token_in(service).expect("leitura"), None);
    }

    #[test]
    fn clear_removes_session_and_is_idempotent() {
        let service = "eco-cargo-test-clear-v2";
        store_token("@nina:eco.litteris.online", "syt-at-test-2", None, None, None, None)
            .expect("sessão deve ser salva");

        clear_token_in(service).expect("sessão deve ser limpa");
        clear_token_in(service).expect("segunda limpeza é idempotente");

        assert_eq!(load_token_in(service).expect("leitura"), None);
    }
}