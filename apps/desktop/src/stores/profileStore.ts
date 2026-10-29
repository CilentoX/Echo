import { create } from "zustand";
import { matrixService } from "@/lib/matrix/instance";

export interface ProfileLink {
  label: string;
  url: string;
}

export interface ProfileState {
  /** Dados do próprio usuário (preenchidos no login / edição de perfil). */
  displayName: string;
  username: string;           // MXID localpart + domain, ex: @lucas:echo.litteris.online
  nickname: string | null;    // apelido visível (Discord-style, opcional)
  avatarUrl: string | null;   // mxc:// do Matrix (perfil do usuário)
  bannerUrl: string | null;   // banner do perfil (mxc:// ou data URL)
  appwriteAvatarUrl: string | null;   // URL de fallback do Appwrite para o avatar
  appwriteBannerUrl: string | null;   // URL de fallback do Appwrite para o banner
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
  setAppwriteAvatarUrl(url: string | null): void;
  setAppwriteBannerUrl(url: string | null): void;
  /** Carrega dados do perfil do próprio usuário do servidor Matrix. */
  loadProfile(): Promise<void>;
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
  appwriteAvatarUrl: null,
  appwriteBannerUrl: null,
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
  setAppwriteAvatarUrl: (url) => {
    set({ appwriteAvatarUrl: url });
    if (url) localStorage.setItem("echo:appwriteAvatarUrl", url);
    else localStorage.removeItem("echo:appwriteAvatarUrl");
  },
  setAppwriteBannerUrl: (url) => {
    set({ appwriteBannerUrl: url });
    if (url) localStorage.setItem("echo:appwriteBannerUrl", url);
    else localStorage.removeItem("echo:appwriteBannerUrl");
  },
  loadProfile: async () => {
    try {
      const [avatar, banner, displayName, userProfile] = await Promise.all([
        matrixService.getAvatarUrl(),
        matrixService.getBannerUrl(),
        matrixService.getDisplayName(),
        matrixService.getUserProfile(),
      ]);

      // Restaura URLs do Appwrite persistidas (sobrevivem a reload/F5)
      const persistedAvatar = localStorage.getItem("echo:appwriteAvatarUrl");
      const persistedBanner = localStorage.getItem("echo:appwriteBannerUrl");

      set({
        avatarUrl: avatar ?? null,
        bannerUrl: banner ?? null,
        displayName: displayName ?? "",
        bio: userProfile?.bio ?? null,
        role: userProfile?.role ?? null,
        appwriteAvatarUrl: persistedAvatar ?? null,
        appwriteBannerUrl: persistedBanner ?? null,
      });
    } catch {
      // falha silenciosa: perfil será preenchido à medida que for usado
    }
  },
  setLinks: (links) => set({ links: [...links] }),
  addLink: (link) =>
    set((state) => ({ links: [...state.links, link] })),
  removeLink: (url) =>
    set((state) => ({ links: state.links.filter((l) => l.url !== url) })),
  reset: () => {
    localStorage.removeItem("echo:appwriteAvatarUrl");
    localStorage.removeItem("echo:appwriteBannerUrl");
    set({
      displayName: "",
      username: "",
      nickname: null,
      avatarUrl: null,
      bannerUrl: null,
      appwriteAvatarUrl: null,
      appwriteBannerUrl: null,
      bio: null,
      role: null,
      joinedAt: null,
      links: [],
    });
  },
}));

export const selectProfile = (state: ProfileState) => state;