/**
 * Session returned by loginWithSsoToken / consumed by restoreSession.
 */
export interface Session {
  baseUrl: string;
  accessToken: string;
  userId: string;
  deviceId: string | null;
  refreshToken?: string;
}

/**
 * A m.room.message event normalized from the SDK timeline.
 */
export interface NormalizedEvent {
  eventId: string;
  roomId: string;
  sender: string;
  body: string;
  originServerTs: number;
}

export interface GuildSummary {
  guildId: string;
  name: string;
  avatarUrl: string | null;
  unreadCount: number;
}

export interface ChannelSummary {
  channelId: string;
  name: string;
  unreadCount: number;
}

export type SyncStatus = "connecting" | "syncing" | "error";

/**
 * Dados do erro de sync (evento "sync" com estado ERROR do SDK).
 * `errcode` permite distinguir falha de autenticação (ex.: M_UNKNOWN_TOKEN,
 * token revogado → limpar a sessão) de erro de rede (manter a sessão e
 * reconectar). Presente só quando o SDK entrega o erro.
 */
export interface SyncErrorInfo {
  errcode: string;
}

/**
 * Structural subset of matrix-js-sdk's MatrixClient that MatrixService uses.
 * Lets tests inject a fake client without loading the real SDK.
 * (ICreateRoomOpts é import type-only: zero custo em runtime.)
 */
import type { ICreateRoomOpts } from "matrix-js-sdk";

export interface MatrixClientLike {
  loginRequest(req: { type: "m.login.token"; token: string }): Promise<LoginResponseLike>;
  getSsoLoginUrl(redirectUrl: string, loginType?: string, idpId?: string, action?: string): string;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  startClient(opts?: Record<string, unknown>): void;
  stopClient(): void;
  sendMessage(roomId: string, content: { msgtype: string; body: string }): Promise<SendEventResponseLike>;
  getRooms(): RoomLike[];
  getRoom(roomId: string): RoomLike | null;
  createRoom(opts: ICreateRoomOpts): Promise<{ room_id: string }>;
  sendStateEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    stateKey?: string,
  ): Promise<{ event_id: string }>;
}

export type SendEventResponseLike = string | { event_id: string };

export interface LoginResponseLike {
  access_token?: string;
  user_id?: string;
  device_id?: string | null;
  refresh_token?: string;
  home_server?: string;
}

export interface RoomStateEventLike {
  getStateKey(): string | undefined;
  getContent(): Record<string, unknown>;
}

export interface RoomLike {
  roomId: string;
  getMyMembership(): string;
  /** Room type from m.room.create; "m.space" for Spaces. */
  getType(): string | null | undefined;
  getMxcAvatarUrl(): string | null;
  getUnreadNotificationCount(type?: string): number;
  currentState: {
    getStateEvents(eventType: string): RoomStateEventLike[];
  };
}

export interface TimelineEventLike {
  getType(): string;
  getId(): string;
  getRoomId(): string | null;
  getSender(): string;
  getContent(): { body?: string };
  getTs(): number;
}
