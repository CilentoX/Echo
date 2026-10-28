import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { startSyncWiring, stopSyncWiring, loadOlder, __resetWiringState } from "@/lib/matrix/wiring";
import { matrixService } from "@/lib/matrix/instance";
import type { GuildSummary, ChannelSummary, NormalizedEvent, MemberSummary } from "@/lib/matrix/types";

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    listGuilds: vi.fn(),
    listChannels: vi.fn(),
    listMembers: vi.fn(),
    loadOlder: vi.fn(),
    stopSync: vi.fn(),
    startSyncHandlers: vi.fn((handlers: any) => {
      (matrixService as any).__handlers = handlers;
    }),
  },
}));

const GUILD: GuildSummary = {
  guildId: "!g1:hs",
  name: "Echo Guild",
  avatarUrl: null,
  unreadCount: 0,
};

const CHANNEL: ChannelSummary = {
  channelId: "!c1:hs",
  name: "geral",
  unreadCount: 0,
  type: "text",
};

const MEMBER: MemberSummary = {
  userId: "@me:hs",
  displayName: "Me",
  presence: "online",
};

function getMocks() {
  return {
    listGuilds: matrixService.listGuilds as ReturnType<typeof vi.fn>,
    listChannels: matrixService.listChannels as ReturnType<typeof vi.fn>,
    listMembers: matrixService.listMembers as ReturnType<typeof vi.fn>,
    loadOlder: matrixService.loadOlder as ReturnType<typeof vi.fn>,
    stopSync: matrixService.stopSync as ReturnType<typeof vi.fn>,
    startSyncHandlers: matrixService.startSyncHandlers as ReturnType<typeof vi.fn>,
  };
}

function resetStores() {
  useSyncStore.setState({
    status: "connecting",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
    reactionsByEvent: {},
    membersByRoom: {},
    readByChannel: {},
  });
  useUiStore.setState({
    myUserId: null,
    activeGuildId: null,
    activeChannelId: null,
    typingUsers: {},
    presence: {},
  });
  // Reset wiring internal state
  __resetWiringState();
  vi.clearAllMocks();
}

describe("wiring.ts - Critical Auth/Sync Bugs (B11, B1, B4)", () => {
  beforeEach(resetStores);

  it("B11: fresh login loads guilds, channels, members and selects first channel", async () => {
    const onAuthFailure = vi.fn();
    const guilds = [GUILD];
    const channels = [CHANNEL];
    const members = [MEMBER];

    const mocks = getMocks();
    mocks.listGuilds.mockResolvedValue(guilds);
    mocks.listChannels.mockResolvedValue(channels);
    mocks.listMembers.mockResolvedValue(members);

    startSyncWiring(onAuthFailure);

    // Trigger the first sync status transition to "syncing"
    const handlers = (matrixService as any).__handlers;
    if (handlers?.onStatus) {
      await handlers.onStatus("syncing");
    }

    await vi.waitFor(() => expect(useSyncStore.getState().guilds).toEqual(guilds));
    await vi.waitFor(() => expect(useSyncStore.getState().channelsByGuild[GUILD.guildId]).toEqual(channels));
    await vi.waitFor(() => expect(useSyncStore.getState().membersByRoom[CHANNEL.channelId]).toEqual(members));
    expect(useUiStore.getState().activeChannelId).toBe(CHANNEL.channelId);
    expect(useUiStore.getState().activeGuildId).toBe(GUILD.guildId);
  });

  it("B1: auth error (M_UNKNOWN_TOKEN) at any time calls onAuthFailure", async () => {
    const onAuthFailure = vi.fn();
    startSyncWiring(onAuthFailure);

    const handlers = (matrixService as any).__handlers;
    if (handlers?.onStatus) {
      // Simulate auth error after successful syncs
      await handlers.onStatus("error", { errcode: "M_UNKNOWN_TOKEN" });
    }

    expect(onAuthFailure).toHaveBeenCalled();
  });

  it("B1: network error does NOT call onAuthFailure", async () => {
    const onAuthFailure = vi.fn();
    startSyncWiring(onAuthFailure);

    const handlers = (matrixService as any).__handlers;
    if (handlers?.onStatus) {
      await handlers.onStatus("error", { errcode: "M_UNKNOWN" }); // generic network error
    }

    expect(onAuthFailure).not.toHaveBeenCalled();
  });

  it("B4: guild name does not become room ID after relogin - guilds loaded before UI reads", async () => {
    const onAuthFailure = vi.fn();
    const guilds = [GUILD];
    const channels = [CHANNEL];
    const members = [MEMBER];

    const mocks = getMocks();
    mocks.listGuilds.mockResolvedValue(guilds);
    mocks.listChannels.mockResolvedValue(channels);
    mocks.listMembers.mockResolvedValue(members);

    startSyncWiring(onAuthFailure);

    // First sync - loads data
    const handlers = (matrixService as any).__handlers;
    if (handlers?.onStatus) {
      await handlers.onStatus("syncing");
    }

    await vi.waitFor(() => expect(useSyncStore.getState().guilds).toEqual(guilds));

    // Verify activeGuild is found correctly (not null, not room ID)
    const state = useSyncStore.getState();
    const activeGuildId = useUiStore.getState().activeGuildId;
    const activeGuild = state.guilds.find((g) => g.guildId === activeGuildId);
    
    expect(activeGuild).not.toBeNull();
    expect(activeGuild?.name).toBe("Echo Guild");
    expect(activeGuild?.name).not.toBe(activeGuildId); // name should not be room ID
  });
});

describe("wiring.ts - loadOlder / Message History (B6)", () => {
  beforeEach(resetStores);

  it("B6: loadOlder prepends events without duplicates", async () => {
    const oldEvents: NormalizedEvent[] = [
      { eventId: "old-1", roomId: "!c1:hs", sender: "@a:hs", body: "old", originServerTs: 1000 },
      { eventId: "old-2", roomId: "!c1:hs", sender: "@a:hs", body: "older", originServerTs: 500 },
    ];
    const mocks = getMocks();
    mocks.loadOlder.mockResolvedValue(oldEvents);

    // Seed timeline with existing event
    useSyncStore.getState().applyEvent({
      eventId: "existing",
      roomId: "!c1:hs",
      sender: "@b:hs",
      body: "existing",
      originServerTs: 2000,
    });

    await loadOlder("!c1:hs", 20);

    const timeline = useSyncStore.getState().timelineByChannel["!c1:hs"];
    // Should be ordered oldest first: old-2, old-1, existing
    expect(timeline.map((e) => e.eventId)).toEqual(["old-2", "old-1", "existing"]);
  });

  it("B6: loadOlder does not duplicate events already in timeline", async () => {
    const oldEvents: NormalizedEvent[] = [
      { eventId: "old-1", roomId: "!c1:hs", sender: "@a:hs", body: "old", originServerTs: 1000 },
      { eventId: "existing", roomId: "!c1:hs", sender: "@b:hs", body: "existing", originServerTs: 2000 }, // duplicate
    ];
    const mocks = getMocks();
    mocks.loadOlder.mockResolvedValue(oldEvents);

    useSyncStore.getState().applyEvent({
      eventId: "existing",
      roomId: "!c1:hs",
      sender: "@b:hs",
      body: "existing",
      originServerTs: 2000,
    });

    await loadOlder("!c1:hs", 20);

    const timeline = useSyncStore.getState().timelineByChannel["!c1:hs"];
    const counts = timeline.reduce((acc, e) => {
      acc[e.eventId] = (acc[e.eventId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Each event should appear exactly once
    Object.values(counts).forEach((count) => expect(count).toBe(1));
  });
});

describe("wiring.ts - stopSyncWiring / Logout (B2)", () => {
  beforeEach(resetStores);

  it("B2: stopSyncWiring resets all state and calls matrixService.stopSync", () => {
    // Setup some state
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [CHANNEL]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    useUiStore.getState().setActiveChannel(CHANNEL.channelId);
    useUiStore.getState().setMyUserId("@me:hs");

    stopSyncWiring();

    const mocks = getMocks();
    expect(mocks.stopSync).toHaveBeenCalled();
    expect(useSyncStore.getState().guilds).toEqual([]);
    expect(useSyncStore.getState().channelsByGuild).toEqual({});
    expect(useUiStore.getState().myUserId).toBeNull();
    expect(useUiStore.getState().activeGuildId).toBeNull();
    expect(useUiStore.getState().activeChannelId).toBeNull();
    expect(useSyncStore.getState().status).toBe("connecting");
  });
});