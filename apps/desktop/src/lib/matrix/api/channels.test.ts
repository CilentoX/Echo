import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "matrix-js-sdk";
import type { ChannelSummary } from "../types";

// Mock the matrix-js-sdk
vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(),
  Preset: { PrivateChat: "private_chat" },
  Visibility: { Private: "private" },
}));

import { ChannelsApi } from "./channels";

describe("ChannelsApi", () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockClientFactory: ReturnType<typeof vi.fn>;
  let channelsApi: ChannelsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      getRoom: vi.fn(),
      createRoom: vi.fn(),
      leave: vi.fn(),
      sendStateEvent: vi.fn(),
      getRooms: vi.fn(),
    };
    mockClientFactory = vi.fn(() => mockClient);
    channelsApi = new ChannelsApi(mockClient, mockClientFactory);
  });

  describe("listChannels", () => {
    it("returns child rooms of a space via m.space.child", async () => {
      const mockSpace = {
        getType: () => "m.space",
        currentState: {
          getStateEvents: (type: string) =>
            type === "m.space.child"
              ? [
                  { getContent: () => ({ via: ["!guild:example.com"] }), getStateKey: () => "!channel1:example.com" },
                  { getContent: () => ({ via: ["!guild:example.com"] }), getStateKey: () => "!channel2:example.com" },
                  { getContent: () => ({ via: ["!other:example.com"] }), getStateKey: () => "!channel3:example.com" }, // wrong via
                ]
              : [],
        },
      };

      const mockRoom1 = {
        getType: () => "m.room",
        getMxcAvatarUrl: () => "mxc://example.com/avatar1",
        getUnreadNotificationCount: () => 3,
        currentState: { getStateEvents: (type: string) => type === "m.room.name" ? [{ getContent: () => ({ name: "general" }) }] : [] },
      };

      const mockRoom2 = {
        getType: () => "m.room",
        getMxcAvatarUrl: () => null,
        getUnreadNotificationCount: () => 0,
        currentState: { getStateEvents: () => [] },
      };

      mockClient.getRoom
        .mockReturnValueOnce(mockSpace)
        .mockReturnValueOnce(mockRoom1)
        .mockReturnValueOnce(mockRoom2);

      const channels = await channelsApi.listChannels("!guild:example.com");

      expect(channels).toHaveLength(2);
      expect(channels[0]).toEqual({
        channelId: "!channel1:example.com",
        name: "general",
        unreadCount: 3,
      });
      expect(channels[1].channelId).toBe("!channel2:example.com");
    });

    it("returns empty array when guild not found", async () => {
      mockClient.getRoom.mockReturnValue(null);

      const channels = await channelsApi.listChannels("!guild:example.com");

      expect(channels).toEqual([]);
    });

    it("filters out non-space children (wrong via)", async () => {
      const mockSpace = {
        getType: () => "m.space",
        currentState: {
          getStateEvents: () => [
            { getContent: () => ({ via: ["!other:example.com"] }), getStateKey: () => "!channel:example.com" },
          ],
        },
      };

      mockClient.getRoom.mockReturnValue(mockSpace);

      const channels = await channelsApi.listChannels("!guild:example.com");

      expect(channels).toHaveLength(0);
    });
  });

  describe("createChannel", () => {
    it("creates room and adds m.space.child to parent space", async () => {
      mockClient.getRoom.mockReturnValue({ getType: () => "m.space" });
      mockClient.createRoom.mockResolvedValue({ room_id: "!newchannel:example.com" });
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "child-123" });

      const result = await channelsApi.createChannel("!guild:example.com", {
        name: "  novo-canal  ",
        type: "text",
        topic: "Tópico do canal",
        category: "Anúncios",
      });

      expect(mockClient.createRoom).toHaveBeenCalledWith(expect.objectContaining({
        name: "novo-canal",
        topic: "Tópico do canal",
        visibility: "private",
        preset: "private_chat",
        creation_content: { "m.federate": false },
      }));
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        "!guild:example.com",
        "m.space.child",
        { via: ["!guild:example.com"] },
        "!newchannel:example.com"
      );
      expect(result).toEqual({
        channelId: "!newchannel:example.com",
        name: "novo-canal",
        topic: "Tópico do canal",
        type: "text",
        category: "Anúncios",
        unreadCount: 0,
      });
    });

    it("throws when parent is not a space", async () => {
      mockClient.getRoom.mockReturnValue({ getType: () => "m.room" });

      await expect(
        channelsApi.createChannel("!room:example.com", { name: "test", type: "text" })
      ).rejects.toThrow("createChannel: guilda não encontrada");
    });

    it("throws when name is empty", async () => {
      mockClient.getRoom.mockReturnValue({ getType: () => "m.space" });

      await expect(
        channelsApi.createChannel("!guild:example.com", { name: "   ", type: "text" })
      ).rejects.toThrow("createChannel: nome é obrigatório");
    });

    it("sanitizes channel name to lowercase with hyphens", async () => {
      mockClient.getRoom.mockReturnValue({ getType: () => "m.space" });
      mockClient.createRoom.mockResolvedValue({ room_id: "!chan:example.com" });
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "child-123" });

      await channelsApi.createChannel("!guild:example.com", {
        name: "Meu Canal Legal!",
        type: "text",
      });

      expect(mockClient.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ name: "meu-canal-legal" })
      );
    });
  });

  describe("editChannel", () => {
    it("updates name, topic, and category", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await channelsApi.editChannel("!channel:example.com", {
        name: "novo-nome",
        topic: "novo tópico",
        category: "Nova categoria",
      });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!channel:example.com", "m.room.name", { name: "novo-nome" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!channel:example.com", "m.room.topic", { topic: "novo tópico" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!channel:example.com", "echo.channel.category", { category: "Nova categoria" });
    });

    it("allows partial updates", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await channelsApi.editChannel("!channel:example.com", { name: "only name" });

      expect(mockClient.sendStateEvent).toHaveBeenCalledTimes(1);
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!channel:example.com", "m.room.name", { name: "only name" });
    });

    it("allows setting topic to null to remove", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await channelsApi.editChannel("!channel:example.com", { topic: null });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!channel:example.com", "m.room.topic", { topic: null });
    });

    it("throws when name is empty string", async () => {
      await expect(channelsApi.editChannel("!channel:example.com", { name: "   " })).rejects.toThrow("editChannel: nome é obrigatório");
    });
  });

  describe("deleteChannel", () => {
    it("leaves the channel room", async () => {
      mockClient.leave.mockResolvedValue(undefined);

      await channelsApi.deleteChannel("!channel:example.com");

      expect(mockClient.leave).toHaveBeenCalledWith("!channel:example.com");
    });
  });

  describe("setClient", () => {
    it("updates internal client reference", async () => {
      const newMockClient = { getRoom: vi.fn(), createRoom: vi.fn(), leave: vi.fn(), sendStateEvent: vi.fn() };
      newMockClient.getRoom.mockReturnValue({ getType: () => "m.space", currentState: { getStateEvents: () => [] } });

      channelsApi.setClient(newMockClient);
      const channels = await channelsApi.listChannels("!guild:example.com");

      expect(newMockClient.getRoom).toHaveBeenCalledWith("!guild:example.com");
      expect(channels).toEqual([]);
    });
  });
});