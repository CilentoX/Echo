import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient, Preset, Visibility } from "matrix-js-sdk";
import type { Session } from "../types";
import { ECHO_HOMESERVER_URL } from "../sso";

// Mock the matrix-js-sdk
vi.mock("matrix-js-sdk", () => ({
  createClient: vi.fn(),
  Preset: { PrivateChat: "private_chat" },
  Visibility: { Private: "private" },
}));

import { AuthApi } from "./auth";

describe("AuthApi", () => {
  let mockClient: ReturnType<typeof vi.fn>;
  let mockClientFactory: ReturnType<typeof vi.fn>;
  let authApi: AuthApi;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      loginRequest: vi.fn(),
      getSsoLoginUrl: vi.fn(),
      logout: vi.fn(),
    };
    mockClientFactory = vi.fn(() => mockClient);
    authApi = new AuthApi(ECHO_HOMESERVER_URL, mockClientFactory);
  });

  describe("loginWithSsoToken", () => {
    it("exchanges loginToken for Session and restores session", async () => {
      const loginToken = "test-login-token";
      const mockSession: Session = {
        baseUrl: ECHO_HOMESERVER_URL,
        accessToken: "access-token-123",
        userId: "@user:echo.litteris.online",
        deviceId: "device-123",
        refreshToken: "refresh-token-123",
      };

      mockClient.loginRequest.mockResolvedValue({
        access_token: mockSession.accessToken,
        user_id: mockSession.userId,
        device_id: mockSession.deviceId,
        refresh_token: mockSession.refreshToken,
      });

      const result = await authApi.loginWithSsoToken(loginToken);

      expect(mockClient.loginRequest).toHaveBeenCalledWith({
        type: "m.login.token",
        token: loginToken,
      });
      expect(result).toEqual(mockSession);
      // Should have created a new credentialled client via factory
      expect(mockClientFactory).toHaveBeenCalledWith({
        baseUrl: mockSession.baseUrl,
        accessToken: mockSession.accessToken,
        userId: mockSession.userId,
        deviceId: mockSession.deviceId,
      });
    });

    it("throws when access_token or user_id missing", async () => {
      mockClient.loginRequest.mockResolvedValue({
        access_token: "only-token",
        // user_id missing
      });

      await expect(authApi.loginWithSsoToken("token")).rejects.toThrow(
        "matrix login failed: missing access_token or user_id"
      );
    });
  });

  describe("restoreSession", () => {
    it("creates credentialled client from session", () => {
      const session: Session = {
        baseUrl: ECHO_HOMESERVER_URL,
        accessToken: "access-token-123",
        userId: "@user:echo.litteris.online",
        deviceId: "device-123",
      };

      authApi.restoreSession(session);

      expect(mockClientFactory).toHaveBeenCalledWith({
        baseUrl: session.baseUrl,
        accessToken: session.accessToken,
        userId: session.userId,
        deviceId: session.deviceId,
      });
    });

    it("handles session without deviceId", () => {
      const session: Session = {
        baseUrl: ECHO_HOMESERVER_URL,
        accessToken: "access-token-123",
        userId: "@user:echo.litteris.online",
        deviceId: null,
      };

      authApi.restoreSession(session);

      expect(mockClientFactory).toHaveBeenCalledWith({
        baseUrl: session.baseUrl,
        accessToken: session.accessToken,
        userId: session.userId,
      });
    });
  });

  describe("getSsoLoginUrl", () => {
    it("builds SSO URL with default IDP", () => {
      mockClient.getSsoLoginUrl.mockReturnValue("https://echo.litteris.online/_matrix/client/v3/login/sso/redirect/oidc-google?redirectUrl=...");

      const url = authApi.getSsoLoginUrl("http://localhost:8765/callback");

      expect(mockClient.getSsoLoginUrl).toHaveBeenCalledWith("http://localhost:8765/callback");
      expect(url).toContain("oidc-google");
    });

    it("builds SSO URL with custom IDP", () => {
      mockClient.getSsoLoginUrl.mockReturnValue("https://echo.litteris.online/_matrix/client/v3/login/sso/redirect/custom-idp?redirectUrl=...");

      const url = authApi.getSsoLoginUrl("http://localhost:8765/callback", "custom-idp");

      expect(mockClient.getSsoLoginUrl).toHaveBeenCalledWith("http://localhost:8765/callback", "sso", "custom-idp");
    });
  });

  describe("logout", () => {
    it("calls client.logout and clears client after login", async () => {
      const mockSession: Session = {
        baseUrl: ECHO_HOMESERVER_URL,
        accessToken: "access-token-123",
        userId: "@user:echo.litteris.online",
        deviceId: "device-123",
      };

      mockClient.loginRequest.mockResolvedValue({
        access_token: mockSession.accessToken,
        user_id: mockSession.userId,
        device_id: mockSession.deviceId,
      });
      mockClient.logout.mockResolvedValue(undefined);

      await authApi.loginWithSsoToken("token");
      await authApi.logout();

      expect(mockClient.logout).toHaveBeenCalled();
      // Client should be cleared
      expect(authApi.getClient()).toBeNull();
    });

    it("handles logout when no client exists", async () => {
      // Create new API without calling restoreSession
      const freshApi = new AuthApi(ECHO_HOMESERVER_URL, mockClientFactory);
      await freshApi.logout();
      // Should not throw
      expect(freshApi.getClient()).toBeNull();
    });
  });
});