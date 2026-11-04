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
  presence?: "online" | "offline" | "unavailable" | "idle" | "dnd";

  setDisplayName(name: string): void;
  setNickname(nickname: string | null): void;
  setBio(bio: string | null): void;
  setRole(role: string | null): void;
  setAvatarUrl(url: string | null): void;
  setBannerUrl(url: string | null): void;
  setAppwriteAvatarUrl(url: string | null): void;
  setAppwriteBannerUrl(url: string | null): void;
  setPresence?(presence: "online" | "offline" | "unavailable" | "idle" | "dnd"): void;
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
  presence: "online",

  setDisplayName: (name) => set({ displayName: name }),
  setNickname: (nickname) => set({ nickname }),
  setBio: (bio) => set({ bio }),
  setRole: (role) => set({ role }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setBannerUrl: (url) => set({ bannerUrl: url }),
  setPresence: (presence) => set({ presence }),
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
      const userProfile = await matrixService.getUserProfile().catch(() => null);
      const myUserId = matrixService.getUserId() ?? userProfile?.userId ?? "";

      // Restaura URLs persistidas (sobrevivem a reload/F5)
      const persistedAvatar = localStorage.getItem("echo:appwriteAvatarUrl");
      const persistedBanner = localStorage.getItem("echo:appwriteBannerUrl");

      // Fonte da verdade: resposta da API Postgres quando disponível
      const avatar = userProfile ? (userProfile.avatarUrl ?? null) : (persistedAvatar ?? null);
      let banner = userProfile ? (userProfile.bannerUrl ?? null) : (persistedBanner ?? null);

      // Proteção contra vazamento do avatar no banner: se o banner for idêntico ao avatar e o banco não tiver banner explícito, descarta
      if (banner && (banner === avatar || banner === persistedAvatar)) {
        if (!userProfile?.bannerUrl) {
          banner = null;
          localStorage.removeItem("echo:appwriteBannerUrl");
        }
      }

      const nickname = userProfile?.nickname ?? userProfile?.displayName ?? null;
      const displayName = userProfile?.displayName ?? userProfile?.nickname ?? (myUserId ? myUserId.replace(/^@/, "").split(":")[0] : "");

      set({
        username: myUserId,
        nickname: nickname,
        displayName: displayName,
        avatarUrl: avatar,
        bannerUrl: banner,
        bio: userProfile?.bio ?? null,
        role: userProfile?.role ?? null,
        appwriteAvatarUrl: avatar,
        appwriteBannerUrl: banner,
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