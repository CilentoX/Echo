import { describe, expect, it, beforeEach } from "vitest";
import { desktopConfig, desktopCache, desktopStorage } from "@/lib/storage/desktopStore";
import { useThemeStore } from "@/stores/themeStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

describe("Desktop Storage & Cache System (Discord-Style)", () => {
  beforeEach(() => {
    localStorage.clear();
    desktopConfig.__resetForTesting();
    desktopCache.__resetForTesting();
  });

  it("salva e recupera configurações de tema do desktopConfig", async () => {
    await desktopConfig.init();

    desktopConfig.setTheme({ themeId: "sakura", mode: "light", density: "compact" });

    const theme = desktopConfig.get("theme");
    expect(theme.themeId).toBe("sakura");
    expect(theme.mode).toBe("light");
    expect(theme.density).toBe("compact");
  });

  it("persiste e valida flags de onboarding por usuário", () => {
    expect(desktopConfig.isOnboardingCompleted("@user1:hs")).toBe(false);

    desktopConfig.setOnboardingCompleted("@user1:hs", true);
    expect(desktopConfig.isOnboardingCompleted("@user1:hs")).toBe(true);
    expect(desktopConfig.isOnboardingCompleted("@user2:hs")).toBe(false);
  });

  it("cacheia e recupera perfil de usuário e guildas no desktopCache", async () => {
    await desktopCache.init();

    desktopCache.cacheUserProfile({
      userId: "@lucas:echo.litteris.online",
      username: "lucas",
      nickname: "Lucas Cilento",
      displayName: "Lucas",
      avatarUrl: "mxc://example/avatar",
      bannerUrl: "mxc://example/banner",
      bio: "Echo dev",
    });

    const cachedUser = desktopCache.get("currentUser");
    expect(cachedUser?.userId).toBe("@lucas:echo.litteris.online");
    expect(cachedUser?.nickname).toBe("Lucas Cilento");

    desktopCache.cacheGuilds([
      {
        guildId: "!guild1:hs",
        name: "Comunidade Echo",
        avatarUrl: null,
        unreadCount: 0,
      },
    ]);

    const cachedGuilds = desktopCache.get("guilds");
    expect(cachedGuilds).toHaveLength(1);
    expect(cachedGuilds?.[0].name).toBe("Comunidade Echo");
  });

  it("hydrateStoresFromLocal popula imediatamente todos os stores no boot (0ms offline-first)", () => {
    desktopConfig.setTheme({ themeId: "sunset", mode: "dark" });
    desktopCache.cacheUserProfile({
      userId: "@offline:echo",
      username: "offline_user",
      nickname: "User Offline",
      displayName: "Offline",
      avatarUrl: "mxc://avatar",
      bannerUrl: null,
    });
    desktopCache.cacheGuilds([
      {
        guildId: "!offline_guild:echo",
        name: "Guilda em Cache",
        avatarUrl: null,
        unreadCount: 2,
      },
    ]);
    desktopCache.cacheChannels("!offline_guild:echo", [
      {
        channelId: "!chan_cached:echo",
        name: "bate-papo",
        type: "text",
        unreadCount: 0,
      },
    ]);
    desktopConfig.set("navigation", {
      lastActiveGuildId: "!offline_guild:echo",
      lastActiveChannelId: "!chan_cached:echo",
    });

    // Executa a hidratação instantânea de boot
    desktopStorage.hydrateStoresFromLocal();

    // Valida que os stores foram preenchidos imediatamente sem requisição de rede
    expect(useThemeStore.getState().themeId).toBe("sunset");
    expect(useProfileStore.getState().matrixUserId).toBe("@offline:echo");
    expect(useProfileStore.getState().nickname).toBe("User Offline");

    const guilds = useSyncStore.getState().guilds;
    expect(guilds.some((g) => g.guildId === "!offline_guild:echo")).toBe(true);

    const channels = useSyncStore.getState().channelsByGuild["!offline_guild:echo"];
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("bate-papo");

    expect(useUiStore.getState().activeGuildId).toBe("!offline_guild:echo");
    expect(useUiStore.getState().activeChannelId).toBe("!chan_cached:echo");
  });
});
