import { create } from "zustand";

export interface UiState {
  /** MXID da sessão ativa ("@lucas:litteris.online"); null fora do shell. */
  myUserId: string | null;
  activeGuildId: string | null;
  activeChannelId: string | null;
  setMyUserId(userId: string | null): void;
  setActiveGuild(guildId: string | null): void;
  setActiveChannel(channelId: string | null): void;
}

/** Estado de navegação da UI (guild/canal ativos, sessão); sem dados de sync. */
export const useUiStore = create<UiState>()((set) => ({
  myUserId: null,
  activeGuildId: null,
  activeChannelId: null,

  setMyUserId: (userId) => set({ myUserId: userId }),
  setActiveGuild: (guildId) => set({ activeGuildId: guildId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
