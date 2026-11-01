import { invoke } from "@tauri-apps/api/core";
import { ECHO_HOMESERVER_URL } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";

/**
 * Persistência da sessão no keyring do SO (Windows Credential Manager),
 * via comandos Rust. Apenas o par userId/accessToken é guardado; o
 * homeserver é sempre o da rede Eco (fonte única em sso.ts).
 */

/** Salva a sessão completa no keyring do SO. */
export async function saveSession(session: Session): Promise<void> {
  await invoke("store_token", {
    userId: session.userId,
    token: session.accessToken,
    refreshToken: session.refreshToken,
    deviceId: session.deviceId,
    apiBaseUrl: session.apiBaseUrl,
    expiresAt: session.expiresAt,
  });
}

/** Reconstrói a Session persistida, ou null se não houver sessão salva. */
export async function loadSession(): Promise<Session | null> {
  const stored = await invoke<
    | {
        userId: string;
        token: string;
        refreshToken: string;
        deviceId: string | null;
        apiBaseUrl: string;
        expiresAt: number;
      }
    | null>(
    "load_token",
  );
  if (!stored) return null;
  return {
    baseUrl: ECHO_HOMESERVER_URL,
    apiBaseUrl: stored.apiBaseUrl,
    accessToken: stored.token,
    refreshToken: stored.refreshToken,
    deviceId: stored.deviceId ?? null,
    userId: stored.userId,
    expiresAt: stored.expiresAt,
  };
}

/** Remove a sessão persistida do keyring do SO. */
export async function clearSession(): Promise<void> {
  await invoke("clear_token");
}

/** Armazena um valor no keyring (interface compatível com keyv/Storage). */
export async function setItem(key: string, value: string): Promise<void> {
  await invoke("set_item", { key, value });
}

/** Recupera um valor do keyring. */
export async function getItem(key: string): Promise<string | null> {
  return invoke("get_item", { key });
}

/** Remove um item do keyring. */
export async function removeItem(key: string): Promise<void> {
  await invoke("remove_item", { key });
}

/** Interface compatível com keyv/Storage para compatibilidade. */
export const useKeyring = {
  setItem,
  getItem,
  removeItem,
};
