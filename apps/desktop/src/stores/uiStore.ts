import { create } from "zustand";

export interface UiState {
  activeGuildId: string | null;
  activeChannelId: string | null;
  setActiveGuild(guildId: string | null): void;
  setActiveChannel(channelId: string | null): void;
}

/** Estado de navegação da UI (guild/canal ativos); sem dados de sync. */
export const useUiStore = create<UiState>()((set) => ({
  activeGuildId: null,
  activeChannelId: null,

  setActiveGuild: (guildId) => set({ activeGuildId: guildId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
