import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NormalizedEvent, NormalizedReaction } from "@/lib/matrix/types";
import MessageBubble from "@/features/chat/MessageBubble";

const MY_USER = "@lucas:hs";

const baseEvent: NormalizedEvent = {
  eventId: "e1",
  roomId: "!r1:hs",
  sender: "@outro:hs",
  body: "Olá, mundo!",
  originServerTs: 1_700_000_000_000,
};

function renderBubble(event: NormalizedEvent = baseEvent, props = {}) {
  return render(
    <MessageBubble
      event={event}
      showHeader={true}
      myUserId={MY_USER}
      pending={false}
      isBot={false}
      reactions={[]}
      threadReplies={0}
      {...props}
    />,
  );
}

function articleEl() {
  return document.querySelector<HTMLElement>('[data-event-id="e1"]')!;
}

describe("MessageBubble v2", () => {
  it("renderiza bolha de receiver alinhada à esquerda (não é o próprio usuário)", () => {
    renderBubble();
    const el = articleEl();
    expect(el.className).toContain("justify-start");
    expect(el.className).not.toContain("justify-end");
  });

  it("renderiza bolha de sender alinhada à direita (próprio usuário)", () => {
    const senderEvent: NormalizedEvent = { ...baseEvent, sender: MY_USER };
    renderBubble(senderEvent);
    const el = articleEl();
    expect(el.className).toContain("justify-end");
  });

  it("mostra avatar inicial, nome e hora quando showHeader é true", () => {
    renderBubble();
    expect(screen.getByText("outro")).toBeTruthy();
    const time = document.querySelector("time");
    expect(time).not.toBeNull();
    expect(time!.textContent).toMatch(/\d{2}:\d{2}/);
  });

  it("não mostra nome do remetente quando showHeader é false", () => {
    renderBubble(baseEvent, { showHeader: false });
    expect(screen.queryByText("outro")).toBeNull();
  });

  it("mostra selo BOT quando isBot é true", () => {
    renderBubble(baseEvent, { isBot: true });
    expect(screen.getByText("BOT")).toBeTruthy();
  });

  it("mostra selo editado quando editedAt está definido", () => {
    const editedEvent: NormalizedEvent = {
      ...baseEvent,
      editedAt: 1_700_000_060_000,
    };
    renderBubble(editedEvent);
    expect(screen.getByTestId("edited-badge")).not.toBeNull();
  });

  it("mostra '[mensagem excluída]' quando redacted é true", () => {
    const redactedEvent: NormalizedEvent = { ...baseEvent, redacted: true };
    renderBubble(redactedEvent);
    const el = screen.getByTestId("message-body-redacted");
    expect(el.textContent).toBe("[mensagem excluída]");
  });

  it("mostra chip de reply-to quando replyTo está definido", () => {
    const replyEvent: NormalizedEvent = {
      ...baseEvent,
      replyTo: {
        eventId: "e0",
        sender: "@ana:hs",
        body: "Mensagem original citada aqui",
      },
    };
    renderBubble(replyEvent);
    expect(screen.getByTestId("reply-chip")).not.toBeNull();
    expect(screen.getByText("ana")).toBeTruthy();
  });

  it("mostra 'Enviando…' quando pending é true", () => {
    renderBubble(baseEvent, { pending: true });
    expect(screen.getByText("Enviando…")).toBeTruthy();
  });

  it("agrupa reações por emoji com count e marca a própria reação", () => {
    const reactions: NormalizedReaction[] = [
      {
        eventId: "r1",
        roomId: "!r1:hs",
        sender: "@ana:hs",
        targetEventId: "e1",
        emoji: "👍",
      },
      {
        eventId: "r2",
        roomId: "!r1:hs",
        sender: MY_USER,
        targetEventId: "e1",
        emoji: "👍",
      },
      {
        eventId: "r3",
        roomId: "!r1:hs",
        sender: "@bob:hs",
        targetEventId: "e1",
        emoji: "❤️",
      },
    ];
    renderBubble(baseEvent, { reactions });
    const chips = screen.getAllByTestId("reaction-chip");
    expect(chips.length).toBe(2); // dois emojis distintos
    const thumbsUp = chips.find((c) => c.textContent?.includes("👍"));
    expect(thumbsUp).toBeTruthy();
    expect(thumbsUp!.getAttribute("aria-pressed")).toBe("true");
    expect(thumbsUp!.textContent).toContain("2");
  });

  it("não mostra reações quando o array está vazio", () => {
    renderBubble(baseEvent, { reactions: [] });
    expect(screen.queryByTestId("reaction-chip")).toBeNull();
  });

  it("mostra chip de tópico quando threadReplies > 0", () => {
    renderBubble(baseEvent, { threadReplies: 3 });
    expect(screen.getByRole("button", { name: /Abrir tópico/ })).not.toBeNull();
  });
});
