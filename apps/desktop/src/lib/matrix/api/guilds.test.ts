import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "matrix-js-sdk";
import type { GuildSummary } from "../types";

// Mock the matrix-js-sdk
vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(),
  Preset: { PrivateChat: "private_chat" },
  Visibility: { Private: "private" },
}));

import { GuildsApi } from "./guilds";

describe("GuildsApi", () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockClientFactory: ReturnType<typeof vi.fn>;
  let guildsApi: GuildsApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      getRooms: vi.fn(),
      createRoom: vi.fn(),
      leave: vi.fn(),
      sendStateEvent: vi.fn(),
      getRoom: vi.fn(),
    };
    mockClientFactory = vi.fn(() => mockClient);
    guildsApi = new GuildsApi(mockClient, mockClientFactory);
  });

  describe("listGuilds", () => {
    it("filters joined m.space rooms and maps to GuildSummary", async () => {
      const mockRooms = [
        {
          getMyMembership: () => "join",
          getType: () => "m.space",
          roomId: "!guild1:example.com",
          getMxcAvatarUrl: () => "mxc://example.com/avatar1",
          getUnreadNotificationCount: () => 5,
          currentState: {
            getStateEvents: (type: string) => type === "m.room.name" ? [{ getContent: () => ({ name: "Guild One" }) }] : [],
          },
        },
        {
          getMyMembership: () => "join",
          getType: () => "m.room",
          roomId: "!room1:example.com",
        },
        {
          getMyMembership: () => "invite",
          getType: () => "m.space",
          roomId: "!guild2:example.com",
        },
      ];

      mockClient.getRooms.mockReturnValue(mockRooms);

      const guilds = await guildsApi.listGuilds();

      expect(guilds).toHaveLength(1);
      expect(guilds[0]).toEqual({
        guildId: "!guild1:example.com",
        name: "Guild One",
        avatarUrl: "mxc://example.com/avatar1",
        unreadCount: 5,
      });
    });

    it("falls back to roomId when name not set", async () => {
      const mockRoom = {
        getMyMembership: () => "join",
        getType: () => "m.space",
        roomId: "!guild:example.com",
        getMxcAvatarUrl: () => null,
        getUnreadNotificationCount: () => 0,
        currentState: {
          getStateEvents: () => [],
        },
      };

      mockClient.getRooms.mockReturnValue([mockRoom]);

      const guilds = await guildsApi.listGuilds();

      expect(guilds[0].name).toBe("!guild:example.com");
    });
  });

  describe("createGuild", () => {
    it("creates space with name, icon, banner, description and #geral channel", async () => {
      mockClient.createRoom
        .mockResolvedValueOnce({ room_id: "!guild:example.com" })
        .mockResolvedValueOnce({ room_id: "!geral:example.com" });

      mockClient.getRoom.mockReturnValue({
        roomId: "!guild:example.com",
        currentState: {
          getStateEvents: () => [],
        },
      });

      const result = await guildsApi.createGuild({
        name: "  Nova Guilda  ",
        iconUrl: "mxc://example.com/icon",
        bannerUrl: "mxc://example.com/banner",
        description: "Descrição da guilda",
      });

      expect(mockClient.createRoom).toHaveBeenCalledTimes(2);
      expect(mockClient.createRoom).toHaveBeenNthCalledWith(1, expect.objectContaining({
        name: "Nova Guilda",
        creation_content: { type: "m.space" },
      }));
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.avatar", { url: "mxc://example.com/icon" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "echo.room.banner", { url: "mxc://example.com/banner" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.topic", { topic: "Descrição da guilda" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.space.child", { via: ["!guild:example.com"] }, "!geral:example.com");

      expect(result).toEqual({
        guildId: "!guild:example.com",
        name: "Nova Guilda",
        avatarUrl: "mxc://example.com/icon",
        unreadCount: 0,
      });
    });

    it("throws when name is empty", async () => {
      await expect(guildsApi.createGuild({ name: "   " })).rejects.toThrow("createGuild: nome é obrigatório");
    });

    it("does not block if #geral channel creation fails", async () => {
      mockClient.createRoom
        .mockResolvedValueOnce({ room_id: "!guild:example.com" })
        .mockRejectedValueOnce(new Error("Failed"));

      mockClient.getRoom.mockReturnValue({
        roomId: "!guild:example.com",
        currentState: {
          getStateEvents: () => [],
        },
      });

      const result = await guildsApi.createGuild({ name: "Test" });

      expect(result.guildId).toBe("!guild:example.com");
    });
  });

  describe("deleteGuild", () => {
    it("leaves the guild room", async () => {
      mockClient.leave.mockResolvedValue(undefined);

      await guildsApi.deleteGuild("!guild:example.com");

      expect(mockClient.leave).toHaveBeenCalledWith("!guild:example.com");
    });
  });

  describe("leaveGuild", () => {
    it("leaves the guild room", async () => {
      mockClient.leave.mockResolvedValue(undefined);

      await guildsApi.leaveGuild("!guild:example.com");

      expect(mockClient.leave).toHaveBeenCalledWith("!guild:example.com");
    });
  });

  describe("editGuild", () => {
    it("updates name, icon, banner, and description", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await guildsApi.editGuild("!guild:example.com", {
        name: "Updated Name",
        iconUrl: "mxc://example.com/new-icon",
        bannerUrl: "mxc://example.com/new-banner",
        description: "Nova descrição",
      });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.name", { name: "Updated Name" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.avatar", { url: "mxc://example.com/new-icon" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "echo.room.banner", { url: "mxc://example.com/new-banner" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.topic", { topic: "Nova descrição" });
    });

    it("allows partial updates (iconUrl undefined)", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await guildsApi.editGuild("!guild:example.com", {
        name: "Same Name",
        // iconUrl, bannerUrl, description undefined
      });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.name", { name: "Same Name" });
      expect(mockClient.sendStateEvent).toHaveBeenCalledTimes(1);
    });

    it("allows setting iconUrl to null to remove", async () => {
      mockClient.sendStateEvent.mockResolvedValue({ event_id: "edit-123" });

      await guildsApi.editGuild("!guild:example.com", {
        name: "Same Name",
        iconUrl: null,
      });

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith("!guild:example.com", "m.room.avatar", { url: null });
    });

    it("throws when name is empty", async () => {
      await expect(guildsApi.editGuild("!guild:example.com", { name: "   " })).rejects.toThrow("editGuild: nome é obrigatório");
    });
  });
});