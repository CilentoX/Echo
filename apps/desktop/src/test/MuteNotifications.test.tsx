import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ChannelMutePopover from "@/features/channels/ChannelMutePopover";
import GuildMutePopover from "@/features/guild/GuildMutePopover";
import { useSyncStore } from "@/stores/syncStore";

describe("Sistema de Silenciamento Granular (Mute por Canal e Servidor)", () => {
  beforeEach(() => {
    useSyncStore.setState({
      mutedChannels: {},
      mutedGuilds: {},
    });
    localStorage.clear();
  });

  it("permite silenciar e reativar um canal de texto", () => {
    const store = useSyncStore.getState();
    expect(store.isChannelMuted("ch-geral", "!guild1")).toBe(false);

    store.muteChannel("ch-geral", 60); // 1 hora
    expect(useSyncStore.getState().isChannelMuted("ch-geral", "!guild1")).toBe(true);

    store.unmuteChannel("ch-geral");
    expect(useSyncStore.getState().isChannelMuted("ch-geral", "!guild1")).toBe(false);
  });

  it("permite silenciar o servidor inteiro e afeta todos os canais dele", () => {
    const store = useSyncStore.getState();
    expect(store.isGuildMuted("!guild1")).toBe(false);
    expect(store.isChannelMuted("ch-1", "!guild1")).toBe(false);

    store.muteGuild("!guild1"); // indefinido
    expect(useSyncStore.getState().isGuildMuted("!guild1")).toBe(true);
    expect(useSyncStore.getState().isChannelMuted("ch-1", "!guild1")).toBe(true);
    expect(useSyncStore.getState().isChannelMuted("ch-2", "!guild1")).toBe(true);

    store.unmuteGuild("!guild1");
    expect(useSyncStore.getState().isGuildMuted("!guild1")).toBe(false);
    expect(useSyncStore.getState().isChannelMuted("ch-1", "!guild1")).toBe(false);
  });

  it("renderiza o ChannelMutePopover e permite escolher a duração do silenciamento", () => {
    render(<ChannelMutePopover channelId="ch-dev" channelName="desenvolvimento" guildId="!guild1" />);

    const triggerBtn = screen.getByLabelText("Silenciar #desenvolvimento");
    expect(triggerBtn).toBeTruthy();

    fireEvent.click(triggerBtn);

    // Deve exibir as opções de duração
    expect(screen.getByText("Por 15 minutos")).toBeTruthy();
    expect(screen.getByText("Por 1 hora")).toBeTruthy();
    expect(screen.getByText("Por 8 horas")).toBeTruthy();
    expect(screen.getByText("Por 24 horas")).toBeTruthy();
    expect(screen.getByText("Até eu reativar")).toBeTruthy();

    // Clica em "Por 15 minutos"
    fireEvent.click(screen.getByText("Por 15 minutos"));

    expect(useSyncStore.getState().isChannelMuted("ch-dev", "!guild1")).toBe(true);
  });

  it("exibe a opção de Reativar Notificações quando o canal já está silenciado", () => {
    useSyncStore.getState().muteChannel("ch-dev");

    render(<ChannelMutePopover channelId="ch-dev" channelName="desenvolvimento" guildId="!guild1" />);

    const triggerBtn = screen.getByLabelText("Reativar notificações de #desenvolvimento");
    expect(triggerBtn).toBeTruthy();

    fireEvent.click(triggerBtn);

    const unmuteBtn = screen.getByRole("button", { name: "Reativar Notificações" });
    expect(unmuteBtn).toBeTruthy();

    fireEvent.click(unmuteBtn);
    expect(useSyncStore.getState().isChannelMuted("ch-dev", "!guild1")).toBe(false);
  });

  it("renderiza o GuildMutePopover e permite silenciar o servidor", () => {
    render(<GuildMutePopover guildId="!guild1" guildName="Echo Guild" />);

    const triggerBtn = screen.getByLabelText("Silenciar servidor Echo Guild");
    expect(triggerBtn).toBeTruthy();

    fireEvent.click(triggerBtn);

    const indefiniteOption = screen.getByText("Até eu reativar");
    expect(indefiniteOption).toBeTruthy();
    fireEvent.click(indefiniteOption);

    expect(useSyncStore.getState().isGuildMuted("!guild1")).toBe(true);
  });
});
