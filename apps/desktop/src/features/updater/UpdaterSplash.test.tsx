import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import UpdaterSplash from "./UpdaterSplash";
import { useUpdateStore } from "@/stores/updateStore";
import * as updater from "@/lib/updater";

vi.mock("@/lib/updater", () => ({
  closeAppWindow: vi.fn(async () => {}),
  minimizeAppWindow: vi.fn(async () => {}),
  startDraggingAppWindow: vi.fn(async () => {}),
  isTauri: vi.fn(() => false),
}));

describe("UpdaterSplash — Splash compacta do Echo Updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useUpdateStore.getState().reset();
  });

  it("renderiza o logo, slogan e o status 'VERIFICANDO ATUALIZAÇÕES...' no boot", () => {
    useUpdateStore.getState().beginCheck();

    render(<UpdaterSplash />);

    // Logo Echo presente
    const logo = screen.getByAltText("Echo");
    expect(logo).toBeTruthy();

    // Status 'VERIFICANDO ATUALIZAÇÕES...' visível
    expect(screen.getByText("VERIFICANDO ATUALIZAÇÕES...")).toBeTruthy();
  });

  it("exibe o progresso de download formatado em pt-BR", () => {
    useUpdateStore.getState().beginDownload("0.2.0");
    useUpdateStore.getState().setProgress(65);

    render(<UpdaterSplash />);

    expect(screen.getByText("BAIXANDO ATUALIZAÇÃO (65%)...")).toBeTruthy();
  });

  it("exibe a versão quando sem porcentagem numérica", () => {
    useUpdateStore.getState().beginDownload("0.2.0");

    render(<UpdaterSplash />);

    expect(screen.getByText("BAIXANDO ATUALIZAÇÃO (0.2.0)...")).toBeTruthy();
  });

  it("exibe 'REINICIANDO O ECHO...' quando o update está pronto", () => {
    useUpdateStore.getState().markReady();

    render(<UpdaterSplash />);

    expect(screen.getByText("REINICIANDO O ECHO...")).toBeTruthy();
  });

  it("permite customStatus via prop ou store", () => {
    render(<UpdaterSplash customStatus="STATUS DE TESTE" />);

    expect(screen.getByText("STATUS DE TESTE")).toBeTruthy();
  });

  it("botão vermelho fecha o aplicativo", () => {
    render(<UpdaterSplash />);

    const closeBtn = screen.getByTitle("Fechar");
    fireEvent.click(closeBtn);

    expect(updater.closeAppWindow).toHaveBeenCalledTimes(1);
  });

  it("botão amarelo minimiza a janela", () => {
    render(<UpdaterSplash />);

    const minBtn = screen.getByTitle("Minimizar");
    fireEvent.click(minBtn);

    expect(updater.minimizeAppWindow).toHaveBeenCalledTimes(1);
  });
});
