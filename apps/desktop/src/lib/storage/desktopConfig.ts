import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/updater";
import type { ThemeId, ThemeMode } from "@/stores/themeStore";
import type { GuildSummary, ChannelSummary } from "@/lib/matrix/types";

export type { ThemeId, ThemeMode };

export interface AppThemeConfig {
  themeId: ThemeId;
  mode: ThemeMode;
  density: "compact" | "comfortable";
}

export interface AppAudioConfig {
  inputDeviceId?: string | null;
  outputDeviceId?: string | null;
  inputVolume?: number;
  outputVolume?: number;
  muted?: boolean;
  deafened?: boolean;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  inputMode?: "voice_activity" | "push_to_talk";
  pushToTalkKey?: string;
}

export interface AppNavigationConfig {
  lastActiveGuildId?: string | null;
  lastActiveChannelId?: string | null;
  sidebarOpen?: boolean;
}

export interface AppUserFlagsConfig {
  onboardingCompleted?: Record<string, boolean>; // userId -> completed
}

export interface AppConfig {
  version: number;
  theme: AppThemeConfig;
  audio?: AppAudioConfig;
  navigation?: AppNavigationConfig;
  userFlags?: AppUserFlagsConfig;
  [key: string]: any;
}

export interface CachedUserProfile {
  userId: string;
  username: string;
  nickname: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio?: string | null;
}

export interface AppCache {
  version: number;
  updatedAt: string;
  currentUser?: CachedUserProfile | null;
  guilds?: GuildSummary[];
  channelsByGuild?: Record<string, ChannelSummary[]>;
  friends?: any[];
  [key: string]: any;
}

export interface StorageInfo {
  dirPath: string;
  configFilePath: string;
  cacheFilePath: string;
  configSizeBytes: number;
  cacheSizeBytes: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  theme: {
    themeId: "echo",
    mode: "dark",
    density: "comfortable",
  },
  audio: {
    inputDeviceId: null,
    outputDeviceId: null,
    inputVolume: 100,
    outputVolume: 100,
    muted: false,
    deafened: false,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    inputMode: "voice_activity",
    pushToTalkKey: "ControlLeft",
  },
  navigation: {
    lastActiveGuildId: "home",
    lastActiveChannelId: null,
  },
  userFlags: {
    onboardingCompleted: {},
  },
};

export const DEFAULT_CACHE: AppCache = {
  version: 1,
  updatedAt: new Date().toISOString(),
  currentUser: null,
  guilds: [],
  channelsByGuild: {},
  friends: [],
};

// In-memory hot cache para respostas síncronas instantâneas (< 0.1ms)
let memConfig: AppConfig = { ...DEFAULT_CONFIG };
let memCache: AppCache = { ...DEFAULT_CACHE };

// Fallbacks para compatibilidade web/vitest
const LOCAL_STORAGE_CONFIG_KEY = "echo:desktop:config";
const LOCAL_STORAGE_CACHE_KEY = "echo:desktop:cache";

function readLocalFallback<T>(key: string, fallback: T): T {
  if (typeof window === "undefined" || !window.localStorage) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalFallback(key: string, val: any): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export const desktopConfig = {
  /** Inicializa a configuração a partir do arquivo config.json ou localStorage */
  async init(): Promise<AppConfig> {
    if (isTauri()) {
      try {
        const diskConfig = await invoke<AppConfig>("read_app_config");
        memConfig = {
          ...DEFAULT_CONFIG,
          ...diskConfig,
          theme: { ...DEFAULT_CONFIG.theme, ...(diskConfig?.theme || {}) },
          userFlags: { ...DEFAULT_CONFIG.userFlags, ...(diskConfig?.userFlags || {}) },
        };
      } catch (err) {
        console.warn("[desktopConfig] Falha ao ler config.json nativo:", err);
        memConfig = readLocalFallback(LOCAL_STORAGE_CONFIG_KEY, DEFAULT_CONFIG);
      }
    } else {
      memConfig = readLocalFallback(LOCAL_STORAGE_CONFIG_KEY, DEFAULT_CONFIG);
    }
    return memConfig;
  },

  /** Obtém um valor de configuração sincronamente da memória quente */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return memConfig[key] ?? DEFAULT_CONFIG[key];
  },

  /** Retorna todo o snapshot de configuração */
  getAll(): AppConfig {
    return { ...memConfig };
  },

  /** Atualiza uma chave de configuração com persistência assíncrona atômica */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    memConfig[key] = value;
    writeLocalFallback(LOCAL_STORAGE_CONFIG_KEY, memConfig);

    if (isTauri()) {
      invoke("update_app_config_key", { key: String(key), value }).catch((err) => {
        console.warn(`[desktopConfig] Erro ao persistir chave ${String(key)}:`, err);
      });
    }
  },

  /** Atualiza propriedades de tema */
  setTheme(updates: Partial<AppThemeConfig>): void {
    const current = desktopConfig.get("theme") || DEFAULT_CONFIG.theme;
    const next = { ...current, ...updates };
    desktopConfig.set("theme", next);
  },

  /** Marca onboarding para um usuário */
  setOnboardingCompleted(userId: string, completed = true): void {
    const flags = desktopConfig.get("userFlags") || { onboardingCompleted: {} };
    const onboarding = { ...(flags.onboardingCompleted || {}), [userId]: completed };
    desktopConfig.set("userFlags", { ...flags, onboardingCompleted: onboarding });
  },

  /** Verifica onboarding para um usuário */
  isOnboardingCompleted(userId: string): boolean {
    const flags = desktopConfig.get("userFlags");
    if (flags?.onboardingCompleted && flags.onboardingCompleted[userId] !== undefined) {
      return Boolean(flags.onboardingCompleted[userId]);
    }
    if (typeof window !== "undefined" && window.localStorage) {
      return localStorage.getItem(`echo:onboarding:completed:${userId}`) === "1" ||
             localStorage.getItem("echo:onboarding:completed") === "1";
    }
    return false;
  },

  __resetForTesting(): void {
    memConfig = { ...DEFAULT_CONFIG };
  },
};

export const desktopCache = {
  __resetForTesting(): void {
    memCache = { ...DEFAULT_CACHE };
  },

  /** Inicializa o cache offline a partir de cache.json */
  async init(): Promise<AppCache> {
    if (isTauri()) {
      try {
        const diskCache = await invoke<AppCache>("read_app_cache");
        memCache = {
          ...DEFAULT_CACHE,
          ...diskCache,
          guilds: diskCache?.guilds ?? [],
          channelsByGuild: diskCache?.channelsByGuild ?? {},
        };
      } catch (err) {
        console.warn("[desktopCache] Falha ao ler cache.json nativo:", err);
        memCache = readLocalFallback(LOCAL_STORAGE_CACHE_KEY, DEFAULT_CACHE);
      }
    } else {
      memCache = readLocalFallback(LOCAL_STORAGE_CACHE_KEY, DEFAULT_CACHE);
    }
    return memCache;
  },

  get<K extends keyof AppCache>(key: K): AppCache[K] {
    return memCache[key] ?? DEFAULT_CACHE[key];
  },

  getAll(): AppCache {
    return { ...memCache };
  },

  set<K extends keyof AppCache>(key: K, value: AppCache[K]): void {
    memCache[key] = value;
    memCache.updatedAt = new Date().toISOString();
    writeLocalFallback(LOCAL_STORAGE_CACHE_KEY, memCache);

    if (isTauri()) {
      invoke("update_app_cache_key", { key: String(key), value }).catch((err) => {
        console.warn(`[desktopCache] Erro ao persistir cache ${String(key)}:`, err);
      });
    }
  },

  cacheUserProfile(profile: CachedUserProfile | null): void {
    desktopCache.set("currentUser", profile);
  },

  cacheGuilds(guilds: GuildSummary[]): void {
    desktopCache.set("guilds", guilds);
  },

  cacheChannels(guildId: string, channels: ChannelSummary[]): void {
    const map = desktopCache.get("channelsByGuild") || {};
    desktopCache.set("channelsByGuild", { ...map, [guildId]: channels });
  },

  async clear(): Promise<void> {
    memCache = { ...DEFAULT_CACHE };
    writeLocalFallback(LOCAL_STORAGE_CACHE_KEY, memCache);
    try {
      const { clearMediaDiskCache } = await import("@/lib/media/mediaDiskCache");
      await clearMediaDiskCache();
    } catch {}
    if (isTauri()) {
      try {
        await invoke("clear_app_cache");
      } catch (err) {
        console.warn("[desktopCache] Erro ao limpar cache:", err);
      }
    }
  },
};

export const getStorageInfo = async (): Promise<StorageInfo | null> => {
  if (!isTauri()) return null;
  try {
    return await invoke<StorageInfo>("get_app_storage_info");
  } catch {
    return null;
  }
};
