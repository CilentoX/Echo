import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useSyncStore } from "@/stores/syncStore";
import ChatHeader from "@/features/chat/ChatHeader";
import MessageBubble from "@/features/chat/MessageBubble";
import type { NormalizedEvent } from "@/lib/matrix/types";

describe("Pinned Messages (Mensagens Fixadas)", () => {
  const roomId = "!chan-pinned:hs";
  const event1: NormalizedEvent = {
    eventId: "$ev1",
    roomId,
    sender: "@mod:hs",
    body: "Regra #1: Sejam gentis e respeitem todos.",
    originServerTs: Date.now() - 100000,
  };

  beforeEach(() => {
    localStorage.clear();
    useSyncStore.setState({
      timelineByChannel: {
        [roomId]: [event1],
      },
      pinnedByRoom: {
        [roomId]: [event1.eventId],
      },
    });
  });

  it("permite fixar e desafixar mensagens no syncStore", () => {
    useSyncStore.getState().unpinMessage(roomId, event1.eventId);
    expect(useSyncStore.getState().pinnedByRoom[roomId]).not.toContain(event1.eventId);

    useSyncStore.getState().pinMessage(roomId, event1.eventId);
    expect(useSyncStore.getState().pinnedByRoom[roomId]).toContain(event1.eventId);
  });

  it("renderiza o popover de mensagens fixadas no ChatHeader com contador", () => {
    render(<ChatHeader roomId={roomId} channelName="regras" />);

    const pinButton = screen.getByRole("button", { name: "Mensagens fixadas" });
    expect(pinButton).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("abre a lista de mensagens fixadas ao clicar no botão", async () => {
    const user = userEvent.setup();
    render(<ChatHeader roomId={roomId} channelName="regras" />);

    const pinButton = screen.getByRole("button", { name: "Mensagens fixadas" });
    await user.click(pinButton);

    expect(screen.getByText(/Regra #1/i)).toBeTruthy();
    expect(screen.getByText("Desafixar")).toBeTruthy();
  });

  it("permite desafixar uma mensagem pela lista do popover", async () => {
    const user = userEvent.setup();
    render(<ChatHeader roomId={roomId} channelName="regras" />);

    const pinButton = screen.getByRole("button", { name: "Mensagens fixadas" });
    await user.click(pinButton);

    const unpinButton = screen.getByRole("button", { name: "Desafixar mensagem" });
    await user.click(unpinButton);

    expect(useSyncStore.getState().pinnedByRoom[roomId]).not.toContain(event1.eventId);
  });

  it("exibe indicador de fixado na MessageBubble", () => {
    render(<MessageBubble event={event1} showHeader={true} />);

    expect(screen.getByTitle("Mensagem fixada")).toBeTruthy();
  });
});

