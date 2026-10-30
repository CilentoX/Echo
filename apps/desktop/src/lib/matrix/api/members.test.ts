import { describe, it, expect, vi, beforeEach } from "vitest";
import { MembersApi } from "./members";
import type { MatrixClientLike, RoomLike, RoomMemberLike } from "../types";

function createMockRoom(roomId: string): RoomLike {
  const members: RoomMemberLike[] = [
    { userId: "@alice:example.com", name: "Alice", membership: "join", avatarUrl: "mxc://avatar/alice", user: { presence: "online" } },
    { userId: "@bob:example.com", name: "Bob", membership: "join", avatarUrl: "mxc://avatar/bob", user: { presence: "offline" } },
    { userId: "@charlie:example.com", name: "Charlie", membership: "join", avatarUrl: null, user: { presence: "unavailable" } },
  ];

  return {
    roomId,
    getMyMembership: () => "join",
    getType: () => null,
    getMxcAvatarUrl: () => null,
    getUnreadNotificationCount: () => 0,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    getJoinedMembers: () => members,
    currentState: { getStateEvents: () => [] },
  };
}

function createMockClient(rooms: Map<string, RoomLike>): MatrixClientLike {
  const client: MatrixClientLike = {
    loginRequest: vi.fn(),
    getSsoLoginUrl: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    sendMessage: vi.fn(),
    sendEvent: vi.fn(),
    sendTyping: vi.fn(),
    redactEvent: vi.fn(),
    leave: vi.fn(),
    sendReadReceipt: vi.fn(),
    scrollback: vi.fn(),
    getUserId: () => "@me:example.com",
    getAccessToken: () => "token",
    getHomeserverUrl: () => "https://example.com",
    mxcUrlToHttp: vi.fn(),
    getProfileInfo: vi.fn(),
    setDisplayName: vi.fn(),
    setAvatarUrl: vi.fn(),
    getRooms: () => Array.from(rooms.values()),
    getRoom: (roomId: string) => rooms.get(roomId) ?? null,
    createRoom: vi.fn(),
    sendStateEvent: vi.fn(),
    uploadContent: vi.fn(),
    // Member management methods
    inviteUser: vi.fn().mockResolvedValue({ event_id: "$invite-event" }),
    kickUser: vi.fn().mockResolvedValue({ event_id: "$kick-event" }),
    banUser: vi.fn().mockResolvedValue({ event_id: "$ban-event" }),
    setPowerLevel: vi.fn().mockResolvedValue({ event_id: "$power-event" }),
  };
  return client;
}

function createClientFactory(rooms: Map<string, RoomLike>): (opts: Record<string, unknown>) => MatrixClientLike {
  return () => createMockClient(rooms);
}

describe("MembersApi", () => {
  let api: MembersApi;
  let rooms: Map<string, RoomLike>;
  let mockClient: MatrixClientLike;
  let mockClientFactory: (opts: Record<string, unknown>) => MatrixClientLike;

  beforeEach(() => {
    rooms = new Map();
    rooms.set("!room1:example.com", createMockRoom("!room1:example.com"));
    rooms.set("!room2:example.com", createMockRoom("!room2:example.com"));
    mockClient = createMockClient(rooms);
    mockClientFactory = createClientFactory(rooms);
    api = new MembersApi(mockClient, mockClientFactory);
  });

  describe("listMembers", () => {
    it("returns joined members with displayName, presence, and avatarUrl", async () => {
      const members = await api.listMembers("!room1:example.com");

      expect(members).toHaveLength(3);
      expect(members[0]).toEqual({
        userId: "@alice:example.com",
        displayName: "Alice",
        presence: "online",
        avatarUrl: "mxc://avatar/alice",
      });
      expect(members[1]).toEqual({
        userId: "@bob:example.com",
        displayName: "Bob",
        presence: "offline",
        avatarUrl: "mxc://avatar/bob",
      });
      expect(members[2]).toEqual({
        userId: "@charlie:example.com",
        displayName: "Charlie",
        presence: "unavailable",
        avatarUrl: null,
      });
    });

    it("returns empty array when room does not exist", async () => {
      const members = await api.listMembers("!nonexistent:example.com");
      expect(members).toEqual([]);
    });

    it("uses updated client after setClient", async () => {
      const newRooms = new Map<string, RoomLike>();
      newRooms.set("!room3:example.com", createMockRoom("!room3:example.com"));
      const newClient = createMockClient(newRooms);
      api.setClient(newClient);

      const members = await api.listMembers("!room3:example.com");
      expect(members).toHaveLength(3);
    });
  });

  describe("inviteUser", () => {
    it("invites a user to a room and returns event id", async () => {
      const eventId = await api.inviteUser("!room1:example.com", "@newuser:example.com");

      expect(eventId).toBe("$invite-event");
      expect(mockClient.inviteUser).toHaveBeenCalledWith("!room1:example.com", "@newuser:example.com");
    });

    it("throws when room does not exist", async () => {
      await expect(api.inviteUser("!nonexistent:example.com", "@user:example.com"))
        .rejects.toThrow("Room not found: !nonexistent:example.com");
    });
  });

  describe("kickUser", () => {
    it("kicks a user from a room and returns event id", async () => {
      const eventId = await api.kickUser("!room1:example.com", "@bob:example.com", "Spam");

      expect(eventId).toBe("$kick-event");
      expect(mockClient.kickUser).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com", "Spam");
    });

    it("kicks a user without reason", async () => {
      const eventId = await api.kickUser("!room1:example.com", "@bob:example.com");

      expect(eventId).toBe("$kick-event");
      expect(mockClient.kickUser).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com", undefined);
    });

    it("throws when room does not exist", async () => {
      await expect(api.kickUser("!nonexistent:example.com", "@user:example.com"))
        .rejects.toThrow("Room not found: !nonexistent:example.com");
    });
  });

  describe("banUser", () => {
    it("bans a user from a room and returns event id", async () => {
      const eventId = await api.banUser("!room1:example.com", "@bob:example.com", "Abuse");

      expect(eventId).toBe("$ban-event");
      expect(mockClient.banUser).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com", "Abuse");
    });

    it("bans a user without reason", async () => {
      const eventId = await api.banUser("!room1:example.com", "@bob:example.com");

      expect(eventId).toBe("$ban-event");
      expect(mockClient.banUser).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com", undefined);
    });

    it("throws when room does not exist", async () => {
      await expect(api.banUser("!nonexistent:example.com", "@user:example.com"))
        .rejects.toThrow("Room not found: !nonexistent:example.com");
    });
  });

  describe("setPowerLevel", () => {
    it("sets power level for a user and returns event id", async () => {
      const eventId = await api.setPowerLevel("!room1:example.com", "@bob:example.com", 50);

      expect(eventId).toBe("$power-event");
      expect(mockClient.setPowerLevel).toHaveBeenCalledWith("!room1:example.com", "@bob:example.com", 50);
    });

    it("throws when room does not exist", async () => {
      await expect(api.setPowerLevel("!nonexistent:example.com", "@user:example.com", 50))
        .rejects.toThrow("Room not found: !nonexistent:example.com");
    });

    it("throws for invalid power level (negative)", async () => {
      await expect(api.setPowerLevel("!room1:example.com", "@bob:example.com", -10))
        .rejects.toThrow("Power level must be between 0 and 100");
    });

    it("throws for invalid power level (over 100)", async () => {
      await expect(api.setPowerLevel("!room1:example.com", "@bob:example.com", 150))
        .rejects.toThrow("Power level must be between 0 and 100");
    });
  });

  describe("setClient", () => {
    it("updates the internal client reference", async () => {
      const newRooms = new Map<string, RoomLike>();
      newRooms.set("!newroom:example.com", createMockRoom("!newroom:example.com"));
      const newClient = createMockClient(newRooms);

      api.setClient(newClient);

      const members = await api.listMembers("!newroom:example.com");
      expect(members).toHaveLength(3);
    });
  });
});