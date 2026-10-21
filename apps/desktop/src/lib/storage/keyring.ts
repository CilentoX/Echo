import { invoke } from "@tauri-apps/api/core";
import { ECO_HOMESERVER_URL } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";

/**
 * Persistência da sessão no keyring do SO (Windows Credential Manager),
 * via comandos Rust. Apenas o par userId/accessToken é guardado; o
 * homeserver é sempre o da rede Eco (fonte única em sso.ts).
 */

/** Salva o access token da sessão no keyring do SO. */
export async function saveSession(session: Session): Promise<void> {
  await invoke("store_token", {
    userId: session.userId,
    token: session.accessToken,
  });
}

/** Reconstrói a Session persistida, ou null se não houver sessão salva. */
export async function loadSession(): Promise<Session | null> {
  const stored = await invoke<{ userId: string; token: string } | null>("load_token");
  if (!stored) return null;
  return {
    baseUrl: ECO_HOMESERVER_URL,
    accessToken: stored.token,
    userId: stored.userId,
    deviceId: null,
  };
}

/** Remove a sessão persistida do keyring do SO. */
export async function clearSession(): Promise<void> {
  await invoke("clear_token");
}
