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
  accessToken: "syt-at-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
};

/** EchoApi double: só os métodos que o runSsoLogin consome. */
function makeEchoApi(): EchoApi {
  return {
    baseUrl: "https://echo.litteris.online",
    accessToken: "",
    apiKey: undefined,
    request: async (init: any) => {
      // Mock the fetch call - for exchangeLoginToken we test the flow differently
      if (init.method === "POST" && init.path === "/auth/exchange-login-token") {
        const body = init.body as { loginToken: string };
        if (body.loginToken === "LT-1") {
          return new Response(JSON.stringify({
            session: {
              baseUrl: "https://echo.litteris.online",
              accessToken: "syt-at-1",
              userId: "@nina:echo.litteris.online",
              deviceId: "DEV123",
            },
            user: {
              id: "@nina:echo.litteris.online",
              displayName: "Nina",
              avatarUrl: null,
            },
          }), { status: 200 });
        }
        return new Response("Invalid token", { status: 400 });
      }
      return new Response(null, { status: 200 });
    },
  } as unknown as EchoApi;
}

beforeEach(() => {
  mockedInvoke.mockReset();
  mockedOpenUrl.mockReset();
});

describe("runSsoLogin", () => {
  it("fluxo completo: listener → URL SSO → browser → token → exchangeLoginToken", async () {
    mockedInvoke
      .mockResolvedValueOnce(49152) // begin_sso_listener -> porta
      .mockResolvedValueOnce("LT-1"); // finish_sso_listener -> loginToken
    const echoApi = makeEchoApi();

    const session = await runSsoLogin(echoApi);

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "begin_sso_listener");
    expect(echoApi.getSsoLoginUrl).toHaveBeenCalledWith(
      "http://127.0.0.1:49152/callback",
      "oidc-google",
    );
    expect(mockedOpenUrl).toHaveBeenCalledWith(
      "https://echo.litteris.online/auth/sso-redirect?redirectUrl=http%3A%2F%2F127.0.0.1%3A49152%2Fcallback&idpId=oidc-google",
    );
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "finish_sso_listener", { port: 49152 });
    expect(echoApi.exchangeLoginToken).toHaveBeenCalledWith("LT-1");
    expect(session).toEqual(SESSION);
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
    expect(echoApi.exchangeLoginToken).not.toHaveBeenCalled();
  });

  it("falha no exchangeLoginToken → SsoLoginError com code 'login'", async () => {
    mockedInvoke.mockResolvedValueOnce(49154).mockResolvedValueOnce("LT-2");
    const echoApi = makeEchoApi();
    (echoApi.exchangeLoginToken as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
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