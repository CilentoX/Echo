import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MatrixClientLike, UserProfile } from "../types";
import { ProfileApi } from "./profile";

// Mock do módulo PostgreSQL profiles (caminho relativo usado no ProfileApi)
vi.mock("../../postgres/profiles", () => ({
  getGlobalProfile: vi.fn(),
  upsertGlobalProfile: vi.fn(),
  patchGlobalProfile: vi.fn(),
  initUserProfilesTable: vi.fn().mockResolvedValue(undefined),
}));

const { getGlobalProfile, upsertGlobalProfile, patchGlobalProfile } = await import("../../postgres/profiles");
const mockGetGlobalProfile = vi.mocked(getGlobalProfile);
const mockUpsertGlobalProfile = vi.mocked(upsertGlobalProfile);
const mockPatchGlobalProfile = vi.mocked(patchGlobalProfile);

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
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getDisplayName", () => {
    it("returns displayname from fetch when userId provided", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "Test User", avatar_url: "mxc://avatar" }),
      } as Response);

      const result = await api.getDisplayName("@other:echo.litteris.online");
      expect(result).toBe("Test User");
      
      expect(global.fetch).toHaveBeenCalledWith(
        "https://echo.litteris.online/_matrix/client/v3/profile/%40other%3Aecho.litteris.online",
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer fake-token" }) })
      );
      
      mockFetch.mockRestore();
    });

    it("uses client's userId when userId not provided", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "Me", avatar_url: null }),
      } as Response);

      const result = await api.getDisplayName();
      expect(result).toBe("Me");
      
      expect(global.fetch).toHaveBeenCalledWith(
        "https://echo.litteris.online/_matrix/client/v3/profile/%40me%3Aecho.litteris.online",
        expect.any(Object)
      );
      
      mockFetch.mockRestore();
    });

    it("returns null when displayname is undefined", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ avatar_url: "mxc://avatar" }),
      } as Response);

      const result = await api.getDisplayName();
      expect(result).toBeNull();
      mockFetch.mockRestore();
    });

    it("returns null when fetch fails", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await api.getDisplayName();
      expect(result).toBeNull();
      mockFetch.mockRestore();
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
    it("returns avatar_url from fetch when userId provided", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "Test", avatar_url: "mxc://avatar" }),
      } as Response);

      const result = await api.getAvatarUrl("@other:echo.litteris.online");
      expect(result).toBe("mxc://avatar");
      mockFetch.mockRestore();
    });

    it("uses client's userId when userId not provided", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "Me", avatar_url: "mxc://my-avatar" }),
      } as Response);

      const result = await api.getAvatarUrl();
      expect(result).toBe("mxc://my-avatar");
      mockFetch.mockRestore();
    });

    it("returns null when avatar_url is undefined", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "Test" }),
      } as Response);

      const result = await api.getAvatarUrl();
      expect(result).toBeNull();
      mockFetch.mockRestore();
    });

    it("returns null when fetch fails", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      const result = await api.getAvatarUrl();
      expect(result).toBeNull();
      mockFetch.mockRestore();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getAvatarUrl()).rejects.toThrow("no active session");
    });
  });

  describe("getBannerUrl", () => {
    it("always returns null (banner not in Matrix profile)", async () => {
      const result = await api.getBannerUrl();
      expect(result).toBeNull();
    });

    it("returns null when no client", async () => {
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
    it("returns full UserProfile with Matrix profile fields, banner/bio from PostgreSQL", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          displayname: "Test User",
          avatar_url: "mxc://avatar",
        }),
      } as Response);

      mockGetGlobalProfile.mockResolvedValue({
        user_id: "@user:echo.litteris.online",
        avatar_url: "https://appwrite.example.com/avatar.png",
        banner_url: "https://appwrite.example.com/banner.png",
        bio: "Hello world",
        links: [{ label: "GitHub", url: "https://github.com/test" }],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      });

      const result = await api.getUserProfile("@user:echo.litteris.online");

      expect(result).toEqual({
        displayName: "Test User",
        avatarUrl: "mxc://avatar", // avatar do Matrix
        bannerUrl: "https://appwrite.example.com/banner.png", // banner do PostgreSQL (campo banner_url)
        bio: "Hello world", // bio do PostgreSQL
        role: null, // roles são por guilda
      });
      expect(mockGetGlobalProfile).toHaveBeenCalledWith("@user:echo.litteris.online");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://echo.litteris.online/_matrix/client/v3/profile/%40user%3Aecho.litteris.online",
        expect.any(Object)
      );
      (global.fetch as vi.Mock).mockRestore();
    });

    it("handles missing global profile gracefully", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          displayname: "Test User",
          avatar_url: "mxc://avatar",
        }),
      } as Response);

      mockGetGlobalProfile.mockResolvedValue(null);

      const result = await api.getUserProfile("@user:echo.litteris.online");

      expect(result).toEqual({
        displayName: "Test User",
        avatarUrl: "mxc://avatar",
        bannerUrl: null,
        bio: null,
        role: null,
      });
      (global.fetch as vi.Mock).mockRestore();
    });

    it("handles missing Matrix profile fields gracefully", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      mockGetGlobalProfile.mockResolvedValue(null);

      const result = await api.getUserProfile("@user:echo.litteris.online");

      expect(result).toEqual({
        displayName: null,
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        role: null,
      });
      (global.fetch as vi.Mock).mockRestore();
    });

    it("throws when fetch fails", async () => {
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      await expect(api.getUserProfile("@user:echo.litteris.online")).rejects.toThrow("Failed to fetch profile: 401");
      (global.fetch as vi.Mock).mockRestore();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getUserProfile("@user:echo.litteris.online")).rejects.toThrow("no active session");
    });
  });

  describe("getGlobalProfile", () => {
    it("returns global profile from PostgreSQL", async () => {
      const mockProfile = {
        user_id: "@user:echo.litteris.online",
        avatar_url: "https://appwrite.example.com/avatar.png",
        banner_url: "https://appwrite.example.com/banner.png",
        bio: "Global bio",
        links: [],
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      };
      mockGetGlobalProfile.mockResolvedValue(mockProfile);

      const result = await api.getGlobalProfile("@user:echo.litteris.online");

      expect(result).toEqual(mockProfile);
      expect(mockGetGlobalProfile).toHaveBeenCalledWith("@user:echo.litteris.online", "fake-token");
    });

    it("returns null when global profile not found", async () => {
      mockGetGlobalProfile.mockResolvedValue(null);

      const result = await api.getGlobalProfile("@user:echo.litteris.online");

      expect(result).toBeNull();
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.getGlobalProfile("@user:echo.litteris.online")).rejects.toThrow("no active session");
    });
  });

  describe("updateGlobalProfile", () => {
    it("calls upsertGlobalProfile with userId and data", async () => {
      mockUpsertGlobalProfile.mockResolvedValue(undefined);
      
      await api.updateGlobalProfile("@user:echo.litteris.online", {
        avatarUrl: "https://example.com/avatar.png",
        bannerUrl: "https://example.com/banner.png",
        bio: "New bio",
        links: [{ label: "GitHub", url: "https://github.com/test" }],
      });

      expect(mockUpsertGlobalProfile).toHaveBeenCalledWith({
        userId: "@user:echo.litteris.online",
        avatarUrl: "https://example.com/avatar.png",
        bannerUrl: "https://example.com/banner.png",
        bio: "New bio",
        links: [{ label: "GitHub", url: "https://github.com/test" }],
      }, "fake-token");
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.updateGlobalProfile("@user:echo.litteris.online", { bio: "test" })).rejects.toThrow("no active session");
    });
  });

  describe("patchGlobalProfile", () => {
    it("calls patchGlobalProfile with userId and partial data", async () => {
      mockPatchGlobalProfile.mockResolvedValue(undefined);
      
      await api.patchGlobalProfile("@user:echo.litteris.online", {
        bio: "Updated bio",
      });

      expect(mockPatchGlobalProfile).toHaveBeenCalledWith("@user:echo.litteris.online", {
        bio: "Updated bio",
      }, "fake-token");
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      await expect(api.patchGlobalProfile("@user:echo.litteris.online", { bio: "test" })).rejects.toThrow("no active session");
    });
  });

  describe("setClient", () => {
    it("updates internal client reference", async () => {
      const newClient = createFakeClient({ getUserId: vi.fn(() => "@new:echo.litteris.online") });
      api.setClient(newClient);
      // Verify by calling a method that uses the client
      const mockFetch = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ displayname: "New User" }),
      } as Response);

      const result = await api.getDisplayName();
      expect(result).toBe("New User");
      mockFetch.mockRestore();
    });
  });
});