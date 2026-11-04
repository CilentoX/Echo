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
  /** Base URL of the Echo API middleware (e.g. https://apiecho.litteris.online) */
  baseUrl: string;
  /** Access token obtained after Echo API login (stored in keyring). */
  accessToken: string;
  /** MXID of the logged-in user (e.g. "@user:domain"). */
  userId?: string;
  /** Optional API key for the Echo API middleware. */
  apiKey?: string;
}

/** Session type for refreshSession return value. */
import type { Session } from "@/lib/matrix/types";

/** Save session to keyring after refresh. */
import { saveSession } from "@/lib/storage/keyring";

/** Default config for Echo API */
import { ECHO_API_CONFIG } from "@/lib/api/config";

/**
 * Low-level request helper that adds auth headers.
 * The Echo API middleware expects:
 *   - Authorization: Bearer <accessToken>
 *   - X-API-Key: <apiKey> (if configured)
 */
function request(
  url: string,
  init: RequestInit,
  apiKey: string | undefined,
  accessToken: string,
  authToken?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = authToken || accessToken;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (apiKey) headers.set("X-API-Key", apiKey);
  
  // Serialize body if it's a plain object
  let body: BodyInit | null | undefined = init.body;
  if (body !== undefined && body !== null && typeof body === "object" && !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof ReadableStream) && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(body, (_key, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    });
  }
  
  return fetch(url, {
    ...init,
    headers,
    body,
    credentials: "omit",
  });
}

/** Save session to keyring after refresh. */
async function saveRefreshedSession(session: Session): Promise<void> {
  await saveSession(session);
}

/**
 * Top-level Echo API client.
 * Instances are created per-session with the user's access token.
 */
export class EchoApi {
  private readonly baseUrl: string;
  private accessToken: string;
  private userId: string | null = null;
  private readonly apiKey: string | undefined;
  private syncHandlers: {
    onStatus?: (status: string, error?: any) => void;
    onEvent?: (event: any) => void;
    onPresence?: (presence: any) => void;
  } | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ baseUrl, accessToken, apiKey, userId }: EchoApiInit) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.userId = userId ?? null;
    this.apiKey = apiKey;
  }

  /** Retorna o token de acesso ativo. */
  getAccessToken(): string {
    return this.accessToken;
  }

  /** Update the access token (used when session is restored). */
  setAccessToken(token: string, userId?: string): void {
    this.accessToken = token;
    if (userId) this.userId = userId;
    if (token && this.syncHandlers) {
      if (this.syncTimer) clearTimeout(this.syncTimer);
      this.syncTimer = setTimeout(() => {
        this.syncHandlers?.onStatus?.("syncing");
      }, 50);
    }
  }

  /** Recreate or restore client session. */
  restoreSession(session: Session): void {
    this.setAccessToken(session.accessToken ?? "", session.userId ?? undefined);
  }

  /** Returns the current user's MXID, or empty string if not known. */
  getUserId(): string {
    return this.userId ?? "";
  }

  /** GET request. */
  protected async get(path: string, params?: URLSearchParams): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    if (params) url.search = params.toString();
    return request(url.toString(), { method: "GET" }, this.apiKey, this.accessToken);
  }

  /** POST request. */
  public async post(path: string, body?: unknown, authToken?: string): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    return request(url.toString(), { method: "POST", body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken, authToken);
  }

  /** PUT request. */
  public async put(path: string, body?: unknown): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    return request(url.toString(), { method: "PUT", body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken);
  }

  /** PATCH request. */
  public async patch(path: string, body?: unknown): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    return request(url.toString(), { method: "PATCH", body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken);
  }

  /** DELETE request. */
  public async delete(path: string): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    return request(url.toString(), { method: "DELETE" }, this.apiKey, this.accessToken);
  }

  // ── Authentication ──────────────────────────────────────────────

  /** Exchange an SSO loginToken for a session (POST /auth/token). */
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
    return this.post("/auth/token", { code: loginToken }).then(
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
    userId?: string;
    displayName: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    const targetPath = userId ? `/api/profiles/${encodeURIComponent(userId)}` : `/api/profiles/me`;
    return this.get(targetPath).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to get user profile: ${res.status}`);
        const data = await res.json();
        return {
          userId: data.userId,
          displayName: data.displayName ?? data.nickname ?? null,
          nickname: data.nickname ?? data.displayName ?? null,
          avatarUrl: data.avatarUrl ?? null,
          bannerUrl: data.bannerUrl ?? null,
          bio: data.bio ?? null,
          role: data.role ?? null,
        };
      },
    );
  }

  /** Patch (partial update) the profile of a user (default: current user). */
  async patchUserProfile(userId: string, data: {
    displayName?: string | null;
    nickname?: string | null;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    links?: Array<{ label: string; url: string }>;
  }): Promise<void> {
    const targetPath = userId ? `/api/profiles/${encodeURIComponent(userId)}` : `/api/profiles/me`;
    const nickname = data.nickname ?? data.displayName;
    return this.patch(targetPath, {
      nickname,
      displayName: nickname,
      avatarUrl: data.avatarUrl,
      bannerUrl: data.bannerUrl,
      bio: data.bio,
      links: data.links,
      data,
    }).then(
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

  // ── Invites ─────────────────────────────────────────────────────

  /** Create an invite link for a guild. */
  async createGuildInvite(
    guildId: string,
    options?: { maxUses?: number; expiresInHours?: number },
  ): Promise<{
    code: string;
    url: string;
    maxUses: number | null;
    usesCount: number;
    expiresAt: string | null;
  }> {
    const res = await this.post(`/api/guilds/${guildId}/invites`, options || {});
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to create guild invite: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Get public preview of a guild invite code. */
  async getInvitePreview(code: string): Promise<{
    code: string;
    guildId: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    channelsCount: number;
    expiresAt: string | null;
  }> {
    const cleanCode = code.trim().replace(/^.*\/invite\//, "");
    const res = await this.get(`/api/invites/${cleanCode}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to get invite preview: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Join a guild via invite code. */
  async joinGuildViaInvite(code: string): Promise<{
    success: boolean;
    guildId: string;
    name: string;
  }> {
    const cleanCode = code.trim().replace(/^.*\/invite\//, "");
    const res = await this.post(`/api/invites/${cleanCode}/join`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to join guild: ${res.status} ${errTxt}`);
    }
    return res.json();
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
    const res = await this.post(`/api/rooms/${roomId}/messages`, { roomId, body });
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
    const res = await this.get(`/api/rooms/${roomId}/messages/older?limit=${limit}`);
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
    const res = await this.post(`/api/rooms/${roomId}/messages/${targetEventId}/reactions`, {
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
    await this.put(`/api/rooms/${roomId}/typing`, { roomId, isTyping }).then(
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
    await this.put(`/api/rooms/${roomId}/power-levels`, {
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
    const res = await this.get(`/api/rooms/${roomId}/members`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to get members: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Invite a user to a room. */
  async inviteUser(roomId: string, userId: string): Promise<string> {
    const res = await this.post(`/api/rooms/${roomId}/invite`, { roomId, userId });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to invite user: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  /** Kick a user from a room. */
  async kickUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const res = await this.post(`/api/rooms/${roomId}/kick`, { roomId, userId, reason });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to kick user: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || "";
  }

  /** Ban a user from a room. */
  async banUser(roomId: string, userId: string, reason?: string): Promise<string> {
    const res = await this.post(`/api/rooms/${roomId}/ban`, { roomId, userId, reason });
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
    const res = await fetch(`${this.baseUrl}/api/upload/`, {
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
    const rawUrl = data.mxcUri || data.contentUri || data.url || "";
    if (rawUrl && rawUrl.startsWith("/")) {
      return `${this.baseUrl}${rawUrl}`;
    }
    return rawUrl;
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

  /**
   * Get the SSO login URL from Echo API.
   * Calls GET /auth/google with redirectUrl and idpId to get the Synapse OIDC redirect URL.
   */
  async getSsoLoginUrl(redirectUrl: string, idpId: string = "oidc-google"): Promise<string> {
    const params = new URLSearchParams({
      redirectUrl,
      idpId,
    });
    const res = await this.get(`/auth/google?${params.toString()}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to get SSO login URL: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.loginUrl;
  }

  /**
   * Exchange an authorization code for tokens (POST /auth/token).
   * Returns a Session object with accessToken, refreshToken, deviceId, userId.
   */
  async exchangeCodeForTokens(code: string): Promise<Session> {
    const res = await this.post("/auth/token", { code });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Exchange code for tokens failed: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    // Echo API returns { accessToken, refreshToken, deviceId, userId }
    // We need to convert to our Session type
    this.userId = data.userId ?? null;
    return {
      baseUrl: this.baseUrl,
      apiBaseUrl: this.baseUrl,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      deviceId: data.deviceId,
      userId: data.userId,
      expiresAt: Date.now() + 3600 * 1000, // 1 hour default
    };
  }

  // ── Profile convenience methods (for backward compatibility) ────────

  /** Get display name of a user (or current user). */
  async getDisplayName(userId?: string): Promise<string | null> {
    const profile = await this.getUserProfile(userId);
    return profile.displayName;
  }

  /** Set display name of current user. */
  async setDisplayName(displayName: string): Promise<void> {
    await this.patchUserProfile("", { displayName });
  }

  /** Get avatar URL of a user (or current user). */
  async getAvatarUrl(userId?: string): Promise<string | null> {
    const profile = await this.getUserProfile(userId);
    return profile.avatarUrl;
  }

  /** Set avatar URL of current user. */
  async setAvatarUrl(avatarUrl: string | null): Promise<void> {
    await this.patchUserProfile("", { avatarUrl });
  }

  /** Get banner URL of a user (or current user). */
  async getBannerUrl(userId?: string): Promise<string | null> {
    const profile = await this.getUserProfile(userId);
    return profile.bannerUrl;
  }

  /** Set banner URL of current user. */
  async setBannerUrl(bannerUrl: string | null): Promise<void> {
    await this.patchUserProfile("", { bannerUrl });
  }

  /** Patch global profile (alias for patchUserProfile with current user). */
  async patchGlobalProfile(
    userIdOrData:
      | string
      | {
          displayName?: string | null;
          avatarUrl?: string | null;
          bannerUrl?: string | null;
          bio?: string | null;
          links?: Array<{ label: string; url: string }>;
        },
    maybeData?: {
      displayName?: string | null;
      avatarUrl?: string | null;
      bannerUrl?: string | null;
      bio?: string | null;
      links?: Array<{ label: string; url: string }>;
    },
  ): Promise<void> {
    const userId = typeof userIdOrData === "string" ? userIdOrData : "";
    const data = typeof userIdOrData === "object" ? userIdOrData : (maybeData ?? {});
    await this.patchUserProfile(userId, data);
  }

  /** Delete current user's profile and reset account on server. */
  async deleteMyProfile(): Promise<void> {
    const res = await this.delete("/api/profiles/me");
    if (!res.ok) {
      console.warn("[EchoApi] Falha ao deletar perfil:", res.status);
    }
  }

  /** Get global profile (alias for getUserProfile with current user). */
  async getGlobalProfile(): Promise<{
    displayName: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    return this.getUserProfile("");
  }

  /** Mark a room as read up to the given event. */
  async markAsRead(roomId: string, eventId: string): Promise<void> {
    await this.put(`/api/rooms/${roomId}/receipt`, { roomId, eventId }).then(
      async (res) => {
        if (!res.ok) {
          const errTxt = await res.text();
          throw new Error(`Failed to mark as read: ${res.status} ${errTxt}`);
        }
      },
    );
  }

  // ── Guild Profile methods ──────────────────────────────────────────

  /** Get guild profile. */
  async getGuildProfile(guildId: string): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl: string | null;
    description: string | null;
  }> {
    const res = await this.get(`/api/guilds/${guildId}/profile`);
    if (!res.ok) throw new Error(`Failed to get guild profile: ${res.status}`);
    return res.json();
  }

  /** Upsert guild profile. */
  async upsertGuildProfile(guildId: string, data: {
    name?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
  }): Promise<void> {
    const res = await this.patch(`/api/guilds/${guildId}/profile`, data);
    if (!res.ok) throw new Error(`Failed to upsert guild profile: ${res.status}`);
  }

  /** Delete a guild. */
  async deleteGuild(guildId: string): Promise<void> {
    const res = await this.delete(`/guilds/${guildId}`);
    if (!res.ok) throw new Error(`Failed to delete guild: ${res.status}`);
  }

  /** Leave a guild. */
  async leaveGuild(guildId: string): Promise<void> {
    const res = await this.post(`/guilds/${guildId}/leave`);
    if (!res.ok) throw new Error(`Failed to leave guild: ${res.status}`);
  }

  /** Edit a guild (alias for upsertGuildProfile). */
  async editGuild(guildId: string, data: {
    name?: string;
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
  }): Promise<void> {
    await this.upsertGuildProfile(guildId, data);
  }

  // ── Media upload alias ─────────────────────────────────────────────

  /** Upload media (alias for uploadChatMedia). */
  async uploadMedia(file: File): Promise<string> {
    return this.uploadChatMedia(file);
  }

  // ── Sync compatibility methods ─────────────────────────────────────

  /** Start sync handlers. Transiciona para "syncing" se a sessão já estiver autenticada. */
  startSyncHandlers(handlers: {
    onStatus?: (status: string, error?: any) => void;
    onEvent?: (event: any) => void;
    onPresence?: (presence: any) => void;
  }): void {
    this.syncHandlers = handlers;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.accessToken) {
      this.syncTimer = setTimeout(() => {
        this.syncHandlers?.onStatus?.("syncing");
      }, 50);
    }
  }

  /** Stop sync. Limpa os timers e handlers de sincronização. */
  stopSync(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    this.syncHandlers = null;
  }

  // ── Compatibility aliases for old method names ─────────────────────

  /** Get guilds (alias for getGuilds). */
  async listGuilds() {
    return this.getGuilds();
  }

  /** Get channels (alias for getChannels). */
  async listChannels(guildId: string) {
    return this.getChannels(guildId);
  }

  /** Get members (alias for getMembers). */
  async listMembers(roomId: string) {
    return this.getMembers(roomId);
  }
}

/** Singleton instance for use throughout the app. */
let echoApiInstance: EchoApi | null = null;

/** Get or create the singleton EchoApi instance.
 * Lazily initializes from the shared instance in matrix/instance.ts if
 * not yet created, so any component can call useEchoApi() without
 * needing to call useEchoApi.init() first. */
export function useEchoApi(): EchoApi {
  if (!echoApiInstance) {
    // Read from globalThis where instance.ts registers the shared echoApi.
    // This avoids a circular import cycle (instance.ts imports echoApi from
    // this module) while keeping access synchronous at runtime.
    echoApiInstance = (globalThis as any).__echoApiInstance ?? null;
    if (!echoApiInstance) {
      echoApiInstance = new EchoApi({
        baseUrl: ECHO_API_CONFIG.baseUrl,
        accessToken: "",
      });
      (globalThis as any).__echoApiInstance = echoApiInstance;
    }
  }
  return echoApiInstance;
}

/** Initialize the singleton EchoApi instance. */
useEchoApi.init = function (init: EchoApiInit): EchoApi {
  echoApiInstance = new EchoApi(init);
  return echoApiInstance;
}
