import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ChatHeader from "./ChatHeader";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";

describe("ChatHeader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.getState().reset();
    useUiStore.setState({ presence: {} });
  });

  it("renderiza o cabeçalho para um canal de guilda com nome e tópico", () => {
    render(
      <ChatHeader
        roomId="!c1:hs"
        channelName="geral"
        topic="Discussões gerais da comunidade"
      />
    );

    expect(screen.getByText("geral")).toBeTruthy();
    expect(screen.getByText("Discussões gerais da comunidade")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Buscar mensagens" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mensagens fixadas" })).toBeTruthy();
  });

  it("renderiza o cabeçalho para uma DM quando a sala corresponde a um amigo", () => {
    useFriendsStore.setState({
      friends: [
        {
          friendshipId: "f1",
          userId: "@amigo:litteris.online",
          displayName: "Amigo Legal",
          nickname: "amigo",
          avatarUrl: null,
          status: "accepted",
          directRoomId: "!dm_123:litteris.online",
        },
      ],
    });

    render(
      <ChatHeader
        roomId="!dm_123:litteris.online"
      />
    );

    expect(screen.getByText("Amigo Legal")).toBeTruthy();
    expect(screen.getByText(/@amigo/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar chamada de voz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Iniciar chamada de vídeo" })).toBeTruthy();
  });

  it("chama onToggleSidebar quando o botão de menu é clicado", async () => {
    const user = userEvent.setup();
    const toggleSpy = vi.fn();

    render(
      <ChatHeader
        roomId="!c1:hs"
        channelName="anuncios"
        showSidebarToggle={true}
        onToggleSidebar={toggleSpy}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: "Abrir canais" });
    await user.click(toggleBtn);

    expect(toggleSpy).toHaveBeenCalled();
  });
});

