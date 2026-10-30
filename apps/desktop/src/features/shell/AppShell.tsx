import { useEffect, useState, type ReactNode } from "react";
import { useBreakpoints } from "./useBreakpoints";
import CommunityRail from "./CommunityRail";
import ChannelSidebar from "./ChannelSidebar";
import ChatPane from "./ChatPane";
import MemberList from "./MemberList";
import SyncStatusIndicator from "./SyncStatusIndicator";
import EmptyState from "./EmptyState";
import HomePage from "./HomePage";
import CreateGuildModal from "@/features/guild/CreateGuildModal";
import Profile from "@/features/profile/Profile";
import Settings from "@/features/settings/Settings";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

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
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createGuildOpen, setCreateGuildOpen] = useState(false);

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
  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const isHome = activeGuildId === "home";
  const showEmptyState = guilds.length === 0 && !isHome;

  // Quando não há guildas e nenhuma seleção ativa, default para Home
  useEffect(() => {
    if (guilds.length === 0 && activeGuildId === null) {
      setActiveGuild("home");
    }
  }, [guilds.length, activeGuildId, setActiveGuild]);

  const handleOpenCreateGuild = () => setCreateGuildOpen(true);

  const handleCreateGuild = async (
    data: {
      name: string;
      iconUrl?: string | null;
      bannerUrl?: string | null;
      description?: string | null;
    },
  ): Promise<{ guildId: string; name: string; avatarUrl: string | null; unreadCount: number }> => {
    const guild = await matrixService.createGuild(data);
    return {
      guildId: guild.guildId,
      name: guild.name,
      avatarUrl: guild.avatarUrl,
      unreadCount: guild.unreadCount,
    };
  };

  const handleGuildCreated = (guild: { guildId: string; name: string }) => {
    setGuilds([
      ...guilds,
      { guildId: guild.guildId, name: guild.name, avatarUrl: null, unreadCount: 0 },
    ]);
    setCreateGuildOpen(false);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg font-ui text-txt">
      <CommunityRail
        onOpenProfile={() => setProfileOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {!isHome && (
        <>
          {sidebarOverlay ? (
            sidebarOpen && (
              <ChannelSidebar
                variant="overlay"
                onClose={() => setSidebarOpen(false)}
              />
            )
          ) : (
            <ChannelSidebar />
          )}
        </>
      )}

      <ChatPane
        showSidebarToggle={sidebarOverlay}
        showMembersToggle={!membersVisible}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onToggleMembers={() => setMembersOpen((open) => !open)}
      >
        {isHome ? (
          <HomePage />
        ) : showEmptyState ? (
          <EmptyState onCreateGuild={handleOpenCreateGuild} />
        ) : (
          children
        )}
      </ChatPane>

      {membersVisible ? (
        <MemberList />
      ) : (
        membersOpen && (
          <MemberList variant="overlay" onClose={() => setMembersOpen(false)} />
        )
      )}

      <SyncStatusIndicator />

      <Profile open={profileOpen} onClose={() => setProfileOpen(false)} />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <CreateGuildModal
        open={createGuildOpen}
        onClose={() => setCreateGuildOpen(false)}
        onCreate={handleCreateGuild}
        onCreated={handleGuildCreated}
      />
    </div>
  );
}