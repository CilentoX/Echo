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

export interface FriendProfile {
  userId: string;
  username?: string | null;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  presence?: "online" | "offline" | "unavailable";
}

export interface FriendItem {
  friendshipId: string;
  userId: string;
  username?: string | null;
  nickname: string | null;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  status: "accepted";
  directRoomId: string | null;
  presence?: "online" | "offline" | "unavailable";
  createdAt?: string;
  updatedAt?: string;
}

export interface FriendRequestItem {
  friendshipId: string;
  user: FriendProfile;
  createdAt: string;
}

export interface FriendsResponse {
  friends: FriendItem[];
  pendingIncoming: FriendRequestItem[];
  pendingOutgoing: FriendRequestItem[];
  blocked: FriendRequestItem[];
}

export interface DiscoveredUserItem {
  userId: string;
  username?: string | null;
  displayName: string;
  nickname: string | null;
  avatarUrl: string | null;
  bio: string | null;
  status: "friend" | "pending_incoming" | "pending_outgoing" | "none";
  friendshipId: string | null;
  directRoomId: string | null;
  joinedAt: string;
}

export interface DiscoveryResponse {
  users: DiscoveredUserItem[];
}

export interface GuildRole {
  id: string;
  guildId: string;
  name: string;
  color: string | null;
  position: number;
  isHoisted: boolean;
  permissions: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface GuildMemberRole {
  id: string;
  guildId: string;
  userId: string;
  roleId: string;
  createdAt?: string;
}

export interface GuildMemberProfile {
  id: string;
  guildId: string;
  userId: string;
  nickname: string | null;
  avatarUrl: string | null;
}

export interface GuildMembersData {
  roles: GuildRole[];
  memberRoles: GuildMemberRole[];
  memberProfiles: GuildMemberProfile[];
}

export interface GuildInviteUsageItem {
  id: string;
  userId: string;
  usedAt: string;
  user?: {
    userId: string;
    name: string;
    nickname: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
}

export interface GuildInviteItem {
  id: string;
  code: string;
  guildId: string;
  creatorId: string;
  creator?: {
    userId: string;
    name: string;
    nickname: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  createdAt: string;
  url: string;
  usages?: GuildInviteUsageItem[];
}

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

/** Normaliza qualquer formato de código ou URL de convite para o código puro. */
export function normalizeInviteCode(code: string): string {
  let cleaned = code.trim();
  cleaned = cleaned.replace(/^echo:\/\/invites?\//i, "");
  cleaned = cleaned.replace(/^https?:\/\/[^\/]+\/invites?\//i, "");
  cleaned = cleaned.replace(/^.*\/invites?\//i, "");
  return cleaned.split("?")[0].split("#")[0].replace(/\/$/, "");
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
  private refreshTokenValue: string | null = null;
  private expiresAtMs: number | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private isRefreshing: boolean = false;
  private syncHandlers: {
    onStatus?: (status: string, error?: any) => void;
    onEvent?: (event: any) => void;
    onTyping?: (roomId: string, userIds: string[]) => void;
    onPresence?: (userId: string, presence: any) => void;
    onMembers?: (roomId: string, members: any[]) => void;
    onReaction?: (reaction: any) => void;
    onReadReceipt?: (roomId: string, userId: string, eventId: string) => void;
    [key: string]: any;
  } | null = null;
  private syncTimer: ReturnType<typeof setTimeout> | null = null;

  constructor({ baseUrl, accessToken, apiKey, userId }: EchoApiInit) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
    this.userId = userId ?? null;
    this.apiKey = apiKey;
  }

  /** Retorna a base URL da API. */
  getBaseUrl(): string {
    return this.baseUrl;
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
    // Configura dados de refresh para renovação automática proativa
    if (session.refreshToken) {
      this.refreshTokenValue = session.refreshToken;
    }
    if (session.expiresAt) {
      this.expiresAtMs = session.expiresAt;
      this.scheduleProactiveRefresh();
    }
  }

  /**
   * Agenda um refresh preventivo do token antes da expiração.
   * Renova 60 segundos antes do expiry ou em 80% do tempo de vida restante.
   */
  private scheduleProactiveRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (!this.refreshTokenValue || !this.expiresAtMs) return;

    const now = Date.now();
    const remaining = this.expiresAtMs - now;
    if (remaining <= 0) {
      // Já expirou — tenta refresh imediato no próximo request via interceptor
      return;
    }

    // Renova 60s antes ou em 80% do tempo restante, o que for menor
    const refreshIn = Math.min(remaining - 60_000, remaining * 0.2);
    const delay = Math.max(refreshIn, 5_000); // mínimo 5s para evitar loop

    console.log(`[EchoApi] Refresh proativo agendado em ${Math.round(delay / 1000)}s`);
    this.refreshTimer = setTimeout(() => {
      void this.performAutoRefresh();
    }, delay);
  }

  /**
   * Executa o refresh automático do token e persiste a nova sessão.
   */
  private async performAutoRefresh(): Promise<boolean> {
    if (this.isRefreshing || !this.refreshTokenValue) return false;
    this.isRefreshing = true;

    try {
      console.log("[EchoApi] Iniciando refresh automático do token...");
      const refreshed = await this.refreshSession(this.refreshTokenValue);
      this.accessToken = refreshed.accessToken;
      this.refreshTokenValue = refreshed.refreshToken ?? this.refreshTokenValue;
      this.expiresAtMs = refreshed.expiresAt;
      if (refreshed.userId) this.userId = refreshed.userId;

      // Persiste a sessão renovada no keyring
      await saveSession(refreshed).catch((err) => {
        console.warn("[EchoApi] Falha ao persistir sessão renovada:", err);
      });

      console.log("[EchoApi] Token renovado com sucesso.");
      this.scheduleProactiveRefresh();
      return true;
    } catch (err) {
      console.error("[EchoApi] Refresh automático falhou:", err);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Interceptor: quando uma requisição retorna 401, tenta refresh e refaz a chamada.
   */
  protected async requestWithAutoRetry(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const url = new URL(path, this.baseUrl);
    let res = await request(url.toString(), { method, body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken);

    if (res.status === 401 && this.refreshTokenValue && !this.isRefreshing) {
      console.warn(`[EchoApi] 401 em ${method} ${path} — tentando refresh...`);
      const ok = await this.performAutoRefresh();
      if (ok) {
        res = await request(url.toString(), { method, body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken);
      }
    }

    return res;
  }

  /** Returns the current user's MXID, or empty string if not known. */
  getUserId(): string {
    return this.userId ?? "";
  }

  /** GET request with auto-retry on 401. */
  protected async get(path: string, params?: URLSearchParams): Promise<Response> {
    let fullPath = path;
    if (params) fullPath += `?${params.toString()}`;
    return this.requestWithAutoRetry("GET", fullPath);
  }

  /** POST request with auto-retry on 401. */
  public async post(path: string, body?: unknown, authToken?: string): Promise<Response> {
    // Se um authToken explícito foi passado (ex: refresh), usa request direto sem retry
    if (authToken) {
      const url = new URL(path, this.baseUrl);
      return request(url.toString(), { method: "POST", body: body as BodyInit | null | undefined }, this.apiKey, this.accessToken, authToken);
    }
    return this.requestWithAutoRetry("POST", path, body);
  }

  /** PUT request with auto-retry on 401. */
  public async put(path: string, body?: unknown): Promise<Response> {
    return this.requestWithAutoRetry("PUT", path, body);
  }

  /** PATCH request with auto-retry on 401. */
  public async patch(path: string, body?: unknown): Promise<Response> {
    return this.requestWithAutoRetry("PATCH", path, body);
  }

  /** DELETE request with auto-retry on 401. */
  public async delete(path: string): Promise<Response> {
    return this.requestWithAutoRetry("DELETE", path);
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
    username?: string | null;
    displayName: string | null;
    nickname: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    bio: string | null;
    role: string | null;
  }> {
    if (!userId && !this.accessToken) {
      return {
        userId: this.userId ?? undefined,
        username: null,
        displayName: null,
        nickname: null,
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        role: null,
      };
    }
    const targetPath = userId ? `/api/profiles/${encodeURIComponent(userId)}` : `/api/profiles/me`;
    return this.get(targetPath).then(
      async (res) => {
        if (!res.ok) throw new Error(`Failed to get user profile: ${res.status}`);
        const data = await res.json();
        return {
          userId: data.userId,
          username: data.username ?? (data.userId ? data.userId.replace(/^@/, '').split(':')[0] : null),
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
    username?: string | null;
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
      username: data.username,
      nickname,
      displayName: nickname,
      avatarUrl: data.avatarUrl,
      bannerUrl: data.bannerUrl,
      bio: data.bio,
      links: data.links,
      data,
    }).then(
      async (res) => {
        if (!res.ok) {
          const errTxt = await res.text();
          let msg = `Failed to patch user profile: ${res.status}`;
          try {
            const json = JSON.parse(errTxt);
            if (json.error) msg = json.error;
          } catch {}
          throw new Error(msg);
        }
      },
    );
  }

  /** Check if a username is available. */
  async checkUsername(username: string): Promise<{ available: boolean; username?: string; error?: string }> {
    const res = await this.get(`/api/profiles/check-username?username=${encodeURIComponent(username)}`);
    if (!res.ok) {
      return { available: false, error: "Falha ao verificar disponibilidade do username" };
    }
    return res.json();
  }

  // ── Guilds ──────────────────────────────────────────────────────

  /** Get all guilds (Spaces) the user is a member of. */
  async getGuilds(): Promise<{
    guildId: string;
    name: string;
    avatarUrl: string | null;
    bannerUrl?: string | null;
    description?: string | null;
    unreadCount: number;
    createdBy?: string | null;
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
    const cleanCode = normalizeInviteCode(code);
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
    const cleanCode = normalizeInviteCode(code);
    const res = await this.post(`/api/invites/${cleanCode}/join`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to join guild: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** List all invites for a guild. */
  async listGuildInvites(guildId: string): Promise<GuildInviteItem[]> {
    const res = await this.get(`/api/guilds/${guildId}/invites`);
    if (!res.ok) throw new Error(`Failed to list guild invites: ${res.status}`);
    return res.json();
  }

  /** Delete / revoke a guild invite. */
  async deleteGuildInvite(guildId: string, inviteId: string): Promise<void> {
    const res = await this.delete(`/api/guilds/${guildId}/invites/${inviteId}`);
    if (!res.ok) throw new Error(`Failed to delete guild invite: ${res.status}`);
  }

  /** Get all roles defined in a guild. */
  async getGuildRoles(guildId: string): Promise<GuildRole[]> {
    const res = await this.get(`/api/guilds/${guildId}/roles`);
    if (!res.ok) throw new Error(`Failed to get guild roles: ${res.status}`);
    return res.json();
  }

  /** Create a new role in a guild. */
  async createGuildRole(
    guildId: string,
    data: {
      name: string;
      color?: string | null;
      position?: number;
      isHoisted?: boolean;
      permissions?: string[];
    },
  ): Promise<GuildRole> {
    const res = await this.post(`/api/guilds/${guildId}/roles`, data);
    if (!res.ok) throw new Error(`Failed to create guild role: ${res.status}`);
    return res.json();
  }

  /** Update a role in a guild. */
  async updateGuildRole(
    guildId: string,
    roleId: string,
    data: Partial<{
      name: string;
      color: string | null;
      position: number;
      isHoisted: boolean;
      permissions: string[];
    }>,
  ): Promise<GuildRole> {
    const res = await this.patch(`/api/guilds/${guildId}/roles/${roleId}`, data);
    if (!res.ok) throw new Error(`Failed to update guild role: ${res.status}`);
    return res.json();
  }

  /** Delete a role from a guild. */
  async deleteGuildRole(guildId: string, roleId: string): Promise<void> {
    const res = await this.delete(`/api/guilds/${guildId}/roles/${roleId}`);
    if (!res.ok) throw new Error(`Failed to delete guild role: ${res.status}`);
  }

  /** Get members data for a guild (custom nicknames and role assignments). */
  async getGuildMembersData(guildId: string): Promise<GuildMembersData> {
    const res = await this.get(`/api/guilds/${guildId}/members-data`);
    if (!res.ok) throw new Error(`Failed to get guild members data: ${res.status}`);
    return res.json();
  }

  /** Set the current user's nickname inside a guild. */
  async setGuildMemberNickname(guildId: string, nickname: string | null): Promise<GuildMemberProfile> {
    const res = await this.put(`/api/guilds/${guildId}/members/me/nickname`, { nickname });
    if (!res.ok) throw new Error(`Failed to set server nickname: ${res.status}`);
    return res.json();
  }

  /** Assign a role to a member in a guild. */
  async assignGuildMemberRole(guildId: string, targetUserId: string, roleId: string): Promise<void> {
    const res = await this.post(`/api/guilds/${guildId}/members/${encodeURIComponent(targetUserId)}/roles/${roleId}`);
    if (!res.ok) throw new Error(`Failed to assign role: ${res.status}`);
  }

  /** Remove a role from a member in a guild. */
  async removeGuildMemberRole(guildId: string, targetUserId: string, roleId: string): Promise<void> {
    const res = await this.delete(`/api/guilds/${guildId}/members/${encodeURIComponent(targetUserId)}/roles/${roleId}`);
    if (!res.ok) throw new Error(`Failed to remove role: ${res.status}`);
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

  /** Update channel metadata (name, topic, category). */
  async editChannel(
    channelId: string,
    data: {
      name?: string;
      topic?: string | null;
      category?: string | null;
      type?: string;
    },
  ): Promise<{
    channelId: string;
    name: string;
    topic?: string;
    type?: string;
    category?: string;
    unreadCount: number;
  }> {
    const encoded = encodeURIComponent(channelId);
    return this.patch(`/api/channels/${encoded}`, data).then(
      async (res) => {
        if (!res.ok) {
          const fallbackRes = await this.post("/channels/edit", { channelId, data });
          if (!fallbackRes.ok) throw new Error(`Failed to edit channel: ${res.status}`);
          return fallbackRes.json();
        }
        return res.json();
      },
    );
  }

  /** Delete a channel from its guild. */
  async deleteChannel(channelId: string): Promise<{ success: boolean; channelId?: string }> {
    const encoded = encodeURIComponent(channelId);
    return this.delete(`/api/channels/${encoded}`).then(
      async (res) => {
        if (!res.ok) {
          const fallbackRes = await this.post("/channels/delete", { channelId });
          if (!fallbackRes.ok) throw new Error(`Failed to delete channel: ${res.status}`);
          return fallbackRes.json();
        }
        return res.json();
      },
    );
  }

  // ── Messages ────────────────────────────────────────────────────

  /** Send an m.text or multimedia message. */
  async sendMessage(
    roomId: string,
    body: string,
    options?: { msgtype?: string; mediaId?: string },
  ): Promise<string> {
    const encodedId = encodeURIComponent(roomId);
    const res = await this.post(`/api/rooms/${encodedId}/messages`, {
      roomId,
      body,
      ...(options?.msgtype ? { msgtype: options.msgtype } : {}),
      ...(options?.mediaId ? { mediaId: options.mediaId } : {}),
    });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Failed to send message: ${res.status} ${errTxt}`);
    }
    const data = await res.json();
    return data.eventId || data.event_id || data.id || "";
  }

  /** Sends an m.file, m.image, or m.audio message: uploads the file, then sends the message. */
  async sendFile(roomId: string, file: File, body?: string): Promise<string> {
    const mediaUri = await this.uploadChatMedia(file);
    const isImage = file.type.startsWith("image/");
    const isAudio = file.type.startsWith("audio/");
    const msgtype = isImage ? "m.image" : isAudio ? "m.audio" : "m.file";
    return this.sendMessage(roomId, body || mediaUri, { msgtype });
  }

  /** Load older history for a channel. */
  async loadOlder(roomId: string, limit = 20, from?: string): Promise<{
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
    try {
      const encodedId = encodeURIComponent(roomId);
      const query = from
        ? `limit=${limit}&from=${encodeURIComponent(from)}`
        : `limit=${limit}`;
      const res = await this.get(`/api/rooms/${encodedId}/messages/older?${query}`);
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404 || res.status === 502) {
          return [];
        }
        const errTxt = await res.text();
        throw new Error(`Failed to load older: ${res.status} ${errTxt}`);
      }
      return res.json();
    } catch {
      return [];
    }
  }

  /** Send an m.reaction. */
  async sendReaction(
    roomId: string,
    targetEventId: string,
    emoji: string,
  ): Promise<string> {
    const encodedRoom = encodeURIComponent(roomId);
    const encodedEvent = encodeURIComponent(targetEventId);
    const res = await this.post(`/api/rooms/${encodedRoom}/messages/${encodedEvent}/reactions`, {
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
    const encodedRoom = encodeURIComponent(roomId);
    await this.put(`/api/rooms/${encodedRoom}/typing`, { roomId, isTyping }).then(
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

  // ── Presence ────────────────────────────────────────────────────

  /** Define a presença do próprio usuário (online, offline, unavailable) no Synapse via Echo API. */
  async setPresence(presence: "online" | "offline" | "unavailable", statusMsg?: string): Promise<void> {
    if (!this.accessToken) return;
    try {
      await this.put("/api/users/me/presence", { presence, statusMsg });
    } catch {
      // best-effort
    }
  }

  /** Obtém a presença atual de um usuário em tempo real. */
  async getUserPresence(userId: string): Promise<{ presence: "online" | "offline" | "unavailable" }> {
    const res = await this.get(`/api/users/${encodeURIComponent(userId)}/presence`);
    if (!res.ok) return { presence: "offline" };
    return res.json();
  }

  // ── Avatar/Media ────────────────────────────────────────────────

  /** Upload chat media (file). */
  async uploadChatMedia(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "chat");

    // Timeout de 60s para evitar freeze infinito em uploads grandes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch(`${this.baseUrl}/api/upload/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          ...(this.apiKey ? { "X-API-Key": this.apiKey } : {}),
        },
        body: formData,
        credentials: "omit",
        signal: controller.signal,
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
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new Error("Upload expirou após 60 segundos. Tente com uma imagem menor.");
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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
    // Armazena imediatamente o token e userId no cliente ativo
    this.setAccessToken(data.accessToken, data.userId);
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
          nickname?: string | null;
          avatarUrl?: string | null;
          bannerUrl?: string | null;
          bio?: string | null;
          links?: Array<{ label: string; url: string }>;
        },
    maybeData?: {
      displayName?: string | null;
      nickname?: string | null;
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
  /** Redact (delete) a message or event in a room. */
  async redact(roomId: string, eventId: string): Promise<void> {
    const encodedRoom = encodeURIComponent(roomId);
    const encodedEvent = encodeURIComponent(eventId);
    const res = await this.delete(`/api/rooms/${encodedRoom}/messages/${encodedEvent}`);
    if (!res.ok) throw new Error(`Failed to redact event: ${res.status}`);
  }

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
    onTyping?: (roomId: string, userIds: string[]) => void;
    onPresence?: (userId: string, presence: any) => void;
    onMembers?: (roomId: string, members: any[]) => void;
    onReaction?: (reaction: any) => void;
    onReadReceipt?: (roomId: string, userId: string, eventId: string) => void;
    [key: string]: any;
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

  // ── Friends & DMs ───────────────────────────────────────────────

  /** Lista amigos, solicitações recebidas, enviadas e bloqueados. */
  async getFriends(): Promise<FriendsResponse> {
    if (!this.accessToken) {
      return {
        friends: [],
        pendingIncoming: [],
        pendingOutgoing: [],
        blocked: [],
      };
    }
    const res = await this.get("/api/friends");
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao carregar amigos: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Envia solicitação de amizade. */
  async sendFriendRequest(target: string): Promise<any> {
    const res = await this.post("/api/friends/request", { target });
    if (!res.ok) {
      const errTxt = await res.text();
      let msg = errTxt;
      try {
        const json = JSON.parse(errTxt);
        if (json.error) msg = json.error;
      } catch {}
      throw new Error(msg);
    }
    return res.json();
  }

  /** Aceita solicitação de amizade. */
  async acceptFriendRequest(friendshipId: string): Promise<any> {
    const res = await this.post(`/api/friends/${friendshipId}/accept`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao aceitar pedido: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Recusa solicitação de amizade. */
  async declineFriendRequest(friendshipId: string): Promise<{ success: boolean }> {
    const res = await this.post(`/api/friends/${friendshipId}/decline`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao recusar pedido: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Cancela solicitação de amizade enviada. */
  async cancelFriendRequest(friendshipId: string): Promise<{ success: boolean }> {
    const res = await this.post(`/api/friends/${friendshipId}/cancel`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao cancelar pedido: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Desfaz amizade. */
  async removeFriend(friendshipId: string): Promise<{ success: boolean }> {
    const res = await this.delete(`/api/friends/${friendshipId}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao desfazer amizade: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Bloqueia um usuário. */
  async blockUser(targetUserId: string): Promise<any> {
    const res = await this.post(`/api/friends/${targetUserId}/block`, { targetUserId });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao bloquear usuário: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Desbloqueia um usuário. */
  async unblockUser(targetUserIdOrFriendshipId: string): Promise<{ success: boolean }> {
    const res = await this.post(`/api/friends/${targetUserIdOrFriendshipId}/unblock`, { targetUserId: targetUserIdOrFriendshipId });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao desbloquear usuário: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Cria ou obtém sala direta 1-a-1 com o usuário. */
  async getOrCreateDirectRoom(targetUserId: string): Promise<{ roomId: string }> {
    const res = await this.post("/api/friends/dm", { targetUserId });
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao obter sala direta: ${res.status} ${errTxt}`);
    }
    return res.json();
  }

  /** Lista usuários cadastrados para descobrimento. */
  async getDiscoveredUsers(query?: string, limit?: number): Promise<DiscoveryResponse> {
    if (!this.accessToken) {
      return { users: [] };
    }
    const params = new URLSearchParams();
    if (query?.trim()) params.append("q", query.trim());
    if (limit) params.append("limit", String(limit));
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await this.get(`/api/friends/discover${qs}`);
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Falha ao buscar usuários para descobrir: ${res.status} ${errTxt}`);
    }
    return res.json();
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

  // ── Voice & WebRTC Signaling ──────────────────────────────────

  /** Join a voice channel. */
  async joinVoiceChannel(
    channelId: string,
    data: {
      guildId?: string;
      username?: string;
      avatarUrl?: string | null;
      isMuted?: boolean;
      isDeafened?: boolean;
      isScreenSharing?: boolean;
      hasCamera?: boolean;
    },
  ): Promise<{ success: boolean; channelId: string; participants: any[] }> {
    const encoded = encodeURIComponent(channelId);
    const res = await this.post(`/api/channels/${encoded}/voice/join`, data);
    if (!res.ok) throw new Error(`Failed to join voice channel: ${res.status}`);
    return res.json();
  }

  /** Heartbeat for active voice session. */
  async voiceHeartbeat(
    channelId: string,
    data: {
      guildId?: string;
      username?: string;
      avatarUrl?: string | null;
      isSpeaking?: boolean;
      isMuted?: boolean;
      isDeafened?: boolean;
      isScreenSharing?: boolean;
      hasCamera?: boolean;
    },
  ): Promise<{ channelId: string; participants: any[]; myUserId?: string }> {
    const encoded = encodeURIComponent(channelId);
    const res = await this.post(`/api/channels/${encoded}/voice/heartbeat`, data);
    if (!res.ok) throw new Error(`Voice heartbeat failed: ${res.status}`);
    return res.json();
  }

  /** Leave a voice channel. */
  async leaveVoiceChannel(channelId?: string): Promise<{ success: boolean }> {
    const encoded = channelId ? encodeURIComponent(channelId) : "current";
    const res = await this.post(`/api/channels/${encoded}/voice/leave`, {});
    if (!res.ok) throw new Error(`Failed to leave voice channel: ${res.status}`);
    return res.json();
  }

  /** Get active voice participants in all channels of a guild. */
  async getGuildVoiceState(guildId: string): Promise<{ guildId: string; channels: Record<string, any[]> }> {
    const encoded = encodeURIComponent(guildId);
    const res = await this.get(`/api/guilds/${encoded}/voice/state`);
    if (!res.ok) throw new Error(`Failed to get guild voice state: ${res.status}`);
    return res.json();
  }

  /** Send WebRTC signaling payload (offer/answer/candidate) to a peer. */
  async sendVoiceSignal(channelId: string, targetUserId: string, signal: any): Promise<{ success: boolean }> {
    const encoded = encodeURIComponent(channelId);
    const res = await this.post(`/api/channels/${encoded}/voice/signal`, { targetUserId, signal });
    if (!res.ok) throw new Error(`Failed to send voice signal: ${res.status}`);
    return res.json();
  }

  /** Retrieve queued WebRTC signaling payloads for current user. */
  async getVoiceSignals(channelId: string): Promise<{ signals: Array<{ fromUserId: string; channelId: string; signal: any }> }> {
    const encoded = encodeURIComponent(channelId);
    const res = await this.get(`/api/channels/${encoded}/voice/signals`);
    if (!res.ok) throw new Error(`Failed to get voice signals: ${res.status}`);
    return res.json();
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
