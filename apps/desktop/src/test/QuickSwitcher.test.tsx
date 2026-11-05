import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import QuickSwitcherModal from "@/features/shell/QuickSwitcherModal";
import { useSyncStore } from "@/stores/syncStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";

describe("QuickSwitcherModal", () => {
  beforeEach(() => {
    useSyncStore.setState({
      guilds: [
        {
          guildId: "!guild1:hs",
          name: "Servidor Principal",
          avatarUrl: null,
          unreadCount: 0,
        },
      ],
      channelsByGuild: {
        "!guild1:hs": [
          {
            channelId: "!chan1:hs",
            name: "geral",
            unreadCount: 0,
            type: "text",
          },
          {
            channelId: "!chan2:hs",
            name: "Voz Geral",
            unreadCount: 0,
            type: "voice",
          },
        ],
      },
    });

    useFriendsStore.setState({
      friends: [
        {
          friendshipId: "friend-1",
          userId: "@amigo:hs",
          displayName: "Carlos Amigo",
          username: "carlos",
          nickname: "carlos",
          status: "accepted",
          avatarUrl: null,
          presence: "online",
          directRoomId: "!dm_carlos:hs",
        },
      ],
    });

    useUiStore.setState({
      activeGuildId: null,
      activeChannelId: null,
    });
  });

  it("não renderiza quando open=false", () => {
    const { container } = render(<QuickSwitcherModal open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza canais, servidores e amigos quando aberto", () => {
    render(<QuickSwitcherModal open={true} onClose={vi.fn()} />);

    expect(screen.getByPlaceholderText(/Para onde você quer ir/i)).toBeTruthy();
    expect(screen.getAllByText("Servidor Principal").length).toBeGreaterThan(0);
    expect(screen.getByText("geral")).toBeTruthy();
    expect(screen.getByText("Voz Geral")).toBeTruthy();
    expect(screen.getByText("Carlos Amigo")).toBeTruthy();
  });

  it("filtra amigos usando o prefixo @", async () => {
    render(<QuickSwitcherModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Para onde você quer ir/i);

    fireEvent.change(input, { target: { value: "@carlos" } });

    expect(screen.getByText("Carlos Amigo")).toBeTruthy();
    expect(screen.queryByText("geral")).toBeNull();
    expect(screen.queryByText("Servidor Principal")).toBeNull();
  });

  it("filtra canais usando o prefixo #", async () => {
    render(<QuickSwitcherModal open={true} onClose={vi.fn()} />);
    const input = screen.getByPlaceholderText(/Para onde você quer ir/i);

    fireEvent.change(input, { target: { value: "#geral" } });

    expect(screen.getByText("geral")).toBeTruthy();
    expect(screen.queryByText("Carlos Amigo")).toBeNull();
  });

  it("navega até um canal ao clicar nele e fecha o modal", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<QuickSwitcherModal open={true} onClose={handleClose} />);

    const channelItem = screen.getByRole("button", { name: /#geral/i });
    await user.click(channelItem);

    expect(useUiStore.getState().activeGuildId).toBe("!guild1:hs");
    expect(useUiStore.getState().activeChannelId).toBe("!chan1:hs");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("navega até uma conversa de amigo ao clicar", async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    render(<QuickSwitcherModal open={true} onClose={handleClose} />);

    const friendItem = screen.getByRole("button", { name: /Carlos Amigo/i });
    await user.click(friendItem);

    expect(useUiStore.getState().activeGuildId).toBe("home");
    expect(useUiStore.getState().activeChannelId).toBe("!dm_carlos:hs");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
