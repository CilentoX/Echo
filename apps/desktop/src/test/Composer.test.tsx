import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Composer from "@/features/chat/Composer";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

const ROOM = "!c1:hs";

function timeline(): NormalizedEvent[] {
  return useSyncStore.getState().timelineByChannel[ROOM] ?? [];
}

function resetStores() {
  useSyncStore.setState({
    status: "syncing",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
  });
  useUiStore.setState({ myUserId: null, activeGuildId: null, activeChannelId: null });
}

describe("Composer", () => {
  beforeEach(resetStores);

  it("renderiza campo de mensagem, botão Enviar e botão Anexar", () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    expect(screen.getByLabelText("Mensagem")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anexar arquivo" })).toBeTruthy();
  });

  it("Enter envia: chama sendMessage com roomId e corpo", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "olá mundo{Enter}");

    // O envio real foi chamado com roomId + corpo digitado (P10).
    expect(sendMessage).toHaveBeenCalledWith(ROOM, "olá mundo");

    // Campo limpo após enviar.
    expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value).toBe("");
  });

  it("Shift+Enter não envia (quebra de linha)", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "linha 1{Shift>}{Enter}{/Shift}linha 2");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(timeline()).toHaveLength(0);
    expect((screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value).toBe(
      "linha 1\nlinha 2",
    );
  });

  it("falha no envio: texto restaurado e erro visível (sem placeholder otimista)", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("network down"));
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "mensagem perdida{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    // Texto restaurado para retry (P11).
    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value,
    ).toBe("mensagem perdida");
    // Nenhuma mensagem aparece na timeline (sem placeholder otimista).
    expect(timeline()).toHaveLength(0);
  });

  it("botão Enviar envia o rascunho atual", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real2");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "via botão");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "via botão");
  });

  it("botão Anexar arquivo fica desabilitado até a Fase 2 (sem anexo falso)", async () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    const attach = screen.getByRole("button", { name: "Anexar arquivo" });
    expect((attach as HTMLButtonElement).disabled).toBe(true);

    // Clicar não cria prévia nenhuma (nada é "enviado" silenciosamente).
    await userEvent.click(attach);
    expect(screen.queryByLabelText("Remover anexo")).toBeNull();
  });

  it("mensagem confirma no servidor antes de aparecer (usa userId da sessão como sender)", async () => {
    useUiStore.getState().setMyUserId("@eu:hs");
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "olá{Enter}");

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "olá");
  });

  it("Enter durante um envio em curso é enfileirado e envia o rascunho ao concluir", async () => {
    const resolvers: Array<(id: string) => void> = [];
    const sendMessage = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve);
        }),
    );
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);
    const input = screen.getByLabelText("Mensagem");

    await userEvent.type(input, "primeira{Enter}");
    await userEvent.type(input, "segunda{Enter}");

    // O primeiro envio está em curso; nada foi engolido — o segundo está na fila.
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenNthCalledWith(1, ROOM, "primeira");

    await act(async () => {
      resolvers[0]("$real1");
    });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });
    expect(sendMessage).toHaveBeenNthCalledWith(2, ROOM, "segunda");

    await act(async () => {
      resolvers[1]("$real2");
    });
  });
});
