import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomeSidebar from "./HomeSidebar";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";

describe("HomeSidebar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.getState().reset();
    useUiStore.setState({ activeGuildId: "home", activeChannelId: null });
  });

  it("renderiza o botão Amigos e cabeçalho de Mensagens Diretas", () => {
    render(<HomeSidebar />);

    expect(screen.getByText("Amigos")).toBeTruthy();
    expect(screen.getByText("Mensagens Diretas")).toBeTruthy();
  });

  it("exibe badge com quantidade de solicitações recebidas pendentes", () => {
    useFriendsStore.setState({
      pendingIncoming: [
        {
          friendshipId: "p1",
          user: { userId: "@pedinte:litteris.online", displayName: "Pedinte", nickname: null, avatarUrl: null },
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<HomeSidebar />);
    expect(screen.getByText("1")).toBeTruthy();
  });

  it("renderiza lista de amigos e permite abrir conversa direta", async () => {
    const user = userEvent.setup();
    const openDmSpy = vi.spyOn(useFriendsStore.getState(), "openDirectMessage").mockResolvedValue("!dm1:hs");

    useFriendsStore.setState({
      friends: [
        {
          friendshipId: "f1",
          userId: "@amigo:litteris.online",
          displayName: "Amigo Legal",
          nickname: "amigolegal",
          avatarUrl: null,
          status: "accepted",
          directRoomId: "!dm1:hs",
        },
      ],
    });

    render(<HomeSidebar />);

    expect(screen.getByText("Amigo Legal")).toBeTruthy();
    expect(screen.getByText("@amigolegal")).toBeTruthy();

    const friendBtn = screen.getByRole("button", { name: /Amigo Legal/i });
    await user.click(friendBtn);

    expect(openDmSpy).toHaveBeenCalledWith("@amigo:litteris.online");
  });

  it("clicar no botão Amigos desseleciona o canal ativo e foca no dashboard", async () => {
    const user = userEvent.setup();
    useUiStore.setState({ activeChannelId: "!dm1:hs" });

    render(<HomeSidebar />);

    const friendsBtn = screen.getByRole("button", { name: /Amigos/i });
    await user.click(friendsBtn);

    expect(useUiStore.getState().activeChannelId).toBeNull();
  });
});
