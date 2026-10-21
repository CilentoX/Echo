import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Composer from "@/features/chat/Composer";
import type { NormalizedEvent } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";

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
}

describe("Composer", () => {
  beforeEach(resetStores);

  it("renderiza campo de mensagem, botão Enviar e botão Anexar", () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    expect(screen.getByLabelText("Mensagem")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Anexar arquivo" })).toBeTruthy();
  });

  it("Enter envia: placeholder pending-* entra na timeline e é trocado pelo evento real", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real1");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "olá mundo{Enter}");

    // O envio real foi chamado com roomId + corpo digitado.
    expect(sendMessage).toHaveBeenCalledWith(ROOM, "olá mundo");

    // O placeholder otimista existiu (R2); após resolver, resta só o evento real.
    await waitFor(() => {
      expect(timeline().map((e) => e.eventId)).toEqual(["$real1"]);
    });
    const [real] = timeline();
    expect(real.roomId).toBe(ROOM);
    expect(real.body).toBe("olá mundo");

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

  it("falha no envio faz rollback: placeholder removido, texto restaurado e erro visível", async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error("network down"));
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "mensagem perdida{Enter}");

    await waitFor(() => {
      expect(timeline()).toHaveLength(0); // removePending fez o rollback
    });
    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).value,
    ).toBe("mensagem perdida");
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("botão Enviar envia o rascunho atual", async () => {
    const sendMessage = vi.fn().mockResolvedValue("$real2");
    render(<Composer roomId={ROOM} sendMessage={sendMessage} channelName="geral" />);

    await userEvent.type(screen.getByLabelText("Mensagem"), "via botão");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));

    expect(sendMessage).toHaveBeenCalledWith(ROOM, "via botão");
    await waitFor(() => {
      expect(timeline().map((e) => e.eventId)).toEqual(["$real2"]);
    });
  });

  it("Anexar abre prévia CSS-only e o X remove", async () => {
    render(<Composer roomId={ROOM} sendMessage={vi.fn()} channelName="geral" />);

    await userEvent.click(screen.getByRole("button", { name: "Anexar arquivo" }));
    expect(screen.getByText("foto-do-chat.png")).toBeTruthy();
    expect(screen.getByLabelText("Remover anexo")).toBeTruthy();

    await userEvent.click(screen.getByLabelText("Remover anexo"));
    expect(screen.queryByText("foto-do-chat.png")).toBeNull();
  });
});
