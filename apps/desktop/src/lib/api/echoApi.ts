/**
 * Echo API Client — replaces matrix-js-sdk with typed HTTP calls to the
 * Echo API middleware (which proxies to Matrix homeserver).
 *
 * Authentication: Authorization: Bearer <accessToken> + X-API-Key header.
 * All endpoints are relative to the Echo API base URL.
 *
 * This client is designed to be a singleton, created once with the
 * user's access token and used throughout the app.
 */
export interface EchoApiInit {
  /** Base URL of the Echo API middleware (e.g. https://echo.litteris.online) */
  baseUrl: string;
  /** Access token obtained after Echo API login (stored in keyring). */
  accessToken: string;
  /** Optional API key for the Echo API middleware. */
  apiKey?: string;
}

/** Session type for refreshSession return value. */
import type { Session } from "@/lib/matrix/types";

/** Save session to keyring after refresh. */
import { saveSession } from "@/lib/storage/keyring";

/**
 * Low-level request helper that adds auth headers.
 * The Echo API middleware expects:
 *   - Authorization: Bearer <accessToken>
 *   - X-API-Key: <apiKey> (if configured)
 */
function request(
  init: RequestInit,
  apiKey: string | undefined,
  accessToken: string,
  authToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = authToken || accessToken;
  headers.set("Authorization", `Bearer ${token}`);
  if (apiKey) headers.set("X-API-Key", apiKey);
  return fetch(`${apiBase}/echo${init.path}`, {
    ...init,
    headers,
    // Body is expected to be already-serialized JSON or a string.
    // If it's a plain object, we serialize it here.
    body:
      "BodyInit" in globalThis
        ? init.body instanceof BodyInit
          ? init.body
          : JSON.stringify(init.body ?? {}, (key, value) => {
              if (typeof value === "bigint") {
                return value.toString();
              }
              return value;
            })
        : JSON.stringify(init.body ?? {}, (key, value) => {
            if (typeof value === "bigint") {
              return value.toString();
            }
            return value;
          }),
    // Disable cors auto-send of credentials; we manage auth via headers.
    credentials: "omit",
  });
}

/** Save session to keyring after refresh. */
async function saveRefreshedSession(session: Session): Promise<void> {
  await saveSession(session);
}

/** Build the base Echo API URL from init. */
const apiBase = (
  init: EchoApiInit,
) => `https://${init.baseUrl}`;

/**
 * Top-level Echo API client.
 * Instances are created per-session with the user's access token.
 */
export class EchoApi {
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly apiKey: string | undefined;
  private readonly request: typeof request;

  constructor({ baseUrl, accessToken, apiKey }: EchoApiInit) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.apiKey = apiKey;
    this.request = (init) => request(init, apiKey, accessToken);
  }

  /** GET request. */
  protected async get(path: string, params?: URLSearchParams): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (params) url.search = params.toString();
    return this.request({
      method: "GET",
      path: url.pathname + url.search,
    });
  }

  /** POST request. */
  protected async post(path: string, body?: unknown, authToken?: string): Promise<Response> {
    return this.request({
      method: "POST",
      path,
      body,
    }, this.apiKey, this.accessToken, authToken);
  }

  /** PUT request. */
  protected async put(path: string, body?: unknown): Promise<Response> {
    return this.request({
      method: "PUT",
      path,
      body,
    });
  }

  /** DELETE request. */
  protected async delete(path: string): Promise<Response> {
    return this.request({
      method: "DELETE",
      path,
    });
  }

  // ── Authentication ──────────────────────────────────────────────

  /** Exchange an SSO loginToken for a session (POST /auth/google callback). */
  async exchangeLoginToken(loginToken: string): Promise<{
    session: {
      baseUrl: string;
      accessToken: string;
      userId: string;
      deviceId: string | null;
      refreshToken?: string;
    };
    user: {
      id: string;
      displayName?: string;
      avatarUrl?: string;
    };
  }> {
    return this.post("/auth/exchange-login-token", { loginToken }).then(
      async (res) => {
        if (!res.ok) {
          const errTxt = await res.text();
          throw new Error(`Exchange login token failed: ${res.status} ${errTxt}`);
        }
        return res.json();
      },
    );
  }

  /** Refresh an expired access token using a refresh token (POST /auth/refresh). */
  async refreshSession(refreshToken: string): Promise<Session> {
    if (!refreshToken?.trim()) {
      throw new Error("Refresh token is required");
    }
    const res = await this.post("/auth/refresh", { refreshToken }, refreshToken);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Refresh session failed: ${res.status} ${errTxt}`);
    }
    const { baseUrl, accessToken, refreshToken: newRefreshToken, deviceId, expiresAt } =
      await res.json();
    const newSession: Session = {
      baseUrl,
      apiBaseUrl: baseUrl,
      accessToken,
      refreshToken: newRefreshToken ?? refreshToken,
      deviceId: deviceId ?? null,
      expiresAt,
    };
    await saveRefreshedSession(newSession);
    return newSession;
  }

  // ── User Profile ────────────────────────────────────────────────

  /** Get the profile of a user (default: current user). */
  async getUserProfile(userId?: string): Promise<{
    displayName: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    const targetId = userId ?? "";
    return this.post("/profile/get", { userId: targetId }).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to get user profile: ${res.status}`);
        return res.json();
      },
    );
  }

  /** Patch (partial update) the profile of a user (default: current user). */
  async patchUserProfile(userId: string, data: {
    displayName?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    links?: Array<{ label: string; url: string }>;
  }): Promise<void> {
    return this.post("/profile/patch", { userId, data }).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to patch user profile: ${res.status}`);
      },
    );
  }

  // ── Guilds ──────────────────────────────────────────────────────

  /** Get all guilds (Spaces) the user is a member of. */
  async getGuilds(): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    unreadCount: number;
  }[]> {
    return this.get("/guilds").then(async (res) => {
      if (!res.ok) throw new Error(`Failed to get guilds: ${res.status}`);
      return res.json();
    });
  }

  /** Create a new guild (Space m.space). */
  async createGuild(
    data: {
      name: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    },
    createdBy: string,
  ): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    unreadCount: number;
  }> {
    return this.post("/guilds", { ...data, createdBy }).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to create guild: ${res.status}`);
        return res.json();
      },
    );
  }

  // ── Channels ────────────────────────────────────────────────────

  /** Get all channels (children) of a guild. */
  async getChannels(guildId: string): Promise<{
    channelId: string;
    name: string;
    topic?: string;
    type?: string;
    category?: string;
    unreadCount: number;
  }[]> {
    return this.get(`/channels?guildId=${guildId}`).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to get channels: ${res.status}`);
        return res.json();
      },
    );
  }

  /** Create a new channel inside a guild. */
  async createChannel(
    guildId: string,
    data: {
      name: string;
      type: string;
      topic?: string;
      category?: string;
    },
  ): Promise<{
    channelId: string;
    name: string;
    topic?: string;
    type?: string;
    category?: string;
    unreadCount: number;
  }> {
    return this.post(`/channels?guildId=${guildId}`, data).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to create channel: ${res.status}`);
        return res.json();
      },
    );
  }

  // ── Messages ────────────────────────────────────────────────────

  /** Send an m.text message. */
  async sendMessage(roomId: string, body: string): Promise<string> {
    const res = await this.post("/messages/send", { roomId, body });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to send message: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || data.id || "";
  }

  /** Load older history for a channel. */
  async loadOlder(roomId: string, limit = 20): Promise<{
    eventId: string;
    roomId: string;
    sender: string;
    body: string;
    originServerTs: number;
    replyTo?: { eventId: string; sender: string; body: string };
    editedAt?: number;
    redacted?: boolean;
    senderAvatarUrl?: string | null;
  }[]> {
    const res = await this.get(`/messages/older?roomId=${roomId}&limit=${limit}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to load older: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Send an m.reaction. */
  async sendReaction(
    roomId: string,
    targetEventId: string,
    emoji: string,
  ): Promise<string> {
    const res = await this.post("/messages/reaction", {
      roomId,
      targetEventId,
      emoji,
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to send reaction: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  // ── Typing ──────────────────────────────────────────────────────

  /** Set typing status in a room. */
  async setTyping(roomId: string, isTyping: boolean): Promise<void> {
    await this.post("/messages/typing", { roomId, isTyping }).then(
      async (res) => {
        if (!res.ok) {
          const errTxt = await res.text();
          throw new Error(`Failed to set typing: ${res.status} ${errTxt}`);
        }
      },
    );
  }

  // ── Power Level ─────────────────────────────────────────────────

  /** Set the power level of a user in a room. */
  async setPowerLevel(roomId: string, userId: string, level: number): Promise<void> {
    await this.post("/members/set-power-level", {
      roomId,
      userId,
      level,
    }).then(
      async (res) => {
        if (!res.ok) {
          const errTxt = await res.text();
          throw new Error(`Failed to set power level: ${res.status} ${errTxt}`);
        }
      },
    );
  }

  // ── Members ─────────────────────────────────────────────────────

  /** Get joined members of a room. */
  async getMembers(roomId: string): Promise<{
    userId: string;
    displayName: string;
    presence: "online" | "offline" | "unavailable";
    avatarUrl?: string | null;
  }[]> {
    const res = await this.get(`/members?roomId=${roomId}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to get members: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Invite a user to a room. */
  async inviteUser(roomId: string, userId: string): Promise<string> {
    const res = await this.post("/members/invite", { roomId, userId });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to invite user: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  /** Kick a user from a room. */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const res = await this.post("/members/kick", { roomId, userId, reason });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to kick user: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  /** Ban a user from a room. */
  async banUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const res = await this.post("/members/ban", { roomId, userId, reason });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to ban user: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  // ── Avatar/Media ────────────────────────────────────────────────

  /** Upload chat media (file). */
  async uploadChatMedia(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "chat");
    const res = await fetch(`${this.baseUrl}/echo/media/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
      },
      body: formData,
      credentials: "omit",
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to upload media: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.mxcUri || data.contentUri || data.url || "";
  }

  /** Get the profile URL for a user (avatar/banner). */
  async getUserProfileUrl(userId?: string): Promise<string | null> {
    const targetId = userId ?? "";
    const res = await this.get(`/profile/url?userId=${targetId}`);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data.url || null;
  }
}

/** Singleton instance for use throughout the app. */
let echoApiInstance: EchoApi | null = null;

/** Get or create the singleton EchoApi instance. */
export function useEchoApi(): EchoApi {
  if (!echoApiInstance) {
    throw new Error("EchoApi not initialized. Call useEchoApi.init() first.");
  }
  return echoApiInstance;
}

/** Initialize the singleton EchoApi instance. */
useEchoApi.init = function (init: EchoApiInit): EchoApi {
  echoApiInstance = new EchoApi(init);
  return echoApiInstance;
}