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
 * 3. the system browser opens Google's consent page;
 * 4. Echo API redirects to `http://127.0.0.1:<port>/callback?loginToken=...`
 *    and the Rust listener captures the token;
 * 5. we exchange the loginToken for a Session via Echo API.
 */
export async function runSsoLogin(echoApi: EchoApi): Promise<Session> {
  console.log("[SSO] Starting SSO login flow...");
  const port = await invoke<number>("begin_sso_listener");
  console.log("[SSO] Listener started on port:", port);
  const redirectUrl = `http://127.0.0.1:${port}/callback`;
  console.log("[SSO] Redirect URL:", redirectUrl);

  // Build the SSO login URL via Echo API
  const loginUrl = echoApi.getSsoLoginUrl(redirectUrl, GOOGLE_IDP_ID);
  console.log("[SSO] Login URL:", loginUrl);
  await openUrl(loginUrl);
  console.log("[SSO] Browser opened, waiting for callback...");

  let loginToken: string;
  try {
    console.log("[SSO] Waiting for login token...");
    loginToken = await invoke<string>("finish_sso_listener", { port });
    console.log("[SSO] Login token received:", loginToken ? "yes" : "no");
  } catch (err) {
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao aguardar o retorno do login SSO",
      "listener",
      err,
    );
  }

  try {
    console.log("[SSO] Exchanging token for session...");
    const session = await echoApi.exchangeLoginToken(loginToken);
    console.log("[SSO] Session received:", session);
    return session;
  } catch (err) {
    console.log("[SSO] exchangeLoginToken failed:", err instanceof Error ? err.message : String(err));
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao autenticar com o token SSO",
      "login",
      err,
    );
  }
}