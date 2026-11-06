import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AppNotInstalledModal from "@/components/modals/AppNotInstalledModal";
import { useAppLauncherStore } from "@/stores/appLauncherStore";
import { launchAppProtocol, handleProtocolLinkClick } from "@/lib/appLauncher";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

describe("AppLauncher and AppNotInstalledModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppLauncherStore.getState().closeAlert();
  });

  it("abre a URL via openUrl quando o aplicativo está instalado", async () => {
    vi.mocked(openUrl).mockResolvedValueOnce(undefined as never);

    await launchAppProtocol({
      appName: "Steam",
      protocolUrl: "steam://store/2073620",
      webUrl: "https://store.steampowered.com/app/2073620/",
    });

    expect(openUrl).toHaveBeenCalledWith("steam://store/2073620");
    expect(useAppLauncherStore.getState().isOpen).toBe(false);
  });

  it("abre o modal com mensagem e URL web quando openUrl falha", async () => {
    vi.mocked(openUrl).mockRejectedValueOnce(new Error("No application is associated"));

    await launchAppProtocol({
      appName: "Steam",
      protocolUrl: "steam://store/2073620",
      webUrl: "https://store.steampowered.com/app/2073620/",
    });

    expect(useAppLauncherStore.getState().isOpen).toBe(true);
    expect(useAppLauncherStore.getState().appName).toBe("Steam");
    expect(useAppLauncherStore.getState().webUrl).toBe("https://store.steampowered.com/app/2073620/");
  });

  it("renderiza o modal corretamente com os botões e informações da aplicação", () => {
    useAppLauncherStore.getState().openAlert({
      appName: "Steam",
      webUrl: "https://store.steampowered.com/app/2073620/",
      protocolUrl: "steam://store/2073620",
    });

    render(<AppNotInstalledModal />);

    expect(screen.getByText("Aplicativo não instalado")).toBeDefined();
    expect(screen.getByText(/Não foi possível iniciar o Steam/i)).toBeDefined();
    expect(screen.getByText("https://store.steampowered.com/app/2073620/")).toBeDefined();
    expect(screen.getByText("Acessar pelo Navegador")).toBeDefined();
    expect(screen.getByText("Copiar")).toBeDefined();
  });

  it("permite copiar o link web e fecha o modal ao clicar em Fechar", async () => {
    useAppLauncherStore.getState().openAlert({
      appName: "Spotify",
      webUrl: "https://open.spotify.com/track/123",
    });

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<AppNotInstalledModal />);

    const copyBtn = screen.getByText("Copiar");
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith("https://open.spotify.com/track/123");
      expect(screen.getByText("Copiado!")).toBeDefined();
    });

    const closeBtn = screen.getByText("Fechar");
    fireEvent.click(closeBtn);

    expect(useAppLauncherStore.getState().isOpen).toBe(false);
  });

  it("handleProtocolLinkClick detecta esquemas conhecidos e previne default", () => {
    const preventDefault = vi.fn();
    const handled = handleProtocolLinkClick("steam://run/2073620", { preventDefault });

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
  });

  it("handleProtocolLinkClick ignora links http e https comuns", () => {
    const preventDefault = vi.fn();
    const handled = handleProtocolLinkClick("https://google.com", { preventDefault });

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

