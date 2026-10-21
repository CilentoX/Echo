import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { GuildSummary } from "@/lib/matrix/types";
import CommunityRail from "@/features/shell/CommunityRail";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

function makeGuild(overrides: Partial<GuildSummary> = {}): GuildSummary {
  return {
    guildId: "!g1:hs",
    name: "Eco Guild",
    avatarUrl: null,
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

describe("CommunityRail", () => {
  beforeEach(resetStores);

  it("renderiza as guildas do store pelo nome", () => {
    useSyncStore.getState().setGuilds([
      makeGuild({ name: "Eco Guild" }),
      makeGuild({ guildId: "!g2:hs", name: "Litteris" }),
    ]);
    render(<CommunityRail />);

    expect(screen.getByRole("button", { name: "Eco Guild" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Litteris" })).toBeTruthy();
  });

  it("mostra badge de não-lidas quando unreadCount > 0", () => {
    useSyncStore.getState().setGuilds([makeGuild({ unreadCount: 3 })]);
    render(<CommunityRail />);

    expect(screen.getByText("3")).toBeTruthy();
  });

  it("não mostra badge quando unreadCount === 0", () => {
    useSyncStore.getState().setGuilds([makeGuild({ unreadCount: 0 })]);
    render(<CommunityRail />);

    expect(screen.queryByText("0")).toBeNull();
  });

  it("clique na guilda a seleciona no uiStore (activeGuildId)", async () => {
    useSyncStore.getState().setGuilds([
      makeGuild(),
      makeGuild({ guildId: "!g2:hs", name: "Litteris" }),
    ]);
    render(<CommunityRail />);

    await userEvent.click(screen.getByRole("button", { name: "Litteris" }));

    expect(useUiStore.getState().activeGuildId).toBe("!g2:hs");
  });

  it("a guilda ativa tem o indicador de pill (aria-current)", () => {
    useSyncStore.getState().setGuilds([
      makeGuild(),
      makeGuild({ guildId: "!g2:hs", name: "Litteris" }),
    ]);
    useUiStore.getState().setActiveGuild("!g2:hs");
    render(<CommunityRail />);

    const active = screen.getByRole("button", { name: "Litteris" });
    expect(active.getAttribute("aria-current")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Eco Guild" }).getAttribute("aria-current"),
    ).toBeNull();
  });
});
