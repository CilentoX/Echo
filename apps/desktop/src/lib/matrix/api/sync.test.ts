import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "matrix-js-sdk";
import type { SyncHandlers, SyncStatus, SyncErrorInfo, NormalizedEvent } from "../types";
import { DEFAULT_START_CLIENT_OPTS, SyncApi } from "./sync";

// Mock the matrix-js-sdk
vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(),
  Preset: { PrivateChat: "private_chat" },
  Visibility: { Private: "private" },
}));

describe("SyncApi", () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockClientFactory: ReturnType<typeof vi.fn>;
  let syncApi: SyncApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      on: vi.fn(),
      removeListener: vi.fn(),
      startClient: vi.fn(),
      stopClient: vi.fn(),
    };
    mockClientFactory = vi.fn(() => mockClient);
    syncApi = new SyncApi(mockClient, mockClientFactory);
  });

  describe("startSyncHandlers", () => {
    it("registers all sync listeners and starts client", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onTyping: vi.fn(),
        onPresence: vi.fn(),
        onMembers: vi.fn(),
        onReaction: vi.fn(),
        onReadReceipt: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      // Verify all listeners registered
      expect(mockClient.on).toHaveBeenCalledWith("sync", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("Room.timeline", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("RoomMember.typing", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("User.presence", expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith("RoomStateEvent.Members", expect.any(Function));

      // Verify startClient called with default options
      expect(mockClient.startClient).toHaveBeenCalledWith(DEFAULT_START_CLIENT_OPTS);
    });

    it("does not register listeners twice if called again", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);
      syncApi.startSyncHandlers(handlers);

      // on should only be called once per event type
      expect(mockClient.on).toHaveBeenCalledTimes(5);
    });
  });

  describe("stopSync", () => {
    it("removes all listeners and stops client", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);
      syncApi.stopSync();

      expect(mockClient.removeListener).toHaveBeenCalledWith("sync", expect.any(Function));
      expect(mockClient.removeListener).toHaveBeenCalledWith("Room.timeline", expect.any(Function));
      expect(mockClient.removeListener).toHaveBeenCalledWith("RoomMember.typing", expect.any(Function));
      expect(mockClient.removeListener).toHaveBeenCalledWith("User.presence", expect.any(Function));
      expect(mockClient.removeListener).toHaveBeenCalledWith("RoomStateEvent.Members", expect.any(Function));
      expect(mockClient.stopClient).toHaveBeenCalled();
    });

    it("handles stopSync when not started", () => {
      // Should not throw
      syncApi.stopSync();
      expect(mockClient.stopClient).not.toHaveBeenCalled();
    });
  });

  describe("sync listener", () => {
    it("calls onStatus with correct status mapping", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      // Get the sync listener
      const syncListener = mockClient.on.mock.calls.find(([event]) => event === "sync")?.[1];
      expect(syncListener).toBeDefined();

      // Test PREPARING -> connecting
      syncListener?.("PREPARING");
      expect(handlers.onStatus).toHaveBeenCalledWith("connecting");

      // Test SYNCING -> syncing
      syncListener?.("SYNCING");
      expect(handlers.onStatus).toHaveBeenCalledWith("syncing");

      // Test ERROR with error info
      syncListener?.("ERROR", null, { error: { errcode: "M_UNKNOWN_TOKEN" } });
      expect(handlers.onStatus).toHaveBeenCalledWith("error", { errcode: "M_UNKNOWN_TOKEN" });
    });
  });

  describe("timeline listener", () => {
    it("normalizes timeline events and calls onEvent", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const timelineListener = mockClient.on.mock.calls.find(([event]) => event === "Room.timeline")?.[1];
      expect(timelineListener).toBeDefined();

      const mockEvent = {
        getType: () => "m.room.message",
        getId: () => "$event123",
        getRoomId: () => "!room:example.com",
        getSender: () => "@user:example.com",
        getContent: () => ({ body: "Hello" }),
        getTs: () => Date.now(),
        isRedacted: () => false,
      };

      timelineListener?.(mockEvent);
      expect(handlers.onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "$event123",
          roomId: "!room:example.com",
          sender: "@user:example.com",
          body: "Hello",
        })
      );
    });

    it("ignores non-message events", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const timelineListener = mockClient.on.mock.calls.find(([event]) => event === "Room.timeline")?.[1];
      expect(timelineListener).toBeDefined();

      const mockEvent = {
        getType: () => "m.reaction",
        getId: () => "$event123",
        getRoomId: () => "!room:example.com",
        getSender: () => "@user:example.com",
        getContent: () => ({}),
        getTs: () => Date.now(),
      };

      timelineListener?.(mockEvent);
      expect(handlers.onEvent).not.toHaveBeenCalled();
    });

    it("ignores redacted events", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const timelineListener = mockClient.on.mock.calls.find(([event]) => event === "Room.timeline")?.[1];
      expect(timelineListener).toBeDefined();

      const mockEvent = {
        getType: () => "m.room.message",
        getId: () => "$event123",
        getRoomId: () => "!room:example.com",
        getSender: () => "@user:example.com",
        getContent: () => ({ body: "Hello" }),
        getTs: () => Date.now(),
        isRedacted: () => true,
      };

      timelineListener?.(mockEvent);
      expect(handlers.onEvent).not.toHaveBeenCalled();
    });
  });

  describe("typing listener", () => {
    it("calls onTyping with roomId, userId, isTyping (wiring aggregates)", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onTyping: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const typingListener = mockClient.on.mock.calls.find(([event]) => event === "RoomMember.typing")?.[1];
      expect(typingListener).toBeDefined();

      const mockEvent = { getRoomId: () => "!room:example.com" };
      const mockMember = { userId: "@user1:example.com", typing: true };

      typingListener?.(mockEvent, mockMember);
      expect(handlers.onTyping).toHaveBeenCalledWith("!room:example.com", "@user1:example.com", true);
    });

    it("calls onTyping with false when user stops typing", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onTyping: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const typingListener = mockClient.on.mock.calls.find(([event]) => event === "RoomMember.typing")?.[1];
      expect(typingListener).toBeDefined();

      const mockEvent = { getRoomId: () => "!room:example.com" };
      const mockMember = { userId: "@user1:example.com", typing: false };

      typingListener?.(mockEvent, mockMember);
      expect(handlers.onTyping).toHaveBeenCalledWith("!room:example.com", "@user1:example.com", false);
    });
  });

  describe("presence listener", () => {
    it("maps presence and calls onPresence", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onPresence: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const presenceListener = mockClient.on.mock.calls.find(([event]) => event === "User.presence")?.[1];
      expect(presenceListener).toBeDefined();

      const mockUser = { userId: "@user1:example.com", presence: "online" };
      presenceListener?.({}, mockUser);
      expect(handlers.onPresence).toHaveBeenCalledWith("@user1:example.com", "online");
    });
  });

  describe("members listener", () => {
    it("calls onMembers with member summary", () => {
      const handlers: SyncHandlers = {
        onEvent: vi.fn(),
        onStatus: vi.fn(),
        onMembers: vi.fn(),
      };

      syncApi.startSyncHandlers(handlers);

      const membersListener = mockClient.on.mock.calls.find(([event]) => event === "RoomStateEvent.Members")?.[1];
      expect(membersListener).toBeDefined();

      const mockMember = {
        userId: "@user1:example.com",
        name: "User One",
        membership: "join",
        user: { presence: "online" },
      };

      membersListener?.({}, mockMember);
      expect(handlers.onMembers).toHaveBeenCalledWith("@user1:example.com", [
        expect.objectContaining({
          userId: "@user1:example.com",
          displayName: "User One",
          presence: "online",
        }),
      ]);
    });
  });
});