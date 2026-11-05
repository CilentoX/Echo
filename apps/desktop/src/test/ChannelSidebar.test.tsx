import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import type { ChannelSummary, GuildSummary } from "@/lib/matrix/types";
import ChannelSidebar from "@/features/shell/ChannelSidebar";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useVoiceStore } from "@/stores/voiceStore";

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

  it("store sem guildas mostra estado vazio", () => {
    render(<ChannelSidebar />);

    expect(screen.getByText("Nenhuma guilda ainda.")).toBeTruthy();
  });

  it("renderiza o banner da guilda quando bannerUrl estiver definido", () => {
    const guildWithBanner: GuildSummary = {
      ...GUILD,
      bannerUrl: "https://echo.litteris.online/banner.png",
    };
    useSyncStore.getState().setGuilds([guildWithBanner]);
    useSyncStore.getState().setChannels(guildWithBanner.guildId, [makeChannel()]);
    useUiStore.getState().setActiveGuild(guildWithBanner.guildId);
    render(<ChannelSidebar />);

    const bannerImg = screen.getByAltText("Echo Guild");
    expect(bannerImg).toBeTruthy();
    expect(screen.getByText("Echo Guild")).toBeTruthy();
  });

  it("renderiza o banner fallback estilizado mesmo quando bannerUrl não estiver definido", () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [makeChannel()]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    render(<ChannelSidebar />);

    expect(screen.getByTestId("guild-banner-fallback")).toBeTruthy();
    expect(screen.getByText("Echo Guild")).toBeTruthy();
  });

  it("renderiza participantes conectados no canal de voz com apelidos, foto e animação de fala", () => {
    const voiceChannel = makeChannel({
      channelId: "voice-1",
      name: "Sala de Voz",
      type: "voice",
    });

    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [voiceChannel]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    useUiStore.getState().setMyUserId("@nina:echo.litteris.online");

    useSyncStore.getState().setGuildMemberProfiles(GUILD.guildId, [
      {
        id: "prof-1",
        guildId: GUILD.guildId,
        userId: "@nina:echo.litteris.online",
        nickname: "Nina Pro Gamer",
        avatarUrl: "https://echo.litteris.online/avatar-nina.png",
      },
    ]);

    useVoiceStore.getState().connectVoice(
      GUILD.guildId,
      GUILD.name,
      "voice-1",
      "Sala de Voz",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina",
          avatarUrl: "https://echo.litteris.online/avatar-nina.png",
          isSpeaking: true,
          volume: 100,
        },
      ],
    );

    render(<ChannelSidebar />);

    // Apelido da guilda deve aparecer sob o canal de voz
    expect(screen.getByText("Nina Pro Gamer")).toBeTruthy();

    // Foto de perfil via MxcImage deve ser renderizada
    expect(screen.getByAltText("Nina Pro Gamer")).toBeTruthy();

    // Animação de fala (Equalizer waveform) deve estar presente
    expect(screen.getByTitle("Falando...")).toBeTruthy();
  });

  it("recolhe e expande uma categoria de canais ao clicar no cabeçalho", async () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [
      makeChannel({ channelId: "!c1:hs", name: "anúncios", category: "INFORMAÇÕES" }),
    ]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);

    render(<ChannelSidebar />);

    expect(screen.getByText("anúncios")).toBeTruthy();

    const categoryHeader = screen.getByRole("button", { name: /INFORMAÇÕES/i });
    await userEvent.click(categoryHeader);

    // Canal deve ficar oculto quando categoria for recolhida
    expect(screen.queryByText("anúncios")).toBeNull();

    // Clicar novamente expande a categoria
    await userEvent.click(categoryHeader);
    expect(screen.getByText("anúncios")).toBeTruthy();
  });

  it("permite criar uma sala de voz temporária dinâmica e conectar nela imediatamente", async () => {
    useSyncStore.getState().setGuilds([GUILD]);
    useSyncStore.getState().setChannels(GUILD.guildId, [
      makeChannel({ channelId: "!v1:hs", name: "Voz Geral", type: "voice", category: "Canais de voz" }),
    ]);
    useUiStore.getState().setActiveGuild(GUILD.guildId);
    useUiStore.setState({ myUserId: "@lucas:hs" });

    render(<ChannelSidebar />);

    const createTempRoomBtn = screen.getByLabelText("Criar sala de voz temporária");
    expect(createTempRoomBtn).toBeTruthy();

    await userEvent.click(createTempRoomBtn);

    // Deve ter criado a sala temporária dinâmica e conectado nela
    const channels = useSyncStore.getState().channelsByGuild[GUILD.guildId]!;
    expect(channels.some((c) => c.isTemporary)).toBe(true);

    const voiceState = useVoiceStore.getState();
    expect(voiceState.activeVoiceChannelId).toMatch(/^temp-voice-/);
  });
});
