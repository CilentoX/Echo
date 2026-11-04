import { describe, it, expect, beforeEach, vi } from "vitest";
import { useFriendsStore } from "./friendsStore";
import { echoApi } from "@/lib/matrix/instance";
import { useUiStore } from "./uiStore";

describe("useFriendsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.getState().reset();
    useUiStore.setState({ activeGuildId: "g1", activeChannelId: "c1" });
  });

  it("deve inicializar com estado limpo", () => {
    const state = useFriendsStore.getState();
    expect(state.friends).toEqual([]);
    expect(state.pendingIncoming).toEqual([]);
    expect(state.pendingOutgoing).toEqual([]);
    expect(state.blocked).toEqual([]);
    expect(state.activeTab).toBe("online");
    expect(state.loading).toBe(false);
  });

  it("loadFriends deve preencher amigos e solicitações", async () => {
    const mockData = {
      friends: [
        {
          friendshipId: "f1",
          userId: "@amigo:litteris.online",
          displayName: "Amigo",
          nickname: "amigo",
          avatarUrl: null,
          status: "accepted" as const,
          directRoomId: "!dm1:litteris.online",
        },
      ],
      pendingIncoming: [
        {
          friendshipId: "f2",
          user: {
            userId: "@pedinte:litteris.online",
            displayName: "Pedinte",
            nickname: null,
            avatarUrl: null,
          },
          createdAt: "2026-11-04T00:00:00Z",
        },
      ],
      pendingOutgoing: [],
      blocked: [],
    };

    vi.spyOn(echoApi, "getFriends").mockResolvedValue(mockData);

    await useFriendsStore.getState().loadFriends();

    const state = useFriendsStore.getState();
    expect(state.friends).toHaveLength(1);
    expect(state.friends[0].userId).toBe("@amigo:litteris.online");
    expect(state.pendingIncoming).toHaveLength(1);
    expect(state.loading).toBe(false);
  });

  it("sendFriendRequest deve chamar a API e recarregar a lista", async () => {
    vi.spyOn(echoApi, "sendFriendRequest").mockResolvedValue({ id: "f3", status: "pending" });
    const loadSpy = vi.spyOn(echoApi, "getFriends").mockResolvedValue({
      friends: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      blocked: [],
    });

    await useFriendsStore.getState().sendFriendRequest("@novo:litteris.online");

    expect(echoApi.sendFriendRequest).toHaveBeenCalledWith("@novo:litteris.online");
    expect(loadSpy).toHaveBeenCalled();
    expect(useFriendsStore.getState().successMessage).toContain("enviada com sucesso");
  });

  it("acceptFriendRequest deve aceitar e recarregar", async () => {
    vi.spyOn(echoApi, "acceptFriendRequest").mockResolvedValue({ id: "f2", status: "accepted" });
    vi.spyOn(echoApi, "getFriends").mockResolvedValue({
      friends: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      blocked: [],
    });

    await useFriendsStore.getState().acceptFriendRequest("f2");

    expect(echoApi.acceptFriendRequest).toHaveBeenCalledWith("f2");
    expect(useFriendsStore.getState().successMessage).toBe("Solicitação aceita!");
  });

  it("openDirectMessage deve obter sala direta e definir canal ativo no uiStore", async () => {
    vi.spyOn(echoApi, "getOrCreateDirectRoom").mockResolvedValue({
      roomId: "!dm_amigo:litteris.online",
    });

    const roomId = await useFriendsStore.getState().openDirectMessage("@amigo:litteris.online");

    expect(roomId).toBe("!dm_amigo:litteris.online");
    expect(useUiStore.getState().activeGuildId).toBeNull();
    expect(useUiStore.getState().activeChannelId).toBe("!dm_amigo:litteris.online");
    expect(useFriendsStore.getState().selectedFriendId).toBe("@amigo:litteris.online");
  });

  it("setActiveTab deve alternar aba e limpar mensagens", () => {
    useFriendsStore.setState({ error: "Erro prévio", successMessage: "Sucesso prévio" });
    useFriendsStore.getState().setActiveTab("pending");

    expect(useFriendsStore.getState().activeTab).toBe("pending");
    expect(useFriendsStore.getState().error).toBeNull();
    expect(useFriendsStore.getState().successMessage).toBeNull();
  });

  it("loadDiscoveredUsers deve preencher lista de usuários descobertos", async () => {
    const mockUsers = [
      {
        userId: "@paulo:litteris.online",
        displayName: "Paulo Silva",
        nickname: "paulo",
        avatarUrl: null,
        bio: "Bio teste",
        status: "none" as const,
        friendshipId: null,
        directRoomId: null,
        joinedAt: "2026-11-04T00:00:00Z",
      },
    ];

    vi.spyOn(echoApi, "getDiscoveredUsers").mockResolvedValue({ users: mockUsers });

    await useFriendsStore.getState().loadDiscoveredUsers();

    const state = useFriendsStore.getState();
    expect(state.discoveredUsers).toHaveLength(1);
    expect(state.discoveredUsers[0].userId).toBe("@paulo:litteris.online");
    expect(state.discovering).toBe(false);
  });
});
