/**
 * Echo API configuration.
 * A API própria roda no Coolify + VPS.
 * URL deve ser definida via VITE_ECHO_API_URL.
 * Default: https://api.echo.litteris.online
 */

export const ECHO_API_CONFIG = {
  baseUrl: import.meta.env.VITE_ECHO_API_URL ?? "https://api.echo.litteris.online",
  timeout: 10000,
};

/**
 * Verifica a conexão com a Echo API.
 */
export async function pingEchoApi(): Promise<void> {
  try {
    const response = await fetch(`${ECHO_API_CONFIG.baseUrl}/health`, {
      signal: AbortSignal.timeout(ECHO_API_CONFIG.timeout),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log("[Echo API] Conexão OK:", data);
  } catch (err) {
    console.error("[Echo API] Falha na conexão:", err);
    throw err;
  }
}
