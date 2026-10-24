import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChannelSummary, GuildSummary } from "@/lib/matrix/types";
import ChannelSidebar from "@/features/shell/ChannelSidebar";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

const GUILD: GuildSummary = {
  guildId: "!g1:hs",
  name: "Echo Guild",
  avatarUrl: null,
  unreadCount: 0,
};

function makeChannel(overrides: Partial<ChannelSummary> = {}): ChannelSummary {
  return {
    channelId: "!c1:hs",
    name: "geral",
    unreadCount: 0,
    ...overrides,
  };
}

function resetStores() {
  useSyncStore.setState({
    status: "connecting",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
  });
  useUiStore.setState({ activeGuildId: null, activeChannelId: null });
}

describe("ChannelSidebar", () => {
  beforeEach(resetStores);

  it("renderiza os canais da guilda ativa", () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [
      makeChannel(),
      makeChannel({ channelId: "!c2:hs", name: "design" }),
    ]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    render(<ChannelSidebar />);

    expect(screen.getByRole("button", { name: "geral" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "design" })).toBeTruthy();
  });

  it("mostra o nome da guilda ativa no cabeçalho", () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [makeChannel()]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    render(<ChannelSidebar />);

    expect(screen.getByText("Echo Guild")).toBeTruthy();
  });

  it("clique no canal o seleciona no uiStore (activeChannelId)", async () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [
      makeChannel(),
      makeChannel({ channelId: "!c2:hs", name: "design" }),
    ]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    render(<ChannelSidebar />);

    await userEvent.click(screen.getByRole("button", { name: "design" }));

    expect(useUiStore.getState().activeChannelId).toBe("!c2:hs");
  });

  it("o canal ativo fica com destaque (aria-current)", () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [
      makeChannel(),
      makeChannel({ channelId: "!c2:hs", name: "design" }),
    ]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    useUiStore.getState().setActiveChannel("!c2:hs");
    render(<ChannelSidebar />);

    expect(screen.getByRole("button", { name: "design" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "geral" }).getAttribute("aria-current")).toBeNull();
  });

  it("store sem guildas → estado vazio 'Nenhuma guilda ainda' (Review Focus 2)", () => {
    render(<ChannelSidebar />);

    expect(screen.getByText("Nenhuma guilda ainda.")).toBeTruthy();
  });
});
