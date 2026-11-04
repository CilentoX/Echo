import { create } from "zustand";

export interface UiState {
  /** MXID da sessão ativa ("@lucas:litteris.online"); null fora do shell. */
  myUserId: string | null;
  activeGuildId: string | null;
  activeChannelId: string | null;
  homeTab: "friends" | "discover";
  /** roomId → nomes de quem está digitando agora. */
  typingUsers: Record<string, string[]>;
  /** userId → estado de presença. */
  presence: Record<string, "online" | "offline" | "unavailable">;
  setMyUserId(userId: string | null): void;
  setActiveGuild(guildId: string | null): void;
  setActiveChannel(channelId: string | null): void;
  setHomeTab(tab: "friends" | "discover"): void;
  /** Define/atualiza quem está digitando em um canal. */
  setTypingUsers(roomId: string, names: string[]): void;
  /** Define a presença de um usuário. */
  setPresence(userId: string, presence: "online" | "offline" | "unavailable"): void;
}

/** Estado de navegação da UI (guild/canal ativos, sessão); sem dados de sync. */
export const useUiStore = create<UiState>()((set) => ({
  myUserId: null,
  activeGuildId: null,
  activeChannelId: null,
  homeTab: "friends",
  typingUsers: {},
  presence: {},

  setMyUserId: (userId) => set({ myUserId: userId }),
  setActiveGuild: (guildId) => set({ activeGuildId: guildId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setHomeTab: (tab) => set({ homeTab: tab }),

  setTypingUsers: (roomId, names) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [roomId]: names },
    })),

  setPresence: (userId, presence) =>
    set((state) => ({
      presence: { ...state.presence, [userId]: presence },
    })),
}));
