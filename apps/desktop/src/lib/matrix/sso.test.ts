import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { EchoApi } from "@/lib/api/echoApi";
import { ECHO_HOMESERVER_URL, runSsoLogin, SsoLoginError } from "./sso";
import type { Session } from "./types";

const mockedInvoke = vi.mocked(invoke);
const mockedOpenUrl = vi.mocked(openUrl);

const SESSION: Session = {
  baseUrl: "https://echo.litteris.online",
  apiBaseUrl: "https://echo.litteris.online",
  accessToken: "syt-at-1",
  refreshToken: "rt-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
  expiresAt: Date.now() + 3600 * 1000,
};

/** EchoApi double: só os métodos que o runSsoLogin consome. */
function makeEchoApi(): EchoApi {
  return {
    baseUrl: "https://echo.litteris.online",
    accessToken: "",
    apiKey: undefined,
    request: async (init: any) => {
      // Mock getSsoLoginUrl call
      if (init.method === "GET" && init.path.startsWith("/auth/google")) {
        return new Response(JSON.stringify({
          loginUrl: "https://echo.litteris.online/_synapse/client/oidc/redirect/google?redirectUrl=...",
        }), { status: 200 });
      }
      // Mock exchangeCodeForTokens call
      if (init.method === "POST" && init.path === "/auth/token") {
        const body = init.body as { code: string };
        if (body.code === "AUTH_CODE_1") {
          return new Response(JSON.stringify({
            accessToken: "syt-at-1",
            refreshToken: "rt-1",
            deviceId: "DEV123",
            userId: "@nina:echo.litteris.online",
          }), { status: 200 });
        }
        return new Response("Invalid code", { status: 400 });
      }
      return new Response(null, { status: 200 });
    },
    getSsoLoginUrl: vi.fn(async (redirectUrl: string, _idpId?: string) => {
      return `https://echo.litteris.online/_synapse/client/oidc/redirect/google?redirectUrl=${encodeURIComponent(redirectUrl)}`;
    }),
    exchangeCodeForTokens: vi.fn(async (code: string) => {
      if (code === "AUTH_CODE_1") {
        return {
          baseUrl: "https://echo.litteris.online",
          apiBaseUrl: "https://echo.litteris.online",
          accessToken: "syt-at-1",
          refreshToken: "rt-1",
          deviceId: "DEV123",
          userId: "@nina:echo.litteris.online",
          expiresAt: Date.now() + 3600 * 1000,
        };
      }
      throw new Error("Invalid code");
    }),
  } as unknown as EchoApi;
}

beforeEach(() => {
  mockedInvoke.mockReset();
  mockedOpenUrl.mockReset();
});

describe("runSsoLogin", () => {
  it("fluxo completo: listener → URL SSO → browser → code → exchangeCodeForTokens", async () => {
    mockedInvoke
      .mockResolvedValueOnce(49152) // begin_sso_listener -> porta
      .mockResolvedValueOnce("AUTH_CODE_1"); // finish_sso_listener -> authorization code
    const echoApi = makeEchoApi();

    const session = await runSsoLogin(echoApi);

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "begin_sso_listener");
    expect(echoApi.getSsoLoginUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/callback",
      "oidc-google",
    );
    expect(mockedOpenUrl).toHaveBeenCalledWith(
      expect.stringContaining("https://echo.litteris.online/_synapse/client/oidc/redirect/google"),
    );
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "finish_sso_listener", { port: 49152 });
    expect(echoApi.exchangeCodeForTokens).toHaveBeenCalledWith("AUTH_CODE_1");
    expect(session).toEqual({
      ...SESSION,
      expiresAt: expect.any(Number),
    });
  });

  it("rejeição do finish_sso_listener (timeout) → SsoLoginError tipado, sem tentar login", async () => {
    mockedInvoke
      .mockResolvedValueOnce(49153)
      .mockRejectedValueOnce(new Error("tempo esgotado aguardando o login SSO"));
    const echoApi = makeEchoApi();

    const err = await runSsoLogin(echoApi).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SsoLoginError);
    expect((err as SsoLoginError).code).toBe("listener");
    expect((err as SsoLoginError).message).toContain("tempo esgotado");
    expect(echoApi.exchangeCodeForTokens).not.toHaveBeenCalled();
  });

  it("falha no exchangeCodeForTokens → SsoLoginError com code 'login'", async () => {
    mockedInvoke.mockResolvedValueOnce(49154).mockResolvedValueOnce("AUTH_CODE_2");
    const echoApi = makeEchoApi();
    (echoApi.exchangeCodeForTokens as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("echo api login failed"),
    );

    const err = await runSsoLogin(echoApi).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(SsoLoginError);
    expect((err as SsoLoginError).code).toBe("login");
  });

  it("expõe o homeserver da rede Eco como constante única", () => {
    expect(ECHO_HOMESERVER_URL).toBe("https://echo.litteris.online");
  });
});