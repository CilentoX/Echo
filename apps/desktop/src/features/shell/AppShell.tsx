import { useEffect, useState, type ReactNode } from "react";
import { useBreakpoints } from "./useBreakpoints";
import CommunityRail from "./CommunityRail";
import ChannelSidebar from "./ChannelSidebar";
import ChatPane from "./ChatPane";
import MemberList from "./MemberList";
import SyncStatusIndicator from "./SyncStatusIndicator";
import EmptyState from "./EmptyState";
import Profile from "@/features/profile/Profile";
import Settings from "@/features/settings/Settings";
import { useSyncStore } from "@/stores/syncStore";

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

  // Crossing a breakpoint changes the layout mode; stale overlay
  // state must not make panels reappear open on the way back.
  useEffect(() => {
    setSidebarOpen(false);
  }, [sidebarOverlay]);

  useEffect(() => {
    setMembersOpen(false);
  }, [membersVisible]);

  const guilds = useSyncStore((s) => s.guilds);
  const showEmptyState = guilds.length === 0;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg font-ui text-txt">
      <CommunityRail
        onOpenProfile={() => setProfileOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

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

      <ChatPane
        showSidebarToggle={sidebarOverlay}
        showMembersToggle={!membersVisible}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onToggleMembers={() => setMembersOpen((open) => !open)}
      >
        {showEmptyState ? <EmptyState /> : children}
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
    </div>
  );
}