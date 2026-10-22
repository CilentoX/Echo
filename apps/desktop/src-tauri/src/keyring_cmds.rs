//! Persistência do token de sessão no keyring do SO (Windows Credential
//! Manager, via crate `keyring`).
//!
//! Layout das credenciais, todas sob o serviço "eco":
//! - token:  entry = `<userId>` (o Matrix access token);
//! - ponteiro: entry = "current_user", guardando o userId da sessão ativa.
//!
//! O ponteiro é necessário porque o token vive na entry nomeada pelo
//! próprio userId, e `load_token()` é chamada no boot sem argumentos:
//! sem ele, seria impossível descobrir qual entry ler após reiniciar o app.
//!
//! Comandos Tauri (ver `lib.rs`):
//! - `store_token(user_id, token)`: salva o par userId/accessToken;
//! - `load_token() -> Option<StoredToken>`: lê a sessão persistida;
//! - `clear_token()`: remove as duas entries (idempotente).

use keyring::Entry;
use serde::Serialize;

/// Serviço compartilhado por todas as credenciais do Eco no keyring.
const SERVICE: &str = "eco";

/// Entry que guarda o userId da sessão ativa (ponteiro para a entry do token).
const CURRENT_USER_ENTRY: &str = "current_user";

/// Token persistido, devolvido por `load_token` ao frontend.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredToken {
    pub user_id: String,
    pub token: String,
}

/// Salva o token no keyring e aponta "current_user" para o `user_id` dele.
pub fn store_token(user_id: &str, token: &str) -> Result<(), String> {
    store_token_in(SERVICE, user_id, token)
}

/// Lê a sessão persistida; `None` quando não há sessão salva.
pub fn load_token() -> Result<Option<StoredToken>, String> {
    load_token_in(SERVICE)
}

/// Remove o ponteiro e a entry do token; não falha se já estiverem ausentes.
pub fn clear_token() -> Result<(), String> {
    clear_token_in(SERVICE)
}

fn store_token_in(service: &str, user_id: &str, token: &str) -> Result<(), String> {
    let entry = Entry::new(service, user_id).map_err(|e| keyring_err("salvar o token", e))?;
    entry
        .set_password(token)
        .map_err(|e| keyring_err("salvar o token", e))?;

    let pointer =
        Entry::new(service, CURRENT_USER_ENTRY).map_err(|e| keyring_err("salvar o token", e))?;
    pointer
        .set_password(user_id)
        .map_err(|e| keyring_err("salvar o token", e))?;
    Ok(())
}

fn load_token_in(service: &str) -> Result<Option<StoredToken>, String> {
    let Some(user_id) = read_password(service, CURRENT_USER_ENTRY, "ler o usuário da sessão")?
    else {
        return Ok(None);
    };
    let Some(token) = read_password(service, &user_id, "ler o token")? else {
        return Ok(None);
    };
    Ok(Some(StoredToken { user_id, token }))
}

fn clear_token_in(service: &str) -> Result<(), String> {
    let Some(user_id) = read_password(service, CURRENT_USER_ENTRY, "limpar o token")? else {
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
    let entry = Entry::new(service, entry_name).map_err(|e| keyring_err("limpar o token", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(keyring_err("limpar o token", e)),
    }
}

fn keyring_err(action: &str, err: keyring::Error) -> String {
    format!("falha ao {action} no keyring: {err}")
}

#[cfg(test)]
mod tests {
    use super::*;

    // Cada teste usa um serviço próprio para não competir por estado em
    // paralelo; as credenciais são criadas no Credential Manager real e
    // removidas ao final de cada teste.
    #[test]
    fn store_then_load_roundtrips_token() {
        let service = "eco-cargo-test-roundtrip";
        clear_token_in(service).expect("estado inicial limpo");

        store_token_in(service, "@nina:eco.litteris.online", "syt-at-test-1")
            .expect("token deve ser salvo");

        assert_eq!(
            load_token_in(service).expect("token deve ser lido"),
            Some(StoredToken {
                user_id: "@nina:eco.litteris.online".to_string(),
                token: "syt-at-test-1".to_string(),
            })
        );

        clear_token_in(service).expect("limpeza final");
        assert_eq!(load_token_in(service).expect("leitura"), None);
    }

    #[test]
    fn load_returns_none_without_session() {
        let service = "eco-cargo-test-empty";
        clear_token_in(service).expect("estado inicial limpo");

        assert_eq!(load_token_in(service).expect("leitura"), None);
    }

    #[test]
    fn clear_removes_session_and_is_idempotent() {
        let service = "eco-cargo-test-clear";
        store_token_in(service, "@nina:eco.litteris.online", "syt-at-test-2")
            .expect("token deve ser salvo");

        clear_token_in(service).expect("sessão deve ser limpa");
        clear_token_in(service).expect("segunda limpeza é idempotente");

        assert_eq!(load_token_in(service).expect("leitura"), None);
    }
}
