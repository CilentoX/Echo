import { beforeEach, describe, expect, it } from "vitest";
import { useSyncStore, selectGuilds, selectChannels, selectTimeline } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import type { ChannelSummary, GuildSummary, NormalizedEvent } from "@/lib/matrix/types";

function makeEvent(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    eventId: "$ev-1",
    roomId: "!room:hs.example",
    sender: "@nina:hs.example",
    body: "olá",
    originServerTs: 1700000000000,
    ...overrides,
  };
}

function makeGuild(overrides: Partial<GuildSummary> = {}): GuildSummary {
  return {
    guildId: "!space:hs.example",
    name: "Eco Guild",
    avatarUrl: null,
    unreadCount: 0,
    ...overrides,
  };
}

function makeChannel(overrides: Partial<ChannelSummary> = {}): ChannelSummary {
  return {
    channelId: "!chan:hs.example",
    name: "geral",
    unreadCount: 0,
    ...overrides,
  };
}

function resetStores() {
  // merge (sem replace): preserva as ações do store
  useSyncStore.setState({
    status: "connecting",
    guilds: [],
    channelsByGuild: {},
    timelineByChannel: {},
  });
  useUiStore.setState({
    activeGuildId: null,
    activeChannelId: null,
  });
}

describe("syncStore", () => {
  beforeEach(resetStores);

  it("applyEvent anexa evento na timeline do canal existente", () => {
    const { applyEvent } = useSyncStore.getState();
    applyEvent(makeEvent({ eventId: "$ev-1", roomId: "!room:hs.example" }));

    const timeline = useSyncStore.getState().timelineByChannel["!room:hs.example"];
    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({ eventId: "$ev-1", body: "olá" });
  });

  it("applyEvent cria timeline para canal novo", () => {
    const { applyEvent } = useSyncStore.getState();

    applyEvent(makeEvent({ roomId: "!nova:hs.example" }));

    expect(useSyncStore.getState().timelineByChannel["!nova:hs.example"]).toHaveLength(1);
  });

  it("applyEvent deduplica por eventId — aplicar 2× adiciona 1", () => {
    const { applyEvent } = useSyncStore.getState();
    const event = makeEvent({ eventId: "$ev-dup" });

    applyEvent(event);
    applyEvent({ ...event, body: "eco repetido" });

    const timeline = useSyncStore.getState().timelineByChannel[event.roomId];
    expect(timeline).toHaveLength(1);
    expect(timeline[0].body).toBe("olá");
  });

  it("setStatus expõe status para o indicador (ex.: 'reconectando…' em error)", () => {
    const { setStatus } = useSyncStore.getState();

    setStatus("syncing");
    expect(useSyncStore.getState().status).toBe("syncing");

    setStatus("error");
    expect(useSyncStore.getState().status).toBe("error");
  });

  it("setGuilds substitui a lista inteira", () => {
    const { setGuilds } = useSyncStore.getState();

    setGuilds([makeGuild({ guildId: "!a:hs", name: "A" })]);
    setGuilds([makeGuild({ guildId: "!b:hs", name: "B" }), makeGuild({ guildId: "!c:hs", name: "C" })]);

    const guilds = useSyncStore.getState().guilds;
    expect(guilds.map((g) => g.guildId)).toEqual(["!b:hs", "!c:hs"]);
  });

  it("setChannels substitui a lista do guild sem afetar outros", () => {
    const { setChannels } = useSyncStore.getState();

    setChannels("!space:hs", [makeChannel({ channelId: "!old:hs", name: "antiga" })]);
    setChannels("!space:hs", [makeChannel({ channelId: "!chan:hs", name: "geral" })]);
    setChannels("!space2:hs", [makeChannel({ channelId: "!chan2:hs", name: "outro" })]);

    const byGuild = useSyncStore.getState().channelsByGuild;
    expect(byGuild["!space:hs"].map((c) => c.channelId)).toEqual(["!chan:hs"]);
    expect(byGuild["!space2:hs"]).toHaveLength(1);
  });

  it("addPendingEvent anexa placeholder com id local pend-*", () => {
    const { addPendingEvent } = useSyncStore.getState();
    const pending = makeEvent({ eventId: "pending-1", roomId: "!room:hs.example", body: "rascunho" });

    addPendingEvent(pending);

    const timeline = useSyncStore.getState().timelineByChannel["!room:hs.example"];
    expect(timeline).toHaveLength(1);
    expect(timeline[0].eventId).toBe("pending-1");
  });

  it("resolvePending troca o placeholder localId pelo evento real (mesmo roomId)", () => {
    const { addPendingEvent, resolvePending } = useSyncStore.getState();
    addPendingEvent(makeEvent({ eventId: "pending-1", roomId: "!room:hs.example" }));

    resolvePending("pending-1", makeEvent({ eventId: "$ev-real", roomId: "!room:hs.example" }));

    const timeline = useSyncStore.getState().timelineByChannel["!room:hs.example"];
    expect(timeline.map((m) => m.eventId)).toEqual(["$ev-real"]);
  });

  it("resolvePending não duplica quando o eco real já chegou via sync", () => {
    const { addPendingEvent, applyEvent, resolvePending } = useSyncStore.getState();
    addPendingEvent(makeEvent({ eventId: "pending-1", roomId: "!room:hs.example" }));
    applyEvent(makeEvent({ eventId: "$ev-real", roomId: "!room:hs.example" }));

    resolvePending("pending-1", makeEvent({ eventId: "$ev-real", roomId: "!room:hs.example" }));

    const timeline = useSyncStore.getState().timelineByChannel["!room:hs.example"];
    expect(timeline.map((m) => m.eventId)).toEqual(["$ev-real"]);
  });

  it("seletores expõem guilds, canais e timeline", () => {
    const { setGuilds, setChannels, applyEvent } = useSyncStore.getState();
    setGuilds([makeGuild()]);
    setChannels("!space:hs", [makeChannel()]);
    applyEvent(makeEvent({ eventId: "$ev-1", roomId: "!chan:hs.example" }));

    const state = useSyncStore.getState();
    expect(selectGuilds(state)).toHaveLength(1);
    expect(selectChannels("!space:hs")(state)).toHaveLength(1);
    expect(selectChannels("!inexistente:hs")(state)).toEqual([]);
    expect(selectTimeline("!chan:hs.example")(state)).toHaveLength(1);
    expect(selectTimeline("!inexistente:hs")(state)).toEqual([]);
  });
});

describe("uiStore", () => {
  beforeEach(resetStores);

  it("começa sem guild/canal ativos e os setters atualizam", () => {
    expect(useUiStore.getState().activeGuildId).toBeNull();
    expect(useUiStore.getState().activeChannelId).toBeNull();

    useUiStore.getState().setActiveGuild("!space:hs");
    useUiStore.getState().setActiveChannel("!chan:hs");

    expect(useUiStore.getState().activeGuildId).toBe("!space:hs");
    expect(useUiStore.getState().activeChannelId).toBe("!chan:hs");

    useUiStore.getState().setActiveGuild(null);
    useUiStore.getState().setActiveChannel(null);
    expect(useUiStore.getState().activeGuildId).toBeNull();
    expect(useUiStore.getState().activeChannelId).toBeNull();
  });
});
