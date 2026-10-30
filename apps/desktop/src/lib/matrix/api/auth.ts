import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type { MatrixClientLike, ClientFactory, Session } from "../types";
import { ECHO_HOMESERVER_URL } from "../sso";

const DEFAULT_START_CLIENT_OPTS = { initialSyncLimit: 20, threadSupport: true };

function defaultClientFactory(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
  return createClient(opts) as unknown as MatrixClientLike;
}

/**
 * Authentication API for MatrixService.
 * Handles SSO login, session restoration, and logout.
 */
export class AuthApi {
  private readonly baseUrl: string;
  private readonly clientFactory: ClientFactory;
  private client: MatrixClientLike | null = null;

  constructor(baseUrl: string, clientFactory: ClientFactory = defaultClientFactory) {
    this.baseUrl = baseUrl;
    this.clientFactory = clientFactory;
  }

  /** Login with an SSO loginToken (m.login.token); the returned Session is
   *  also applied immediately, so the active client is credentialled. */
  async loginWithSsoToken(loginToken: string): Promise<Session> {
    console.log("[SSO] loginWithSsoToken: creating client for", this.baseUrl);
    const client = this.createClient({ baseUrl: this.baseUrl });
    console.log("[SSO] loginWithSsoToken: calling loginRequest with m.login.token");
    const res = await client.loginRequest({ type: "m.login.token", token: loginToken });
    console.log("[SSO] loginWithSsoToken: loginRequest response:", res);
    if (!res.access_token || !res.user_id) {
      throw new Error("matrix login failed: missing access_token or user_id");
    }
    const session: Session = {
      baseUrl: this.baseUrl,
      accessToken: res.access_token,
      userId: res.user_id,
      deviceId: res.device_id ?? null,
      ...(res.refresh_token ? { refreshToken: res.refresh_token } : {}),
    };
    // loginRequest is a raw POST /login and does not store credentials on the
    // client instance; discard the anonymous client and create a credentialled one.
    this.restoreSession(session);
    return session;
  }

  /** Recreate a client from a persisted session (no request is made). */
  restoreSession(session: Session): void {
    this.client = this.createClient({
      baseUrl: session.baseUrl,
      accessToken: session.accessToken,
      userId: session.userId,
      ...(session.deviceId ? { deviceId: session.deviceId } : {}),
    });
  }

  /** SSO redirect URL, wrapping the SDK client. Used by services/sso.ts, which
   *  must not import matrix-js-sdk directly. The URL is built before any login,
   *  so a temp anonymous client is created when there is no active session. */
  getSsoLoginUrl(redirectUrl: string, idpId?: string): string {
    const client = this.client ?? this.createClient({ baseUrl: this.baseUrl });
    return idpId
      ? client.getSsoLoginUrl(redirectUrl, "sso", idpId)
      : client.getSsoLoginUrl(redirectUrl);
  }

  /** Logout: clear session and disconnect client. */
  async logout(): Promise<void> {
    if (this.client) {
      await this.client.logout?.();
      this.client = null;
    }
  }

  /** Get the current client instance (for other APIs to share). */
  getClient(): MatrixClientLike | null {
    return this.client;
  }

  /** Set the client instance (for shared client across APIs). */
  setClient(client: MatrixClientLike): void {
    this.client = client;
  }

  private createClient(opts: Parameters<typeof createClient>[0]): MatrixClientLike {
    return this.clientFactory(opts);
  }
}