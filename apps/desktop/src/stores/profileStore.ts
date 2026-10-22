import { create } from "zustand";

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileState {
  /** Dados do próprio usuário (preenchidos no login / edição de perfil). */
  displayName: string;
  username: string;           // MXID localpart + domain, ex: @lucas:eco.chat
  avatarUrl: string | null;   // mxc:// ou data URL (Fase 2: upload real)
  bio: string | null;
  role: string | null;        // cargo dentro da comunidade
  joinedAt: string | null;    // data de entrada na rede
  links: ProfileLink[];       // links sociais (GitHub, LinkedIn, etc.)

  setDisplayName(name: string): void;
  setBio(bio: string | null): void;
  setRole(role: string | null): void;
  setAvatarUrl(url: string | null): void;
  setLinks(links: ProfileLink[]): void;
  addLink(link: ProfileLink): void;
  removeLink(url: string): void;
  reset(): void;
}

/** Dados de perfil do usuário logado. Não vem do sync loop (Fase 2: server). */
export const useProfileStore = create<ProfileState>()((set) => ({
  displayName: "",
  username: "",
  avatarUrl: null,
  bio: null,
  role: null,
  joinedAt: null,
  links: [],

  setDisplayName: (name) => set({ displayName: name }),
  setBio: (bio) => set({ bio }),
  setRole: (role) => set({ role }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setLinks: (links) => set({ links: [...links] }),
  addLink: (link) =>
    set((state) => ({ links: [...state.links, link] })),
  removeLink: (url) =>
    set((state) => ({ links: state.links.filter((l) => l.url !== url) })),
  reset: () =>
    set({
      displayName: "",
      username: "",
      avatarUrl: null,
      bio: null,
      role: null,
      joinedAt: null,
      links: [],
    }),
}));

export const selectProfile = (state: ProfileState) => state;