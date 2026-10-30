import { create } from "zustand";

export interface GuildProfileState {
  /** Dados da guilda ativa (preenchidos ao entrar/editar). */
  guildId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdBy: string | null;

  setGuildProfile: (profile: Partial<GuildProfileState>) => void;
  resetGuildProfile: () => void;
}

/** Dados de perfil da guilda ativa. */
export const useGuildProfileStore = create<GuildProfileState>()((set) => ({
  guildId: "",
  name: "",
  description: null,
  avatarUrl: null,
  bannerUrl: null,
  createdBy: null,

  setGuildProfile: (profile) =>
    set((state) => ({ ...state, ...profile })),

  resetGuildProfile: () =>
    set({
      guildId: "",
      name: "",
      description: null,
      avatarUrl: null,
      bannerUrl: null,
      createdBy: null,
    }),
}));

export const selectGuildProfile = (state: GuildProfileState) => state;
