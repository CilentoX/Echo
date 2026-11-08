import {
  desktopConfig,
  desktopCache,
  getStorageInfo,
  type AppConfig,
  type AppCache,
} from "./desktopConfig";
import { useSyncStore } from "@/stores/syncStore";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";
import { useThemeStore } from "@/stores/themeStore";

export * from "./desktopConfig";

let initialized = false;

export const desktopStorage = {
  /**
   * Inicializa a configuração (config.json) e o cache (cache.json) do disco nativo.
   * Roda em poucos milissegundos no boot inicial.
   */
  async init(): Promise<{ config: AppConfig; cache: AppCache }> {
    if (initialized) {
      return { config: desktopConfig.getAll(), cache: desktopCache.getAll() };
    }

    const [config, cache] = await Promise.all([
      desktopConfig.init(),
      desktopCache.init(),
    ]);

    initialized = true;
    return { config, cache };
  },

  /**
   * Hidratação Instantânea de Boot (Zero Latency / Offline-First):
   * Popula imediatamente os stores da aplicação (tema, perfil, servidores e canais)
   * diretamente a partir do arquivo de configuração e cache local em disco,
   * permitindo que o cliente abra completamente renderizado antes mesmo de tocar na rede.
   */
  hydrateStoresFromLocal(): void {
    try {
      // 1. Tema & Modo (Dark/Light)
      const themeCfg = desktopConfig.get("theme");
      if (themeCfg) {
        if (themeCfg.themeId) useThemeStore.getState().setTheme(themeCfg.themeId);
        if (themeCfg.mode) useThemeStore.getState().setMode(themeCfg.mode);
      }

      // 2. Perfil do Usuário
      const user = desktopCache.get("currentUser");
      if (user && user.userId) {
        useProfileStore.setState({
          username: user.username || "",
          matrixUserId: user.userId,
          nickname: user.nickname,
          displayName: user.displayName || user.nickname || user.username,
          avatarUrl: user.avatarUrl,
          bannerUrl: user.bannerUrl,
          bio: user.bio || null,
          appwriteAvatarUrl: user.avatarUrl,
          appwriteBannerUrl: user.bannerUrl,
        });
        useUiStore.getState().setMyUserId(user.userId);
      }

      // 3. Guildas e Canais salvos do último uso
      const cachedGuilds = desktopCache.get("guilds");
      if (Array.isArray(cachedGuilds) && cachedGuilds.length > 0) {
        useSyncStore.getState().setGuilds(cachedGuilds);
      }

      const cachedChannels = desktopCache.get("channelsByGuild");
      if (cachedChannels && typeof cachedChannels === "object") {
        for (const [guildId, channels] of Object.entries(cachedChannels)) {
          if (Array.isArray(channels) && channels.length > 0) {
            useSyncStore.getState().setChannels(guildId, channels);
          }
        }
      }

      // 4. Última navegação ativa
      const nav = desktopConfig.get("navigation");
      if (nav?.lastActiveGuildId && nav.lastActiveGuildId !== "home") {
        useUiStore.getState().setActiveGuild(nav.lastActiveGuildId);
        if (nav.lastActiveChannelId) {
          // NUNCA restaura canal de voz como ativo ao iniciar o aplicativo
          const guildChannels =
            cachedChannels && typeof cachedChannels === "object"
              ? (cachedChannels as Record<string, any[]>)[nav.lastActiveGuildId]
              : null;
          const targetChannel = Array.isArray(guildChannels)
            ? guildChannels.find((c: any) => c.channelId === nav.lastActiveChannelId)
            : null;
          const isVoice =
            targetChannel?.type === "voice" ||
            nav.lastActiveChannelId.startsWith("ch-voice-") ||
            nav.lastActiveChannelId.startsWith("temp-voice-");

          if (isVoice) {
            const firstText = Array.isArray(guildChannels)
              ? guildChannels.find((c: any) => c.type !== "voice")
              : null;
            useUiStore.getState().setActiveChannel(firstText?.channelId ?? null);
          } else {
            useUiStore.getState().setActiveChannel(nav.lastActiveChannelId);
          }
        }
      }
    } catch (err) {
      console.warn("[desktopStorage] Falha ao hidratar stores a partir do cache local:", err);
    }
  },

  getStorageInfo,
};
