import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MatrixClientLike, UserProfile } from "../types";
import { ProfileApi } from "./profile";

// Helper to create a fake MatrixClientLike
function createFakeClient(overrides: Partial<MatrixClientLike> = {}): MatrixClientLike {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  return {
    loginRequest: vi.fn(),
    getSsoLoginUrl: vi.fn(),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    }),
    removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      listeners.get(event)?.delete(listener);
    }),
    startClient: vi.fn(),
    stopClient: vi.fn(),
    sendMessage: vi.fn(),
    sendEvent: vi.fn(),
    sendTyping: vi.fn(),
    redactEvent: vi.fn(),
    leave: vi.fn(),
    sendReadReceipt: vi.fn(),
    scrollback: vi.fn(),
    getUserId: vi.fn(() => "@me:echo.litteris.online"),
    getAccessToken: vi.fn(() => "fake-token"),
    getBaseUrl: vi.fn(() => "https://echo.litteris.online"),
    mxcUrlToHttp: vi.fn(),
    getProfileInfo: vi.fn(),
    setDisplayName: vi.fn(),
    setAvatarUrl: vi.fn(),
    getRooms: vi.fn(() => []),
    getRoom: vi.fn(),
    createRoom: vi.fn(),
    sendStateEvent: vi.fn(),
    uploadContent: vi.fn(),
    inviteUser: vi.fn(),
    kickUser: vi.fn(),
    banUser: vi.fn(),
    setPowerLevel: vi.fn(),
    ...overrides,
  };
}

describe("ProfileApi", () => {
  let fakeClient: MatrixClientLike;
  let api: ProfileApi;

  beforeEach(() => {
    fakeClient = createFakeClient();
    const clientFactory = vi.fn(() => fakeClient);
    api = new ProfileApi(fakeClient, clientFactory);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getDisplayName", () => {
    it("returns displayname from getProfileInfo when userId provided", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test User", avatar_url: "mxc://avatar" });
      const result = await api.getDisplayName("@other:echo.litteris.online");
      expect(result).toBe("Test User");
      expect(fakeClient.getProfileInfo).toHaveBeenCalledWith("@other:echo.litteris.online");
    });

    it("uses client's userId when userId not provided", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Me", avatar_url: null });
      const result = await api.getDisplayName();
      expect(result).toBe("Me");
      expect(fakeClient.getProfileInfo).toHaveBeenCalledWith("@me:echo.litteris.online");
    });

    it("returns null when displayname is undefined", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ avatar_url: "mxc://avatar" });
      const result = await api.getDisplayName();
      expect(result).toBeNull();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getDisplayName()).rejects.toThrow("no active session");
    });
  });

  describe("setDisplayName", () => {
    it("calls setDisplayName on client", async () => {
      await api.setDisplayName("New Name");
      expect(fakeClient.setDisplayName).toHaveBeenCalledWith("New Name");
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.setDisplayName("New Name")).rejects.toThrow("no active session");
    });
  });

  describe("setAvatarUrl", () => {
    it("calls setAvatarUrl with provided URL", async () => {
      await api.setAvatarUrl("mxc://new-avatar");
      expect(fakeClient.setAvatarUrl).toHaveBeenCalledWith("mxc://new-avatar");
    });

    it("calls setAvatarUrl with empty string when null provided", async () => {
      await api.setAvatarUrl(null);
      expect(fakeClient.setAvatarUrl).toHaveBeenCalledWith("");
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.setAvatarUrl("mxc://avatar")).rejects.toThrow("no active session");
    });
  });

  describe("getAvatarUrl", () => {
    it("returns avatar_url from getProfileInfo when userId provided", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test", avatar_url: "mxc://avatar" });
      const result = await api.getAvatarUrl("@other:echo.litteris.online");
      expect(result).toBe("mxc://avatar");
    });

    it("uses client's userId when userId not provided", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Me", avatar_url: "mxc://my-avatar" });
      const result = await api.getAvatarUrl();
      expect(result).toBe("mxc://my-avatar");
    });

    it("returns null when avatar_url is undefined", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test" });
      const result = await api.getAvatarUrl();
      expect(result).toBeNull();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getAvatarUrl()).rejects.toThrow("no active session");
    });
  });

  describe("getBannerUrl", () => {
    it("returns banner_url from getProfileInfo when present", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test", avatar_url: null, banner_url: "mxc://banner" });
      const result = await api.getBannerUrl();
      expect(result).toBe("mxc://banner");
    });

    it("returns null when banner_url is undefined", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test", avatar_url: null });
      const result = await api.getBannerUrl();
      expect(result).toBeNull();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getBannerUrl()).rejects.toThrow("no active session");
    });
  });

  describe("getUserProfile", () => {
    it("returns full UserProfile with all fields", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({
        displayname: "Test User",
        avatar_url: "mxc://avatar",
        banner_url: "mxc://banner",
      });
      const result = await api.getUserProfile("@user:echo.litteris.online");
      expect(result).toEqual({
        displayName: "Test User",
        avatarUrl: "mxc://avatar",
        bannerUrl: "mxc://banner",
        bio: null,
        role: null,
      });
    });

    it("handles missing optional fields gracefully", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({});
      const result = await api.getUserProfile("@user:echo.litteris.online");
      expect(result).toEqual({
        displayName: null,
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        role: null,
      });
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getUserProfile("@user:echo.litteris.online")).rejects.toThrow("no active session");
    });
  });

  describe("getUserBanner", () => {
    it("returns banner URL from DM room state event", async () => {
      const mockRoom = {
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: {
          getStateEvents: vi.fn().mockReturnValue([{ getContent: () => ({ url: "mxc://banner" }) }]),
        },
        roomId: "!dm:echo.litteris.online",
      };
      fakeClient.getRooms = vi.fn().mockReturnValue([mockRoom]);
      fakeClient.getRoom = vi.fn().mockReturnValue(mockRoom);

      const result = await api.getUserBanner("@target:echo.litteris.online");
      expect(result).toBe("mxc://banner");
    });

    it("returns null when no DM room found", async () => {
      fakeClient.getRooms = vi.fn().mockReturnValue([]);
      const result = await api.getUserBanner("@target:echo.litteris.online");
      expect(result).toBeNull();
    });

    it("returns null when DM room has no banner event", async () => {
      const mockRoom = {
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: { getStateEvents: vi.fn().mockReturnValue([]) },
        roomId: "!dm:echo.litteris.online",
      };
      fakeClient.getRooms = vi.fn().mockReturnValue([mockRoom]);
      const result = await api.getUserBanner("@target:echo.litteris.online");
      expect(result).toBeNull();
    });

    it("returns null when banner URL is empty", async () => {
      const mockRoom = {
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: { getStateEvents: vi.fn().mockReturnValue([{ getContent: () => ({ url: "" }) }]) },
        roomId: "!dm:echo.litteris.online",
      };
      fakeClient.getRooms = vi.fn().mockReturnValue([mockRoom]);
      const result = await api.getUserBanner("@target:echo.litteris.online");
      expect(result).toBeNull();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getUserBanner("@target:echo.litteris.online")).rejects.toThrow("no active session");
    });
  });

  describe("setUserBanner", () => {
    it("sends state event to existing DM room", async () => {
      const mockRoom = {
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: { getStateEvents: vi.fn().mockReturnValue([{ getId: () => "$banner-event" }]) },
        roomId: "!dm:echo.litteris.online",
      };
      fakeClient.getRooms = vi.fn().mockReturnValue([mockRoom]);
      fakeClient.getRoom = vi.fn().mockReturnValue(mockRoom);
      fakeClient.sendStateEvent = vi.fn().mockResolvedValue({ event_id: "$new-banner" });
      fakeClient.redactEvent = vi.fn();

      await api.setUserBanner("@target:echo.litteris.online", "mxc://new-banner");

      expect(fakeClient.sendStateEvent).toHaveBeenCalledWith(
        "!dm:echo.litteris.online",
        "echo.user.banner",
        { url: "mxc://new-banner" },
      );
    });

    it("creates DM room if none exists", async () => {
      fakeClient.getRooms = vi.fn().mockReturnValue([]);
      fakeClient.createRoom = vi.fn().mockResolvedValue({ room_id: "!new-dm:echo.litteris.online" });
      const mockNewRoom = {
        roomId: "!new-dm:echo.litteris.online",
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: { getStateEvents: vi.fn().mockReturnValue([]) },
      };
      fakeClient.getRoom = vi.fn().mockReturnValue(mockNewRoom);
      fakeClient.sendStateEvent = vi.fn().mockResolvedValue({ event_id: "$new-banner" });

      await api.setUserBanner("@target:echo.litteris.online", "mxc://new-banner");

      expect(fakeClient.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({
          is_direct: true,
          invite: ["@target:echo.litteris.online"],
        }),
      );
    });

    it("redacts banner event when bannerUrl is null", async () => {
      const mockRoom = {
        getType: vi.fn().mockReturnValue("m.direct"),
        getJoinedMembers: vi.fn().mockReturnValue([{ userId: "@target:echo.litteris.online" }]),
        currentState: { getStateEvents: vi.fn().mockReturnValue([{ getId: () => "$banner-event" }]) },
        roomId: "!dm:echo.litteris.online",
      };
      fakeClient.getRooms = vi.fn().mockReturnValue([mockRoom]);
      fakeClient.getRoom = vi.fn().mockReturnValue(mockRoom);
      fakeClient.redactEvent = vi.fn().mockResolvedValue({ event_id: "$redact" });

      await api.setUserBanner("@target:echo.litteris.online", null);

      expect(fakeClient.redactEvent).toHaveBeenCalledWith("!dm:echo.litteris.online", "$banner-event");
    });

    it("does nothing when DM room not found and bannerUrl is null", async () => {
      fakeClient.getRooms = vi.fn().mockReturnValue([]);
      fakeClient.createRoom = vi.fn();
      await api.setUserBanner("@target:echo.litteris.online", null);
      expect(fakeClient.createRoom).not.toHaveBeenCalled();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.setUserBanner("@target:echo.litteris.online", "mxc://banner")).rejects.toThrow("no active session");
    });
  });

  describe("setClient", () => {
    it("updates internal client reference", async () => {
      const newClient = createFakeClient({ getUserId: vi.fn(() => "@new:echo.litteris.online") });
      api.setClient(newClient);
      // Verify by calling a method that uses the client
      newClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "New User" });
      const result = await api.getDisplayName();
      expect(result).toBe("New User");
    });
  });
});