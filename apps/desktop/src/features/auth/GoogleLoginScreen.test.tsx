import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EchoApi } from "@/lib/api/echoApi";
import type { Session } from "@/lib/matrix/types";
import GoogleLoginScreen from "./GoogleLoginScreen";

vi.mock("@/lib/storage/keyring", () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));

const SESSION: Session = {
  baseUrl: "https://echo.litteris.online",
  accessToken: "syt-at-1",
  userId: "@nina:echo.litteris.online",
  deviceId: "DEV123",
};

function makeEchoApi(): EchoApi {
  return {
    baseUrl: "https://echo.litteris.online",
    accessToken: "",
    apiKey: undefined,
    request: async (init: RequestInit) => {
      if (init.method === "POST" && typeof init.body === "object") {
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
      }
      return new Response(null, { status: 200 });
    },
  } as unknown as EchoApi;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GoogleLoginScreen", () => {
  it("renderiza a logo Echo e o botão 'Entrar com Google'", () => {
    render(<GoogleLoginScreen service={makeEchoApi()} />);

    expect(screen.getByRole("heading", { name: "Echo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("clicar no botão dispara exchangeLoginToken e chama onSession", async () => {
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeEchoApi()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("enquanto carrega, o botão fica desabilitado mostrando 'Entrando...'", async () => {
    const api = makeEchoApi();
    // Mock exchangeLoginToken to resolve slowly
    vi.spyOn(api, "exchangeLoginToken").mockResolvedValueOnce(SESSION as any);

    render(<GoogleLoginScreen service={api} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    const loading = screen.getByRole("button", { name: /Entrando\.\.\./ });
    expect(loading.hasAttribute("disabled")).toBe(true);
  });

  it("sucesso → chama onSession com a Session e volta ao estado idle", async () => {
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeEchoApi()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("rejeição → mensagem de erro PT-BR + 'Tentar de novo' refaz o fluxo", async () => {
    const onSession = vi.fn();
    const api = makeEchoApi();
    vi.spyOn(api, "exchangeLoginToken").mockRejectedValueOnce(new Error("tempo esgotado"));

    render(<GoogleLoginScreen service={api} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Não foi possível concluir o login com o Google/,
    );

    vi.spyOn(api, "exchangeLoginToken").mockResolvedValueOnce(SESSION as any);
    await userEvent.click(screen.getByRole("button", { name: /Tentar de novo/ }));

    expect(onSession).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
  });
});