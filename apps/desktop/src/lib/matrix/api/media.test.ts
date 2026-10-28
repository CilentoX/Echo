import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { MatrixClientLike } from "../types";
import { MediaApi } from "./media";

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

describe("MediaApi", () => {
  let fakeClient: MatrixClientLike;
  let api: MediaApi;

  beforeEach(() => {
    fakeClient = createFakeClient();
    const clientFactory = vi.fn(() => fakeClient);
    api = new MediaApi(fakeClient, clientFactory);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadMedia", () => {
    it("uploads file and returns mxc:// URI", async () => {
      const mockFile = new File(["test content"], "test.png", { type: "image/png" });
      fakeClient.uploadContent = vi.fn().mockResolvedValue({ content_uri: "mxc://echo.litteris.online/abc123" });

      const result = await api.uploadMedia(mockFile);

      expect(result).toBe("mxc://echo.litteris.online/abc123");
      expect(fakeClient.uploadContent).toHaveBeenCalledWith(mockFile, expect.objectContaining({
        name: "test.png",
        type: "image/png",
      }));
    });

    it("throws when no client is set", async () => {
      api.setClient(null);
      const mockFile = new File(["test"], "test.png", { type: "image/png" });
      await expect(api.uploadMedia(mockFile)).rejects.toThrow("no active session");
    });
  });

  describe("mxcUrlToHttp", () => {
    it("converts mxc:// URL to HTTP with all parameters", () => {
      fakeClient.mxcUrlToHttp = vi.fn().mockReturnValue("https://echo.litteris.online/_matrix/media/v3/download/echo.litteris.online/abc123");
      const result = api.mxcUrlToHttp("mxc://echo.litteris.online/abc123", 800, 600, "crop", true, true, true);
      expect(result).toBe("https://echo.litteris.online/_matrix/media/v3/download/echo.litteris.online/abc123");
      expect(fakeClient.mxcUrlToHttp).toHaveBeenCalledWith("mxc://echo.litteris.online/abc123", 800, 600, "crop", true, true, true);
    });

    it("returns null when client returns null", () => {
      fakeClient.mxcUrlToHttp = vi.fn().mockReturnValue(null);
      const result = api.mxcUrlToHttp("mxc://invalid");
      expect(result).toBeNull();
    });

    it("throws when no client is set", () => {
      api.setClient(null);
      expect(() => api.mxcUrlToHttp("mxc://test")).toThrow("no active session");
    });
  });

  describe("setClient", () => {
    it("updates internal client reference", () => {
      const newClient = createFakeClient({
        getBaseUrl: vi.fn(() => "https://new.echo.litteris.online"),
        mxcUrlToHttp: vi.fn().mockReturnValue("https://new.echo.litteris.online/_matrix/media/v3/download/echo.litteris.online/abc123"),
      });
      api.setClient(newClient);
      const result = api.mxcUrlToHttp("mxc://test");
      expect(result).toBe("https://new.echo.litteris.online/_matrix/media/v3/download/echo.litteris.online/abc123");
    });
  });
});