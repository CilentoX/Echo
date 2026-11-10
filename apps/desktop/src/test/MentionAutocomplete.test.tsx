import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MentionAutocompletePopover from "@/features/chat/MentionAutocompletePopover";
import { useSyncStore } from "@/stores/syncStore";

describe("MentionAutocompletePopover Component", () => {
  beforeEach(() => {
    useSyncStore.setState({
      channelsByGuild: {
        "guild-1": [
          { channelId: "c-1", name: "geral", type: "text", unreadCount: 0 },
          { channelId: "c-2", name: "anúncios", type: "text", unreadCount: 0 },
          { channelId: "c-3", name: "Voz Principal", type: "voice", unreadCount: 0 },
        ],
      },
      guildRoles: {
        "guild-1": [
          { roleId: "r-admin", name: "Administrador", color: "#ef4444" } as any,
          { roleId: "r-mod", name: "Moderador", color: "#0fb9a8" } as any,
        ],
      },
      guildMemberProfiles: {
        "guild-1": {
          "@lucas:echo.litteris.online": {
            nickname: "Lucas Dev",
            avatarUrl: "mxc://avatar-lucas",
          } as any,
          "@nina:echo.litteris.online": {
            nickname: "Nina Design",
            avatarUrl: null,
          } as any,
        },
      },
      membersByRoom: {
        "room-1": [
          {
            userId: "@outro:echo.litteris.online",
            displayName: "Outro Usuário",
            avatarUrl: null,
          } as any,
        ],
      },
    });
  });

  it("renderiza opções especiais @everyone, @here e membros ao abrir menções", () => {
    const handleSelect = vi.fn();

    render(
      <MentionAutocompletePopover
        type="mention"
        query=""
        roomId="room-1"
        guildId="guild-1"
        selectedIndex={0}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText("@everyone")).toBeDefined();
    expect(screen.getByText("@here")).toBeDefined();
    expect(screen.getByText("@Administrador")).toBeDefined();
    expect(screen.getByText("@Moderador")).toBeDefined();
    expect(screen.getByText("Lucas Dev")).toBeDefined();
    expect(screen.getByText("Nina Design")).toBeDefined();
  });

  it("filtra membros e cargos com base no texto digitado após o @", () => {
    const handleSelect = vi.fn();

    render(
      <MentionAutocompletePopover
        type="mention"
        query="luc"
        roomId="room-1"
        guildId="guild-1"
        selectedIndex={0}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText("Lucas Dev")).toBeDefined();
    expect(screen.queryByText("Nina Design")).toBeNull();
    expect(screen.queryByText("@everyone")).toBeNull();
  });

  it("renderiza canais de texto e áudio quando type for 'channel'", () => {
    const handleSelect = vi.fn();

    render(
      <MentionAutocompletePopover
        type="channel"
        query=""
        roomId="room-1"
        guildId="guild-1"
        selectedIndex={0}
        onSelect={handleSelect}
      />
    );

    expect(screen.getByText("geral")).toBeDefined();
    expect(screen.getByText("anúncios")).toBeDefined();
    expect(screen.getByText("Voz Principal")).toBeDefined();
  });

  it("dispara onSelect ao clicar em um membro", () => {
    const handleSelect = vi.fn();

    render(
      <MentionAutocompletePopover
        type="mention"
        query="nina"
        roomId="room-1"
        guildId="guild-1"
        selectedIndex={0}
        onSelect={handleSelect}
      />
    );

    const option = screen.getByText("Nina Design");
    fireEvent.click(option);

    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "member",
        id: "@nina:echo.litteris.online",
        name: "Nina Design",
      })
    );
  });
});

