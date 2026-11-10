import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/updater", () => ({
  isTauri: vi.fn(() => false),
}));

import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/updater";
import ScreenShareModal from "@/features/voice/ScreenShareModal";

describe("ScreenShareModal (Seleção Nativa Própria de Telas e Janelas)", () => {
  it("renderiza o modal com abas de Telas e Janelas de Aplicativos no padrão Discord", () => {
    const handleClose = vi.fn();
    const handleStart = vi.fn();

    render(
      <ScreenShareModal
        open={true}
        onClose={handleClose}
        onStartShare={handleStart}
      />,
    );

    expect(screen.getByText("Compartilhar Sua Tela")).toBeTruthy();
    expect(screen.getByText("Telas Inteiras")).toBeTruthy();
    expect(screen.getByText("Janelas de Aplicativos")).toBeTruthy();
    expect(screen.getByText("Tela 1 (Principal)")).toBeTruthy();
  });

  it("permite alternar entre Telas Inteiras e Janelas de Aplicativos", () => {
    const handleClose = vi.fn();
    const handleStart = vi.fn();

    render(
      <ScreenShareModal
        open={true}
        onClose={handleClose}
        onStartShare={handleStart}
      />,
    );

    const windowsTab = screen.getByRole("button", { name: /Janelas de Aplicativos/i });
    fireEvent.click(windowsTab);

    expect(screen.getByText("Visual Studio Code")).toBeTruthy();
    expect(screen.getByText("Google Chrome")).toBeTruthy();
    expect(screen.getByText("OBS Studio")).toBeTruthy();
  });

  it("permite selecionar qualidade de transmissão (resolução e fps) e disparar transmissão", () => {
    const handleClose = vi.fn();
    const handleStart = vi.fn();

    render(
      <ScreenShareModal
        open={true}
        onClose={handleClose}
        onStartShare={handleStart}
      />,
    );

    // Troca para aba de janelas
    fireEvent.click(screen.getByRole("button", { name: /Janelas de Aplicativos/i }));

    // Seleciona a janela do VS Code
    fireEvent.click(screen.getByText("Visual Studio Code"));

    // Seleciona 720p
    fireEvent.click(screen.getByRole("button", { name: "720p" }));

    // Seleciona 30 FPS
    fireEvent.click(screen.getByRole("button", { name: "30 FPS" }));

    // Clica em "Transmitir ao Vivo"
    fireEvent.click(screen.getByRole("button", { name: /Transmitir ao Vivo/i }));

    expect(handleStart).toHaveBeenCalledWith({
      sourceId: "window-vscode",
      sourceName: "Visual Studio Code",
      sourceType: "window",
      resolution: "720p",
      fps: 30,
      shareAudio: true,
      qualityPreset: "auto",
      contentHint: "auto",
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it("chama onClose ao clicar em Cancelar", () => {
    const handleClose = vi.fn();
    const handleStart = vi.fn();

    render(
      <ScreenShareModal
        open={true}
        onClose={handleClose}
        onStartShare={handleStart}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(handleClose).toHaveBeenCalled();
    expect(handleStart).not.toHaveBeenCalled();
  });

  it("carrega e renderiza fontes nativas dinamicamente quando em ambiente Tauri", async () => {
    const handleClose = vi.fn();
    const handleStart = vi.fn();

    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === "get_desktop_sources") {
        return [
          {
            id: "screen:99",
            name: "Monitor Gamer 144Hz",
            type: "screen",
            subtitle: "Monitor Desktop Primário",
            resolution: "2560x1440",
          },
          {
            id: "window:1234",
            name: "Counter-Strike 2",
            type: "window",
            subtitle: "cs2.exe",
            resolution: "1920x1080",
          },
        ];
      }
      return null;
    });

    render(
      <ScreenShareModal
        open={true}
        onClose={handleClose}
        onStartShare={handleStart}
      />,
    );

    expect(await screen.findByText("Monitor Gamer 144Hz")).toBeTruthy();
    expect(screen.getAllByText("2560x1440").length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole("button", { name: /Janelas de Aplicativos/i }));
    expect(await screen.findByText("Counter-Strike 2")).toBeTruthy();
    expect(screen.getAllByText("cs2.exe").length).toBeGreaterThanOrEqual(1);
  });
});
