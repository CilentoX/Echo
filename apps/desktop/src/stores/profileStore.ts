import { create } from "zustand";
import { matrixService } from "@/lib/matrix/instance";
import { loadSession } from "@/lib/storage/keyring";
import { desktopCache } from "@/lib/storage/desktopConfig";

export interface ProfileLink {
  label: string;
  url: string;
}

export interface CustomStatus {
  emoji?: string;
  text: string;
}

export interface ProfileState {
  /** Dados do próprio usuário (preenchidos no login / edição de perfil). */
  displayName: string;
  username: string;           // Username único sem @ e sem domínio, ex: lucas
  matrixUserId: string;       // MXID Matrix interno completo, ex: @lucas:litteris.online
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
  customStatus?: CustomStatus | null;

  setDisplayName(name: string): void;
  setUsername(username: string): void;
  setNickname(nickname: string | null): void;
  setBio(bio: string | null): void;
  setRole(role: string | null): void;
  setAvatarUrl(url: string | null): void;
  setBannerUrl(url: string | null): void;
  setAppwriteAvatarUrl(url: string | null): void;
  setAppwriteBannerUrl(url: string | null): void;
  setPresence?(presence: "online" | "offline" | "unavailable" | "idle" | "dnd"): void;
  setCustomStatus(status: CustomStatus | null): void;
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
  matrixUserId: "",
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
  customStatus: (() => {
    try {
      const raw = localStorage.getItem("echo:customStatus");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })(),

  setDisplayName: (name) => set({ displayName: name }),
  setUsername: (username) => set({ username }),
  setNickname: (nickname) => set({ nickname }),
  setBio: (bio) => set({ bio }),
  setRole: (role) => set({ role }),
  setAvatarUrl: (url) => set({ avatarUrl: url }),
  setBannerUrl: (url) => set({ bannerUrl: url }),
  setPresence: (presence) => set({ presence }),
  setCustomStatus: (status) => {
    set({ customStatus: status });
    if (status) {
      try {
        localStorage.setItem("echo:customStatus", JSON.stringify(status));
      } catch {}
    } else {
      try {
        localStorage.removeItem("echo:customStatus");
      } catch {}
    }
  },
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
      // Garante que há token de acesso antes de disparar consulta à API
      let activeToken = matrixService.getAccessToken?.() ?? (matrixService as any).accessToken;
      if (!activeToken) {
        const session = await loadSession().catch(() => null);
        if (session?.accessToken) {
          matrixService.setAccessToken?.(session.accessToken, session.userId);
          activeToken = session.accessToken;
        }
      }
      if (!activeToken) {
        // Usuário ainda não autenticado; pula consulta remota sem gerar 401
        return;
      }

      const userProfile = await matrixService.getUserProfile().catch(() => null);
      const myUserId = matrixService.getUserId() ?? userProfile?.userId ?? "";
      const fallbackUsername = myUserId ? myUserId.replace(/^@/, "").split(":")[0] : "";
      const resolvedUsername = userProfile?.username || fallbackUsername;

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
      const displayName = userProfile?.displayName ?? userProfile?.nickname ?? resolvedUsername;

      set({
        username: resolvedUsername,
        matrixUserId: myUserId,
        nickname: nickname,
        displayName: displayName,
        avatarUrl: avatar,
        bannerUrl: banner,
        bio: userProfile?.bio ?? null,
        role: userProfile?.role ?? null,
        appwriteAvatarUrl: avatar,
        appwriteBannerUrl: banner,
      });

      // Persiste no cache offline local (cache.json)
      try {
        desktopCache.cacheUserProfile({
          userId: myUserId,
          username: resolvedUsername,
          nickname,
          displayName,
          avatarUrl: avatar,
          bannerUrl: banner,
          bio: userProfile?.bio ?? null,
        });
      } catch {}
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
    localStorage.removeItem("echo:customStatus");
    try {
      desktopCache.cacheUserProfile(null);
    } catch {}
    set({
      displayName: "",
      username: "",
      matrixUserId: "",
      nickname: null,
      avatarUrl: null,
      bannerUrl: null,
      appwriteAvatarUrl: null,
      appwriteBannerUrl: null,
      bio: null,
      role: null,
      joinedAt: null,
      links: [],
      customStatus: null,
    });
  },
}));

export const selectProfile = (state: ProfileState) => state;