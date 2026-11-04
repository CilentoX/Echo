import { create } from "zustand";
import { echoApi } from "@/lib/matrix/instance";
import type { FriendItem, FriendRequestItem } from "@/lib/api/echoApi";
import { useUiStore } from "@/stores/uiStore";

export type FriendsTab = "online" | "all" | "pending" | "blocked" | "add";

export interface FriendsState {
  friends: FriendItem[];
  pendingIncoming: FriendRequestItem[];
  pendingOutgoing: FriendRequestItem[];
  blocked: FriendRequestItem[];
  activeTab: FriendsTab;
  selectedFriendId: string | null;
  searchQuery: string;
  loading: boolean;
  error: string | null;
  successMessage: string | null;

  setActiveTab: (tab: FriendsTab) => void;
  setSelectedFriendId: (friendId: string | null) => void;
  setSearchQuery: (query: string) => void;
  clearMessages: () => void;

  loadFriends: () => Promise<void>;
  sendFriendRequest: (target: string) => Promise<void>;
  acceptFriendRequest: (friendshipId: string) => Promise<void>;
  declineFriendRequest: (friendshipId: string) => Promise<void>;
  cancelFriendRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserIdOrFriendshipId: string) => Promise<void>;
  openDirectMessage: (targetUserId: string) => Promise<string>;
  reset: () => void;
}

const initialState = {
  friends: [] as FriendItem[],
  pendingIncoming: [] as FriendRequestItem[],
  pendingOutgoing: [] as FriendRequestItem[],
  blocked: [] as FriendRequestItem[],
  activeTab: "online" as FriendsTab,
  selectedFriendId: null as string | null,
  searchQuery: "",
  loading: false,
  error: null as string | null,
  successMessage: null as string | null,
};

export const useFriendsStore = create<FriendsState>()((set, get) => ({
  ...initialState,

  setActiveTab: (tab) => set({ activeTab: tab, error: null, successMessage: null }),
  setSelectedFriendId: (friendId) => set({ selectedFriendId: friendId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  clearMessages: () => set({ error: null, successMessage: null }),

  loadFriends: async () => {
    set({ loading: true, error: null });
    try {
      const data = await echoApi.getFriends();
      set({
        friends: data.friends || [],
        pendingIncoming: data.pendingIncoming || [],
        pendingOutgoing: data.pendingOutgoing || [],
        blocked: data.blocked || [],
        loading: false,
      });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao carregar lista de amigos" });
    }
  },

  sendFriendRequest: async (target: string) => {
    if (!target.trim()) return;
    set({ loading: true, error: null, successMessage: null });
    try {
      const res = await echoApi.sendFriendRequest(target.trim());
      await get().loadFriends();
      set({
        loading: false,
        successMessage: res.autoAccepted
          ? "Pedido de amizade aceito mutuamente!"
          : `Solicitação de amizade enviada com sucesso!`,
      });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao enviar pedido de amizade" });
      throw err;
    }
  },

  acceptFriendRequest: async (friendshipId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.acceptFriendRequest(friendshipId);
      await get().loadFriends();
      set({ loading: false, successMessage: "Solicitação aceita!" });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao aceitar solicitação" });
      throw err;
    }
  },

  declineFriendRequest: async (friendshipId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.declineFriendRequest(friendshipId);
      await get().loadFriends();
      set({ loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao recusar solicitação" });
      throw err;
    }
  },

  cancelFriendRequest: async (friendshipId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.cancelFriendRequest(friendshipId);
      await get().loadFriends();
      set({ loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao cancelar solicitação" });
      throw err;
    }
  },

  removeFriend: async (friendshipId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.removeFriend(friendshipId);
      await get().loadFriends();
      set({ loading: false });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao desfazer amizade" });
      throw err;
    }
  },

  blockUser: async (targetUserId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.blockUser(targetUserId);
      await get().loadFriends();
      set({ loading: false, successMessage: "Usuário bloqueado" });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao bloquear usuário" });
      throw err;
    }
  },

  unblockUser: async (targetUserIdOrFriendshipId: string) => {
    set({ loading: true, error: null });
    try {
      await echoApi.unblockUser(targetUserIdOrFriendshipId);
      await get().loadFriends();
      set({ loading: false, successMessage: "Usuário desbloqueado" });
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao desbloquear usuário" });
      throw err;
    }
  },

  openDirectMessage: async (targetUserId: string) => {
    set({ loading: true, error: null });
    try {
      const { roomId } = await echoApi.getOrCreateDirectRoom(targetUserId);
      const ui = useUiStore.getState();
      ui.setActiveGuild(null);
      ui.setActiveChannel(roomId);
      set({ selectedFriendId: targetUserId, loading: false });
      return roomId;
    } catch (err: any) {
      set({ loading: false, error: err.message || "Erro ao abrir conversa direta" });
      throw err;
    }
  },

  reset: () => set(initialState),
}));
