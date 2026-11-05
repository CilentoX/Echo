import { useEffect, useState, type ReactNode } from "react";
import { useBreakpoints } from "./useBreakpoints";
import CommunityRail from "./CommunityRail";
import ChannelSidebar from "./ChannelSidebar";
import ChatPane from "./ChatPane";
import MemberList from "./MemberList";
import UserBar from "./UserBar";
import VoiceConnectionBar from "./VoiceConnectionBar";
import SyncStatusIndicator from "./SyncStatusIndicator";
import EmptyState from "./EmptyState";
import HomeSidebar from "./HomeSidebar";
import FriendsDashboard from "@/features/friends/FriendsDashboard";
import CreateGuildModal from "@/features/guild/CreateGuildModal";
import JoinGuildModal from "@/features/guild/JoinGuildModal";
import Profile from "@/features/profile/Profile";
import Settings from "@/features/settings/Settings";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { isTauri } from "@/lib/updater";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface AppShellProps {
  /** Chat area content; placeholder messages are shown when omitted. */
  children?: ReactNode;
}

/**
 * Responsive 4-column app skeleton:
 * community rail (72px) | channel sidebar (232px) | chat (flex) | member list (224px).
 *
 * - The rail never disappears.
 * - Below 900px the sidebar becomes an overlay opened from the chat header.
 * - Below 1150px the member list is hidden (toggleable as an overlay).
 * - Profile and Settings are right-edge sheets opened from the rail.
 */
export default function AppShell({ children }: AppShellProps) {
  const { membersVisible, sidebarOverlay } = useBreakpoints();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const profileOpen = useUiStore((state) => state.isProfileOpen);
  const profileInitialTab = useUiStore((state) => state.profileInitialTab);
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const isJoinGuildOpen = useUiStore((state) => state.isJoinGuildOpen);
  const joinGuildInitialCode = useUiStore((state) => state.joinGuildInitialCode);
  const setJoinGuildOpen = useUiStore((state) => state.setJoinGuildOpen);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createGuildOpen, setCreateGuildOpen] = useState(false);

  // Deep linking e verificação de instância única
  useEffect(() => {
    if (!isTauri()) return;

    // Checa se o app foi aberto com convite na linha de comando
    invoke<string | null>("get_launch_invite_code")
      .then((code) => {
        if (code) {
          setJoinGuildOpen(true, code);
        }
      })
      .catch((err) => {
        console.warn("[invite] Falha ao verificar código de inicialização:", err);
      });

    // Ouve evento emitido pela verificação de instância única
    const unlistenPromise = listen<string[]>("single-instance", (event) => {
      const args = Array.isArray(event.payload) ? event.payload : [];
      for (const arg of args) {
        const match = arg.match(/echo:\/\/invite\/([a-zA-Z0-9_-]+)/i);
        if (match?.[1]) {
          setJoinGuildOpen(true, match[1]);
          break;
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [setJoinGuildOpen]);

  // Crossing a breakpoint changes the layout mode; stale overlay
  // state must not make panels reappear open on the way back.
  useEffect(() => {
    setSidebarOpen(false);
  }, [sidebarOverlay]);

  useEffect(() => {
    setMembersOpen(false);
  }, [membersVisible]);

  const guilds = useSyncStore((s) => s.guilds);
  const setGuilds = useSyncStore((s) => s.setGuilds);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const isHome = activeGuildId === "home";
  const showEmptyState = guilds.length === 0 && !isHome;

  const handleOpenCreateGuild = () => setCreateGuildOpen(true);

  const myUserId = useUiStore((s) => s.myUserId);

  const handleCreateGuild = async (
    data: {
      name: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    },
  ): Promise<{ guildId: string; name: string; avatarUrl: string | null; unreadCount: number }> => {
    if (!myUserId) throw new Error("User not logged in");
    const guild = await matrixService.createGuild(data, myUserId);
    return {
      guildId: guild.guildId,
      name: guild.name,
      avatarUrl: guild.avatarUrl,
      unreadCount: guild.unreadCount,
    };
  };

  const handleGuildCreated = (guild: { guildId: string; name: string; avatarUrl?: string | null }) => {
    setGuilds([
      ...guilds,
      { guildId: guild.guildId, name: guild.name, avatarUrl: guild.avatarUrl ?? null, unreadCount: 0 },
    ]);
    useUiStore.getState().setActiveGuild(guild.guildId);
    setCreateGuildOpen(false);
  };

  const handleGuildJoined = (guild: { guildId: string; name: string }) => {
    // Evita duplicar se já estiver na lista
    if (!guilds.some((g) => g.guildId === guild.guildId)) {
      setGuilds([
        ...guilds,
        { guildId: guild.guildId, name: guild.name, avatarUrl: null, unreadCount: 0 },
      ]);
    }
    useUiStore.getState().setActiveGuild(guild.guildId);
    useUiStore.getState().setActiveChannel(null);
    setJoinGuildOpen(false);
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-bg font-ui text-txt">
      {/* Área Principal de Navegação e Conteúdo ("|") */}
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        <CommunityRail
          onOpenProfile={() => setProfileOpen(true, "profile")}
          onOpenSettings={() => setProfileOpen(true, "appearance")}
          onOpenCreate={() => setCreateGuildOpen(true)}
          onOpenJoin={() => setJoinGuildOpen(true)}
        />

        {isHome ? (
          sidebarOverlay ? (
            sidebarOpen && (
              <HomeSidebar
                variant="overlay"
                onClose={() => setSidebarOpen(false)}
              />
            )
          ) : (
            <HomeSidebar />
          )
        ) : (
          sidebarOverlay ? (
            sidebarOpen && (
              <ChannelSidebar
                variant="overlay"
                onClose={() => setSidebarOpen(false)}
                onOpenProfile={() => setProfileOpen(true, "profile")}
                onOpenSettings={() => setProfileOpen(true, "appearance")}
              />
            )
          ) : (
            <ChannelSidebar
              onOpenProfile={() => setProfileOpen(true, "profile")}
              onOpenSettings={() => setProfileOpen(true, "appearance")}
            />
          )
        )}

        <ChatPane
          showSidebarToggle={sidebarOverlay}
          showMembersToggle={!isHome && !membersVisible}
          onToggleSidebar={() => setSidebarOpen((open) => !open)}
          onToggleMembers={() => setMembersOpen((open) => !open)}
        >
          {isHome ? (
            activeChannelId ? (
              children
            ) : (
              <FriendsDashboard />
            )
          ) : showEmptyState ? (
            <EmptyState onCreateGuild={handleOpenCreateGuild} />
          ) : (
            children
          )}
        </ChatPane>

        {!isHome && (
          membersVisible ? (
            <MemberList />
          ) : (
            membersOpen && (
              <MemberList variant="overlay" onClose={() => setMembersOpen(false)} />
            )
          )
        )}
      </div>

      {/* Dock Inferior Persistente ("___") que ancora toda a extensão da aplicação */}
      <div className="flex flex-col shrink-0">
        <VoiceConnectionBar onOpenVoiceSettings={() => setProfileOpen(true, "voice")} />
        <UserBar
          onOpenProfile={() => setProfileOpen(true, "profile")}
          onOpenSettings={() => setProfileOpen(true, "appearance")}
          onOpenVoiceSettings={() => setProfileOpen(true, "voice")}
        />
      </div>

      <SyncStatusIndicator />

      <Profile
        open={profileOpen}
        initialTab={(profileInitialTab as any) || "profile"}
        onClose={() => setProfileOpen(false)}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CreateGuildModal
        open={createGuildOpen}
        onClose={() => setCreateGuildOpen(false)}
        onCreate={handleCreateGuild}
        onCreated={handleGuildCreated}
        onOpenJoin={() => {
          setCreateGuildOpen(false);
          setJoinGuildOpen(true);
        }}
      />

      <JoinGuildModal
        open={isJoinGuildOpen}
        initialCode={joinGuildInitialCode}
        onClose={() => setJoinGuildOpen(false)}
        onJoined={handleGuildJoined}
        onOpenCreate={() => {
          setJoinGuildOpen(false);
          setCreateGuildOpen(true);
        }}
      />
    </div>
  );
}