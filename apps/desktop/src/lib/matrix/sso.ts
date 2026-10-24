import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { MatrixService } from "./service";
import type { Session } from "./types";

/**
 * Live homeserver of the private Eco network.
 * Single source of truth — build services with this unless tests inject another.
 */
export const ECHO_HOMESERVER_URL = "https://echo.litteris.online";

/** OIDC provider id configured on Synapse for Google (`oidc_providers[].idp_id`). */
const GOOGLE_IDP_ID = "google";

type SsoLoginErrorCode = "listener" | "login";

/**
 * Typed failure of the SSO flow, so the UI can react without parsing strings.
 * `listener`: the Rust loopback failed (timeout, cancelled or unknown port).
 * `login`: the homeserver rejected the loginToken exchange.
 */
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
 * Full SSO login flow:
 * 1. Rust opens a one-shot loopback HTTP listener on a random 127.0.0.1 port;
 * 2. we build the Synapse SSO redirect URL pointing back to that port;
 * 3. the system browser opens Google's consent page;
 * 4. Synapse redirects to `http://127.0.0.1:<port>/callback?loginToken=...`
 *    and the Rust listener captures the token;
 * 5. we exchange the loginToken for a Session via MatrixService.
 */
export async function runSsoLogin(service: MatrixService): Promise<Session> {
  const port = await invoke<number>("begin_sso_listener");
  const redirectUrl = `http://localhost:${port}/callback`;
  const loginUrl = service.getSsoLoginUrl(redirectUrl, GOOGLE_IDP_ID);
  await openUrl(loginUrl);

  let loginToken: string;
  try {
    loginToken = await invoke<string>("finish_sso_listener", { port });
  } catch (err) {
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao aguardar o retorno do login SSO",
      "listener",
      err,
    );
  }

  try {
    return await service.loginWithSsoToken(loginToken);
  } catch (err) {
    throw new SsoLoginError(
      err instanceof Error ? err.message : "Falha ao autenticar com o token SSO",
      "login",
      err,
    );
  }
}
