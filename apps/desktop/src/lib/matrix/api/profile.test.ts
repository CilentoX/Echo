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
    it("always returns null (banner not in Matrix profile)", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test", avatar_url: null, banner_url: "mxc://banner" });
      const result = await api.getBannerUrl();
      expect(result).toBeNull();
    });

    it("returns null when no client", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({ displayname: "Test", avatar_url: null });
      const result = await api.getBannerUrl();
      expect(result).toBeNull();
    });

    it("does not throw when no client (returns null)", async () => {
      api.setClient(null);
      const result = await api.getBannerUrl();
      expect(result).toBeNull();
    });
  });

  describe("getUserProfile", () => {
    it("returns full UserProfile with all fields from Matrix profile", async () => {
      fakeClient.getProfileInfo = vi.fn().mockResolvedValue({
        displayname: "Test User",
        avatar_url: "mxc://avatar",
        // banner_url não existe no perfil Matrix padrão
      });
      const result = await api.getUserProfile("@user:echo.litteris.online");
      expect(result).toEqual({
        displayName: "Test User",
        avatarUrl: "mxc://avatar",
        bannerUrl: null, // banner não vem do perfil Matrix padrão
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

  // getUserBanner e setUserBanner removidos - banner deve vir de fonte global (Appwrite/Database), não de DM rooms

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