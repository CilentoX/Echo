import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EchoApi } from "@/lib/api/echoApi";
import type { Session } from "./types";

/** Live homeserver of the private Eco network. Single source of truth. */
export const ECHO_HOMESERVER_URL = "https://echo.litteris.online";

/** OIDC provider id configured on Synapse for Google (`oidc_providers[].idp_id`). */
const GOOGLE_IDP_ID = "oidc-google";

type SsoLoginErrorCode = "listener" | "login";

/** Typed failure of the SSO flow. */
export class SsoLoginError extends Error {
  readonly code: SsoLoginErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: SsoLoginErrorCode, cause?: unknown) {
    super(message);
    this.name = "SsoLoginError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Full SSO login flow via Echo API:
 * 1. Rust opens a one-shot loopback HTTP listener on a random 127.0.0.1 port;
 * 2. we build the Echo API SSO redirect URL pointing back to that port;
 * 3. the system browser opens Google's consent page via Synapse OIDC;
 * 4. Synapse redirects to `http://127.0.0.1:<port>/callback?code=...&state=...`
 *    and the Rust listener captures the authorization code;
 * 5. we exchange the code for a Session via Echo API /auth/token.
 */
export async function runSsoLogin(echoApi: EchoApi): Promise<Session> {
  console.log("[SSO] Starting SSO login flow...");
  const port = await invoke<number>("begin_sso_listener");
  console.log("[SSO] Listener started on port:", port);
  const redirectUrl = `http://127.0.0.1:${port}/callback`;
  console.log("[SSO] Redirect URL:", redirectUrl);

  // Build the SSO login URL via Echo API (async call to /auth/google)
  let loginUrl = "";
  try {
    loginUrl = await echoApi.getSsoLoginUrl(redirectUrl, GOOGLE_IDP_ID);
  } catch (err) {
    console.warn("[SSO] Erro ao consultar endpoint /auth/google na Echo API, usando fallback direto:", err);
  }

  // Fallback defensivo: se a API retornar vazio, 'undefined/...' ou uma URL inválida sem esquema http(s)
  if (!loginUrl || loginUrl.includes("undefined") || (!loginUrl.startsWith("http://") && !loginUrl.startsWith("https://"))) {
    console.warn("[SSO] URL de login inválida recebida ou ausente, normalizando para homeserver oficial:", loginUrl);
    loginUrl = `${ECHO_HOMESERVER_URL}/_matrix/client/v3/login/sso/redirect/${GOOGLE_IDP_ID}?redirectUrl=${encodeURIComponent(
      redirectUrl,
    )}`;
  }

  console.log("[SSO] Login URL final:", loginUrl);
  try {
    await openUrl(loginUrl);
  } catch (err) {
    console.error("[SSO] Falha ao abrir navegador com a URL de login:", loginUrl, err);
    throw new SsoLoginError(
      `Não foi possível abrir o navegador para login: ${err instanceof Error ? err.message : String(err)}`,
      "listener",
      err,
    );
  }
  console.log("[SSO] Browser opened, waiting for callback...");

  let code: string;
  try {
    console.log("[SSO] Waiting for authorization code...");
    code = await invoke<string>("finish_sso_listener", { port });
    console.log("[SSO] Authorization code received:", code ? "yes" : "no");
  } catch (err) {
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao aguardar o retorno do login SSO",
      "listener",
      err,
    );
  }

  try {
    console.log("[SSO] Exchanging code for session...");
    const session = await echoApi.exchangeCodeForTokens(code);
    console.log("[SSO] Session received:", session);
    return session;
  } catch (err) {
    console.log("[SSO] exchangeCodeForTokens failed:", err instanceof Error ? err.message : String(err));
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao autenticar com o código SSO",
      "login",
      err,
    );
  }
}