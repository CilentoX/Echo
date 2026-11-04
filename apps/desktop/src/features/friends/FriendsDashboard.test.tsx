import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FriendsDashboard from "./FriendsDashboard";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";

describe("FriendsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.getState().reset();
    useUiStore.setState({ activeGuildId: "home", activeChannelId: null });
  });

  it("renderiza o cabeçalho e todas as abas", () => {
    render(<FriendsDashboard />);

    expect(screen.getByText("Amigos")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Disponível/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Todos/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Pendente/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Bloqueados/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Adicionar Amigo/i })).toBeTruthy();
  });

  it("permite enviar solicitação de amizade na aba Adicionar Amigo", async () => {
    const user = userEvent.setup();
    const sendSpy = vi.spyOn(useFriendsStore.getState(), "sendFriendRequest").mockResolvedValue(undefined);

    render(<FriendsDashboard />);

    // Clica na aba Adicionar Amigo
    const addTabBtn = screen.getByRole("button", { name: /Adicionar Amigo/i });
    await user.click(addTabBtn);

    const input = screen.getByPlaceholderText(/Ex: @amigo:litteris.online/i);
    await user.type(input, "@novo:litteris.online");

    const submitBtn = screen.getByRole("button", { name: /Enviar pedido/i });
    await user.click(submitBtn);

    expect(sendSpy).toHaveBeenCalledWith("@novo:litteris.online");
  });

  it("exibe e aceita solicitações pendentes recebidas", async () => {
    const user = userEvent.setup();
    const acceptSpy = vi.spyOn(useFriendsStore.getState(), "acceptFriendRequest").mockResolvedValue(undefined);

    useFriendsStore.setState({
      activeTab: "pending",
      pendingIncoming: [
        {
          friendshipId: "req_1",
          user: {
            userId: "@solicitante:litteris.online",
            displayName: "Solicitante",
            nickname: null,
            avatarUrl: null,
          },
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<FriendsDashboard />);

    expect(screen.getByText("Solicitante")).toBeTruthy();
    expect(screen.getByText("Pedido de amizade recebido")).toBeTruthy();

    const acceptBtn = screen.getByRole("button", { name: "Aceitar" });
    await user.click(acceptBtn);

    expect(acceptSpy).toHaveBeenCalledWith("req_1");
  });

  it("filtra amigos na busca da aba Todos", async () => {
    const user = userEvent.setup();

    useFriendsStore.setState({
      activeTab: "all",
      friends: [
        {
          friendshipId: "f1",
          userId: "@carlos:litteris.online",
          displayName: "Carlos Silva",
          nickname: "carlos",
          avatarUrl: null,
          status: "accepted",
          directRoomId: null,
        },
        {
          friendshipId: "f2",
          userId: "@marcos:litteris.online",
          displayName: "Marcos Lima",
          nickname: "marcos",
          avatarUrl: null,
          status: "accepted",
          directRoomId: null,
        },
      ],
    });

    render(<FriendsDashboard />);

    expect(screen.getByText("Carlos Silva")).toBeTruthy();
    expect(screen.getByText("Marcos Lima")).toBeTruthy();

    const searchInput = screen.getByPlaceholderText("Buscar amigos...");
    await user.type(searchInput, "carlos");

    expect(screen.getByText("Carlos Silva")).toBeTruthy();
    expect(screen.queryByText("Marcos Lima")).toBeNull();
  });
});
