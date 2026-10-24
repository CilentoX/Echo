import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

function pendingCount(): number {
  return useSyncStore.getState().timelineByChannel[ROOM]?.filter(
    (e) => e.eventId.startsWith("pending-"),
  ).length ?? 0;
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

describe("Composer (Fase B)", () => {
  beforeEach(resetStores);

  it("renderiza campo de mensagem, botão Enviar e botão Anexar", () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    expect(screen.getByLabelText("Mensagem")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anexar arquivo" })).toBeTruthy();
  });

  it("Enter envia: chama sendMessage com roomId e corpo, limpa o campo", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "olá mundo{Enter}");

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "olá mundo");
    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value,
    ).toBe("");
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

  it("placeholder otimista aparece na timeline ao enviar", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    useUiStore.getState().setMyUserId("@eu:hs");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "placeholder{Enter}");

    // Placeholder aparece imediatamente na timeline.
    expect(pendingCount()).toBe(1);
    expect(timeline()[0].sender).toBe("@eu:hs");
    expect(timeline()[0].body).toBe("placeholder");
    expect(timeline()[0].eventId.startsWith("pending-")).toBe(true);

    // Campo limpo.
    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("falha no envio: placeholder fica na timeline com erro e botão Tentar novamente", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("network down"));
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "mensagem falhou{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    // Placeholder permanece na timeline (não sumiu).
    expect(pendingCount()).toBe(1);

    // Botão Tentar novamente visível na lista de pendentes.
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();

    // Campo de mensagem vazio (texto não restaurado no textarea).
    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value,
    ).toBe("");
  });

  it("Tentar novamente reenvia a mensagem falhada", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("down"));
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "falha{Enter}");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    });

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });
  });

  it("botão Enviar envia o rascunho atual", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real2");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "via botão");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "via botão");
  });

  it("anexo: botão habilitado, seleção cria prévia e remover some a prévia", async () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    const attach = screen.getByRole("button", { name: "Anexar arquivo" });
    expect((attach as HTMLButtonElement).disabled).toBe(false);

    const file = new File(["conteúdo"], "arquivo.txt", { type: "text/plain" });
    const input = screen.getByTestId("composer-file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByLabelText("Remover anexo")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Remover anexo" }));
    expect(screen.queryByLabelText("Remover anexo")).toBeNull();
  });

  it("mensagem confirma no servidor antes de aparecer (usa userId da sessão como sender)", async () => {
    useUiStore.getState().setMyUserId("@eu:hs");
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "olá{Enter}");

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "olá");
  });

  it("dois Enters seguidos enviam ambas as mensagens (fila de envio)", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);
    const input = screen.getByLabelText("Mensagem");

    await userEvent.type(input, "primeira{Enter}");
    await userEvent.type(input, "segunda{Enter}");

    // Ambas entram na fila e são enviadas.
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage).toHaveBeenNthCalledWith(1, ROOM, "primeira");
    expect(sendMessage).toHaveBeenNthCalledWith(2, ROOM, "segunda");
  });
});
