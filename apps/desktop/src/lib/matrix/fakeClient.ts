import { vi, type Mock } from "vitest";
import type { RoomLike, RoomStateEventLike, TimelineEventLike } from "./types";

/**
 * Test double with the same surface of the SDK client that MatrixService uses.
 * Never touches the network — events are emitted manually via `emit`.
 */
export interface FakeClient {
  loginRequest: Mock;
  getSsoLoginUrl: Mock;
  on: Mock;
  removeListener: Mock;
  startClient: Mock;
  stopClient: Mock;
  sendMessage: Mock;
  getRooms: Mock;
  getRoom: Mock;
  createRoom: Mock;
  emit(event: string, ...args: unknown[]): void;
}

export function createFakeClient(): FakeClient {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    loginRequest: vi.fn(async () => ({
      access_token: "fake-at",
      user_id: "@user:hs.example",
      device_id: "FAKEDEV",
      refresh_token: "fake-rt",
    })),
    getSsoLoginUrl: vi.fn(
      (redirectUrl: string) =>
        `https://hs.example/_matrix/client/v3/login/sso/redirect?redirectUrl=${encodeURIComponent(redirectUrl)}`,
    ),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    }),
    removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    sendMessage: vi.fn(async () => ({ event_id: "$fake-sent" })),
    getRooms: vi.fn(() => []),
    getRoom: vi.fn(() => null),
    createRoom: vi.fn(async () => ({ room_id: "!created:hs" })),
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) listener(...args);
    },
  };
}

export function createFakeStateEvent(
  _type: string,
  stateKey: string,
  content: Record<string, unknown>,
): RoomStateEventLike {
  return {
    getStateKey: () => stateKey,
    getContent: () => content,
  };
}

export interface FakeRoomOptions {
  roomId?: string;
  /** Room type from the m.room.create event ("m.space" for Spaces). */
  type?: string | null;
  membership?: string;
  /** Name from the m.room.name state event. */
  name?: string;
  /** Name from the m.space.name state event. */
  spaceName?: string;
  avatarUrl?: string | null;
  unreadCount?: number;
  /** Children declared via m.space.child state events. */
  children?: Array<{ roomId: string; via?: string[] }>;
}

export function createFakeRoom(opts: FakeRoomOptions = {}): RoomLike {
  const roomId = opts.roomId ?? "!room:hs.example";
  const stateEvents = new Map<string, RoomStateEventLike[]>();

  if (opts.name !== undefined) {
    stateEvents.set(
      "m.room.name",
      [createFakeStateEvent("m.room.name", "", { name: opts.name })],
    );
  }
  if (opts.spaceName !== undefined) {
    stateEvents.set(
      "m.space.name",
      [createFakeStateEvent("m.space.name", "", { name: opts.spaceName })],
    );
  }
  if (opts.children) {
    stateEvents.set(
      "m.space.child",
      opts.children.map((child) =>
        createFakeStateEvent("m.space.child", child.roomId, child.via ? { via: child.via } : {}),
      ),
    );
  }

  return {
    roomId,
    getMyMembership: () => opts.membership ?? "join",
    getType: () => opts.type ?? null,
    getMxcAvatarUrl: () => opts.avatarUrl ?? null,
    getUnreadNotificationCount: () => opts.unreadCount ?? 0,
    currentState: {
      getStateEvents: (eventType: string) => stateEvents.get(eventType) ?? [],
    },
  };
}

export interface FakeTimelineEventOptions {
  eventId?: string;
  roomId?: string;
  sender?: string;
  body?: string;
  type?: string;
  ts?: number;
}

export function createFakeTimelineEvent(
  opts: FakeTimelineEventOptions = {},
): TimelineEventLike {
  const eventId = opts.eventId ?? "$evt:hs.example";
  const roomId = opts.roomId ?? "!room:hs.example";
  const sender = opts.sender ?? "@sender:hs.example";
  const body = opts.body ?? "hello";
  const type = opts.type ?? "m.room.message";
  const ts = opts.ts ?? 1700000000000;

  return {
    getType: () => type,
    getId: () => eventId,
    getRoomId: () => roomId,
    getSender: () => sender,
    getContent: () => ({ body }),
    getTs: () => ts,
  };
}
