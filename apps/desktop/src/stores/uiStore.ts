import { create } from "zustand";

/** Carrega guildas fixadas do localStorage. */
function loadPinnedGuilds(): string[] {
  try {
    const raw = localStorage.getItem("echo:pinnedGuilds");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export interface UiState {
  /** MXID da sessão ativa ("@lucas:litteris.online"); null fora do shell. */
  myUserId: string | null;
  activeGuildId: string | null;
  activeChannelId: string | null;
  homeTab: "friends" | "discover";
  isProfileOpen: boolean;
  profileInitialTab: string | null;
  isJoinGuildOpen: boolean;
  joinGuildInitialCode: string | null;
  /** roomId → nomes de quem está digitando agora. */
  typingUsers: Record<string, string[]>;
  /** userId → estado de presença. */
  presence: Record<string, "online" | "offline" | "unavailable">;
  /** IDs das guildas fixadas na dock de acesso rápido. */
  pinnedGuilds: string[];
  /** userId do membro cujo perfil está aberto (null = perfil próprio). */
  memberProfileUserId: string | null;
  setMyUserId(userId: string | null): void;
  setActiveGuild(guildId: string | null): void;
  setActiveChannel(channelId: string | null): void;
  setHomeTab(tab: "friends" | "discover"): void;
  setProfileOpen(open: boolean, tab?: string | null): void;
  setJoinGuildOpen(open: boolean, initialCode?: string | null): void;
  /** Define/atualiza quem está digitando em um canal. */
  setTypingUsers(roomId: string, names: string[]): void;
  /** Define a presença de um usuário. */
  setPresence(userId: string, presence: "online" | "offline" | "unavailable"): void;
  /** Fixa uma guilda na dock de acesso rápido. */
  pinGuild(guildId: string): void;
  /** Remove uma guilda da dock de acesso rápido. */
  unpinGuild(guildId: string): void;
  /** Verifica se uma guilda está fixada. */
  isGuildPinned(guildId: string): boolean;
  /** Abre o perfil de outro membro (null fecha). */
  setMemberProfileUserId(userId: string | null): void;
}

/** Persiste a lista de guildas fixadas no localStorage. */
function persistPinnedGuilds(ids: string[]) {
  try {
    localStorage.setItem("echo:pinnedGuilds", JSON.stringify(ids));
  } catch {}
}

/** Estado de navegação da UI (guild/canal ativos, sessão); sem dados de sync. */
export const useUiStore = create<UiState>()((set, get) => ({
  myUserId: null,
  activeGuildId: null,
  activeChannelId: null,
  homeTab: "friends",
  isProfileOpen: false,
  profileInitialTab: null,
  isJoinGuildOpen: false,
  joinGuildInitialCode: null,
  typingUsers: {},
  presence: {},
  pinnedGuilds: loadPinnedGuilds(),
  memberProfileUserId: null,

  setMyUserId: (userId) => set({ myUserId: userId }),
  setActiveGuild: (guildId) => set({ activeGuildId: guildId }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
  setHomeTab(tab) { set({ homeTab: tab }); },
  setProfileOpen: (open, tab = null) => set({ isProfileOpen: open, profileInitialTab: tab }),
  setJoinGuildOpen: (open, initialCode = null) =>
    set({ isJoinGuildOpen: open, joinGuildInitialCode: initialCode }),

  setTypingUsers: (roomId, names) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [roomId]: names },
    })),

  setPresence: (userId, presence) =>
    set((state) => ({
      presence: { ...state.presence, [userId]: presence },
    })),

  pinGuild: (guildId) => {
    const current = get().pinnedGuilds;
    if (current.includes(guildId)) return;
    const next = [...current, guildId];
    persistPinnedGuilds(next);
    set({ pinnedGuilds: next });
  },

  unpinGuild: (guildId) => {
    const current = get().pinnedGuilds;
    if (!current.includes(guildId)) return;
    const next = current.filter((id) => id !== guildId);
    persistPinnedGuilds(next);
    set({ pinnedGuilds: next });
  },

  isGuildPinned: (guildId) => get().pinnedGuilds.includes(guildId),
  setMemberProfileUserId: (userId) => set({ memberProfileUserId: userId }),
}));
