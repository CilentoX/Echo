import { invoke } from "@tauri-apps/api/core";
import { ECHO_API_CONFIG } from "@/lib/api/config";
import type { Session } from "@/lib/matrix/types";

/**
 * Persistência da sessão no keyring do SO (Windows Credential Manager),
 * via comandos Rust. A sessão completa é serializada como JSON no keyring,
 * incluindo refreshToken, deviceId, apiBaseUrl e expiresAt.
 */

/** Salva a sessão completa no keyring do SO. */
export async function saveSession(session: Session): Promise<void> {
  try {
    await invoke("store_token", {
      userId: session.userId,
      token: session.accessToken,
      refreshToken: session.refreshToken ?? null,
      deviceId: session.deviceId ?? null,
      apiBaseUrl: session.apiBaseUrl ?? null,
      expiresAt: session.expiresAt ?? null,
    });
  } catch {
    // Tauri command not available (e.g. running in browser/dev without Tauri)
  }
}

/** Reconstrói a Session persistida, ou null se não houver sessão salva. */
export async function loadSession(): Promise<Session | null> {
  try {
    const stored = await invoke<{
      userId: string;
      token: string;
      refreshToken: string | null;
      deviceId: string | null;
      apiBaseUrl: string | null;
      expiresAt: number | null;
    } | null>("load_token");
    if (!stored) return null;
    return {
      baseUrl: ECHO_API_CONFIG.baseUrl,
      apiBaseUrl: stored.apiBaseUrl ?? ECHO_API_CONFIG.baseUrl,
      accessToken: stored.token,
      refreshToken: stored.refreshToken ?? "",
      deviceId: stored.deviceId ?? null,
      userId: stored.userId,
      expiresAt: stored.expiresAt ?? 0,
    };
  } catch {
    // Tauri command not available (e.g. running in browser/dev without Tauri)
    return null;
  }
}

/** Remove a sessão persistida do keyring do SO. */
export async function clearSession(): Promise<void> {
  try {
    await invoke("clear_token");
  } catch {
    // Tauri command not available
  }
}

