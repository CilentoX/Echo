import { describe, it, expect, vi, beforeEach } from "vitest";
import { EchoApi } from "./echoApi";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

const MOCK_BASE_URL = "https://echo.litteris.online";

describe("EchoApi.refreshSession", () => {
  let api: EchoApi;

  beforeEach(() => {
    vi.clearAllMocks();
    api = new EchoApi({
      baseUrl: MOCK_BASE_URL,
      accessToken: "test-access-token",
    });
  });

  describe("when refreshToken is available", () => {
    it("calls POST /auth/refresh with refreshToken and returns new Session", async () => {
      const mockRefreshToken = "rt-abc123";
      const mockNewSession = {
        baseUrl: MOCK_BASE_URL,
        apiBaseUrl: MOCK_BASE_URL,
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        deviceId: "device-123",
        expiresAt: Date.now() + 3600000,
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockNewSession,
      } as Response);

      const result = await api.refreshSession(mockRefreshToken);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toContain("/auth/refresh");
      expect(fetchCall[1]?.body).toContain("refreshToken");
      // The auth header should use the refreshToken passed to refreshSession
      expect(fetchCall[1]?.headers.get("Authorization")).toContain("Bearer");
      expect(result).toHaveProperty("accessToken", "new-access-token");
      expect(result).toHaveProperty("refreshToken", "new-refresh-token");
      expect(result).toHaveProperty("expiresAt");
    });

    it("throws when refresh response is not ok", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => "Invalid refresh token",
      } as Response);

      await expect(api.refreshSession("invalid-rt")).rejects.toThrow(
        "Refresh session failed",
      );
    });
  });

  describe("when refreshToken is empty", () => {
    it("throws when no refreshToken is provided", async () => {
      await expect(api.refreshSession("")).rejects.toThrow(
        "Refresh token is required",
      );
    });
  });
});
