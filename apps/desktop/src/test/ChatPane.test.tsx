import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChannelSummary, NormalizedEvent } from "@/lib/matrix/types";
import ChatPane from "@/features/chat/ChatPane";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

const ROOM = "!c1:hs";

const CHANNEL: ChannelSummary = { channelId: ROOM, name: "geral", unreadCount: 0 };

function ev(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: "e1",
    roomId: ROOM,
    sender: "@lucas:hs",
    body: "Fase 1: fundação pronta.",
    originServerTs: 1_700_000_000_000,
    ...overrides,
  };
}

function resetStores() {
  useSyncStore.setState({
    status: "syncing",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
  });
  useUiStore.setState({ activeGuildId: "!g1:hs", activeChannelId: ROOM });
}

function setTimeline(events: NormalizedEvent[]) {
  useSyncStore.setState({
    channelsByGuild: { "!g1:hs": [CHANNEL] },
    timelineByChannel: { [ROOM]: events },
  });
}

describe("ChatPane", () => {
  beforeEach(resetStores);

  it("renderiza as mensagens da timeline do canal ativo", () => {
    setTimeline([ev(), ev({ eventId: "e2", body: "segunda mensagem" })]);
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getByText("Fase 1: fundação pronta.")).toBeTruthy();
    expect(screen.getByText("segunda mensagem")).toBeTruthy();
  });

  it("agrupa mensagens consecutivas do mesmo autor: nome aparece uma vez", () => {
    setTimeline([
      ev({ eventId: "e1", originServerTs: 1_700_000_000_000 }),
      ev({ eventId: "e2", body: "continuando", originServerTs: 1_700_000_060_000 }),
    ]);
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getAllByText("lucas")).toHaveLength(1);
    expect(screen.getByText("continuando")).toBeTruthy();
  });

  it("evento pendente (pending-*) é marcado como Enviando…", () => {
    setTimeline([ev({ eventId: "pending-1", body: "otimista" })]);
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getByText("Enviando…")).toBeTruthy();
    expect(screen.getByText("otimista")).toBeTruthy();
  });

  it("mensagem do bot recebe o selo BOT em destaque teal", () => {
    setTimeline([ev({ sender: "@eco:eco" })]);
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getByText("BOT")).toBeTruthy();
  });

  it("mostra o indicador de digitação com o nome (typingUsers from store)", () => {
    useUiStore.setState({ typingUsers: { "!c1:hs": ["Lucas"] } });
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getByText("Lucas está digitando…")).toBeTruthy();
  });

  it("sem typingUsers não mostra indicador", () => {
    useUiStore.setState({ typingUsers: {} });
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.queryByText(/está digitando/)).toBeNull();
  });

  it("clicar em uma reação envia m.reaction via MatrixService (P12)", async () => {
    setTimeline([ev({ eventId: "e1" })]);
    useSyncStore.setState({
      reactionsByEvent: { e1: [{ eventId: "r1", roomId: ROOM, sender: "@outro:hs", targetEventId: "e1", emoji: "👍" }] },
    });
    useUiStore.setState({ myUserId: "@minha:hs" });
    const sendReactionSpy = vi.spyOn(matrixService, "sendReaction").mockResolvedValue("r2");
    render(<ChatPane sendMessage={vi.fn()} />);

    const chip = screen.getByRole("button", { name: /👍/ });
    expect(chip.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(chip);
    expect(sendReactionSpy).toHaveBeenCalledWith(ROOM, "e1", "👍");
  });

  it("chip de tópico aparece quando o evento tem respostas em thread", () => {
    setTimeline([ev({ eventId: "e1" })]);
    render(<ChatPane sendMessage={vi.fn()} threadReplies={{ e1: 3 }} />);

    expect(screen.getByRole("button", { name: "Abrir tópico" }).textContent).toContain("3");
  });

  it("corpo com 300 chars sem espaços usa quebra de palavra (sem overflow)", () => {
    const longBody = "a".repeat(300);
    setTimeline([ev({ body: longBody })]);
    render(<ChatPane sendMessage={vi.fn()} />);

    const paragraph = screen.getByText(longBody);
    expect(paragraph.className).toContain("break-words");
  });

  it("sem canal ativo pede para escolher um canal e não mostra composer", () => {
    useUiStore.setState({ activeGuildId: null, activeChannelId: null });
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(screen.getByText("Escolha um canal para começar a conversar.")).toBeTruthy();
    expect(screen.queryByLabelText("Mensagem")).toBeNull();
  });

  it("usa o nome do canal no placeholder do composer", () => {
    setTimeline([]);
    render(<ChatPane sendMessage={vi.fn()} />);

    expect(
      (screen.getByLabelText("Mensagem") as HTMLTextAreaElement).placeholder,
    ).toContain("#geral");
  });
});
