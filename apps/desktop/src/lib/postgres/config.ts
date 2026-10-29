/**
 * Profile API configuration.
 * The Profile API is a REST microservice running on the VPS.
 * URL should be set via VITE_PROFILE_API_URL environment variable.
 * Default: https://profiles.litteris.online
 */

export const PROFILE_API_CONFIG = {
  baseUrl: import.meta.env.VITE_PROFILE_API_URL ?? "https://profiles.litteris.online",
  timeout: 10000,
};

/**
 * Verifies the Profile API connection.
 * Should be called once during app initialization.
 */
export async function pingProfileApi(): Promise<void> {
  try {
    const response = await fetch(`${PROFILE_API_CONFIG.baseUrl}/health`, {
      signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    console.log("[Profile API] Conexão OK:", data);
  } catch (err) {
    console.error("[Profile API] Falha na conexão:", err);
    throw err;
  }
}