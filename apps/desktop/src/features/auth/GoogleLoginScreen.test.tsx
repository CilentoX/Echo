import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MatrixService } from "@/lib/matrix/service";
import { runSsoLogin } from "@/lib/matrix/sso";
import type { Session } from "@/lib/matrix/types";
import GoogleLoginScreen from "./GoogleLoginScreen";

vi.mock("@/lib/matrix/sso", () => ({
  runSsoLogin: vi.fn(),
  ECO_HOMESERVER_URL: "https://eco.test",
}));

const mockedRunSsoLogin = vi.mocked(runSsoLogin);

const SESSION: Session = {
  baseUrl: "https://eco.litteris.online",
  accessToken: "syt-at-1",
  userId: "@nina:eco.litteris.online",
  deviceId: "DEV123",
};

function makeService(): MatrixService {
  return {
    getSsoLoginUrl: vi.fn(),
    loginWithSsoToken: vi.fn(),
  } as unknown as MatrixService;
}

beforeEach(() => {
  mockedRunSsoLogin.mockReset();
});

describe("GoogleLoginScreen", () => {
  it("renderiza a logo Eco e o botão 'Entrar com Google'", () => {
    render(<GoogleLoginScreen service={makeService()} />);

    expect(screen.getByRole("heading", { name: "Eco" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
  });

  it("clicar no botão dispara runSsoLogin com o service", async () => {
    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);
    const service = makeService();
    render(<GoogleLoginScreen service={service} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    expect(mockedRunSsoLogin).toHaveBeenCalledWith(service);
  });

  it("enquanto carrega, o botão fica desabilitado mostrando 'Entrando...'", async () => {
    mockedRunSsoLogin.mockReturnValueOnce(new Promise(() => {})); // pendente
    render(<GoogleLoginScreen service={makeService()} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    const loading = screen.getByRole("button", { name: /Entrando\.\.\./ });
    expect(loading.hasAttribute("disabled")).toBe(true);
  });

  it("sucesso → chama onSession com a Session e volta ao estado idle", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeService()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
    // LOG temporário do userId (validação manual da Task 6)
    expect(logSpy).toHaveBeenCalledWith("[eco] Sessão iniciada: @nina:eco.litteris.online");
    expect(screen.getByRole("button", { name: /Entrar com Google/ })).toBeTruthy();
    logSpy.mockRestore();
  });

  it("rejeição → mensagem de erro PT-BR + 'Tentar de novo' refaz o fluxo", async () => {
    mockedRunSsoLogin.mockRejectedValueOnce(new Error("tempo esgotado"));
    const onSession = vi.fn();
    render(<GoogleLoginScreen service={makeService()} onSession={onSession} />);

    await userEvent.click(screen.getByRole("button", { name: /Entrar com Google/ }));
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /Não foi possível concluir o login com o Google/,
    );

    mockedRunSsoLogin.mockResolvedValueOnce(SESSION);
    await userEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(mockedRunSsoLogin).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(onSession).toHaveBeenCalledWith(SESSION));
  });
});
