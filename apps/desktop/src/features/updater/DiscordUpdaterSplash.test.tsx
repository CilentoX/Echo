import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import DiscordUpdaterSplash from "./DiscordUpdaterSplash";
import { useUpdateStore } from "@/stores/updateStore";
import * as updater from "@/lib/updater";

vi.mock("@/lib/updater", () => ({
  closeAppWindow: vi.fn(async () => {}),
  minimizeAppWindow: vi.fn(async () => {}),
  startDraggingAppWindow: vi.fn(async () => {}),
  isTauri: vi.fn(() => false),
}));

describe("DiscordUpdaterSplash — Splash compacta do Updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useUpdateStore.getState().reset();
  });

  it("renderiza o logo, slogan e o status 'CHECKING FOR UPDATES' no boot", () => {
    useUpdateStore.getState().beginCheck();

    render(<DiscordUpdaterSplash />);

    // Logo Echo presente
    const logo = screen.getByAltText("Echo");
    expect(logo).toBeTruthy();

    // Status 'CHECKING FOR UPDATES' visível
    expect(screen.getByText("CHECKING FOR UPDATES")).toBeTruthy();
  });

  it("exibe o progresso de download formatado estilo Discord", () => {
    useUpdateStore.getState().beginDownload("0.2.0");
    useUpdateStore.getState().setProgress(65);

    render(<DiscordUpdaterSplash />);

    expect(screen.getByText("DOWNLOADING UPDATE (65%)")).toBeTruthy();
  });

  it("exibe fallback 'DOWNLOADING UPDATE 1 OF 1' quando sem progresso numérico", () => {
    useUpdateStore.getState().beginDownload("0.2.0");

    render(<DiscordUpdaterSplash />);

    expect(screen.getByText("DOWNLOADING UPDATE (0.2.0)")).toBeTruthy();
  });

  it("exibe 'RESTARTING ECHO...' quando o update está pronto", () => {
    useUpdateStore.getState().markReady();

    render(<DiscordUpdaterSplash />);

    expect(screen.getByText("RESTARTING ECHO...")).toBeTruthy();
  });

  it("permite customStatus via prop ou store", () => {
    render(<DiscordUpdaterSplash customStatus="CUSTOM STATUS TEST" />);

    expect(screen.getByText("CUSTOM STATUS TEST")).toBeTruthy();
  });

  it("botão vermelho fecha o aplicativo", () => {
    render(<DiscordUpdaterSplash />);

    const closeBtn = screen.getByTitle("Fechar");
    fireEvent.click(closeBtn);

    expect(updater.closeAppWindow).toHaveBeenCalledTimes(1);
  });

  it("botão amarelo minimiza a janela", () => {
    render(<DiscordUpdaterSplash />);

    const minBtn = screen.getByTitle("Minimizar");
    fireEvent.click(minBtn);

    expect(updater.minimizeAppWindow).toHaveBeenCalledTimes(1);
  });
});

