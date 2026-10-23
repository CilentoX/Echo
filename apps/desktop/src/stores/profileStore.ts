import { create } from "zustand";

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileState {
  /** Dados do próprio usuário (preenchidos no login / edição de perfil). */
  displayName: string;
  username: string;           // MXID localpart + domain, ex: @lucas:echo.litteris.online
  nickname: string | null;    // apelido visível (Discord-style, opcional)
  avatarUrl: string | null;   // mxc:// ou data URL (Fase 2: upload real)
  bannerUrl: string | null;   // banner do perfil (mxc:// ou data URL)
  bio: string | null;
  role: string | null;        // cargo dentro da comunidade
  joinedAt: string | null;    // data de entrada na rede
  links: ProfileLink[];       // links sociais (GitHub, LinkedIn, etc.)

  setDisplayName(name: string): void;
  setNickname(nickname: string | null): void;
  setBio(bio: string | null): void;
  setRole(role: string | null): void;
  setAvatarUrl(url: string | null): void;
  setBannerUrl(url: string | null): void;
  setLinks(links: ProfileLink[]): void;
  addLink(link: ProfileLink): void;
  removeLink(url: string): void;
  reset(): void;
}

/** Dados de perfil do usuário logado. Não vem do sync loop (Fase 2: server). */
export const useProfileStore = create<ProfileState>()((set) => ({
  displayName: "",
  username: "",
  nickname: null,
  avatarUrl: null,
  bannerUrl: null,
  bio: null,
  role: null,
  joinedAt: null,
  links: [],

  setDisplayName: (name) => set({ displayName: name }),
  setNickname: (nickname) => set({ nickname }),
  setBio: (bio) => set({ bio }),
  setRole: (role) => set({ role }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setBannerUrl: (url) => set({ bannerUrl: url }),
  setLinks: (links) => set({ links: [...links] }),
  addLink: (link) =>
    set((state) => ({ links: [...state.links, link] })),
  removeLink: (url) =>
    set((state) => ({ links: state.links.filter((l) => l.url !== url) })),
  reset: () =>
    set({
      displayName: "",
      username: "",
      nickname: null,
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      role: null,
      joinedAt: null,
      links: [],
    }),
}));

export const selectProfile = (state: ProfileState) => state;