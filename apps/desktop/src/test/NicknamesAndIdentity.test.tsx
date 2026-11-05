import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import MemberDropdownContent from "@/features/shell/MemberDropdownContent";
import MemberList from "@/features/shell/MemberList";
import MessageBubble from "@/features/chat/MessageBubble";
import type { NormalizedEvent } from "@/lib/matrix/types";

const { mockEchoApi } = vi.hoisted(() => ({
  mockEchoApi: {
    checkUsername: vi.fn().mockResolvedValue({ available: true }),
    setGuildMemberNickname: vi.fn().mockResolvedValue({
      id: "gmp_1",
      guildId: "guild_1",
      userId: "@lucas:litteris.online",
      nickname: "Capitão Lucas",
    }),
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "@amigo:litteris.online",
      username: "amigao",
      displayName: "Amigo Maneiro",
    }),
    patchUserProfile: vi.fn().mockResolvedValue({
      userId: "@lucas:litteris.online",
      username: "lucas_novo",
      displayName: "Lucas Master",
    }),
    uploadChatMedia: vi.fn(),
  },
}));

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    getUserId: vi.fn().mockReturnValue("@lucas:litteris.online"),
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "@amigo:litteris.online",
      username: "amigao",
      displayName: "Amigo Maneiro",
      nickname: "Amigao",
      avatarUrl: null,
      bannerUrl: null,
      bio: "Desenvolvedor",
    }),
    setDisplayName: vi.fn().mockResolvedValue(undefined),
    patchUserProfile: vi.fn().mockResolvedValue(undefined),
  },
  echoApi: mockEchoApi,
}));

vi.mock("@/lib/api/echoApi", () => {
  return {
    useEchoApi: () => mockEchoApi,
  };
});

describe("Sistema de Nicks, Identidade e Apelidos de Servidor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      myUserId: "@lucas:litteris.online",
      activeGuildId: "guild_1",
      presence: {},
    });
    useProfileStore.setState({
      displayName: "Lucas Global",
      username: "lucas",
      matrixUserId: "@lucas:litteris.online",
      nickname: "Lucas Global",
      avatarUrl: null,
      bannerUrl: null,
    });
  });

  it("oculta o domínio do Matrix (:litteris.online) e exibe o @username limpo no MemberDropdown", async () => {
    render(<MemberDropdownContent userId="@amigo:litteris.online" />);

    await waitFor(() => {
      // Deve exibir o apelido/display name
      expect(screen.getByText("Amigo Maneiro")).toBeTruthy();
      // Deve exibir @amigao (username único sem domínio do Matrix)
      expect(screen.getByText(/@amigao/)).toBeTruthy();
      // NÃO deve exibir o domínio técnico do Matrix
      expect(screen.queryByText(/@amigo:litteris\.online/)).toBeNull();
    });
  });

  it("permite ao usuário logado alterar o seu apelido dentro da guilda ativa", async () => {
    render(<MemberDropdownContent userId="@lucas:litteris.online" />);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Alterar apelido no servidor/i })).toBeTruthy();
    });

    // Clica no botão de alterar apelido na guilda
    fireEvent.click(screen.getByRole("menuitem", { name: /Alterar apelido no servidor/i }));

    // Input do apelido local deve aparecer
    const input = screen.getByPlaceholderText(/Seu apelido nesta comunidade/i);
    expect(input).toBeTruthy();

    await userEvent.clear(input);
    await userEvent.type(input, "Capitão Lucas");

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    await userEvent.click(saveBtn);

    expect(mockEchoApi.setGuildMemberNickname).toHaveBeenCalledWith("guild_1", "Capitão Lucas");
  });

  it("profileStore guarda o username limpo e matrixUserId separadamente", () => {
    useProfileStore.getState().setUsername("lucas_dev");
    expect(useProfileStore.getState().username).toBe("lucas_dev");
    expect(useProfileStore.getState().matrixUserId).toBe("@lucas:litteris.online");
  });

  it("exibe o apelido na guilda na MemberList e no MessageBubble", () => {
    // Configura guilda ativa e canal
    useUiStore.setState({
      activeGuildId: "guild_1",
      activeChannelId: "!canal1:hs",
      myUserId: "@lucas:litteris.online",
    });

    useSyncStore.getState().setMembers("!canal1:hs", [
      {
        userId: "@amigo:litteris.online",
        displayName: "Amigo Global",
        presence: "online",
        avatarUrl: null,
      },
    ]);

    // Define o apelido da guilda para o amigo no syncStore
    useSyncStore.getState().setGuildMemberProfiles("guild_1", [
      {
        id: "profile_amigo",
        guildId: "guild_1",
        userId: "@amigo:litteris.online",
        nickname: "Amigo Lendário",
        avatarUrl: null,
      },
    ]);

    // 1. Testa exibição na MemberList
    const { unmount } = render(<MemberList variant="static" />);
    expect(screen.getByText("Amigo Lendário")).toBeTruthy();
    unmount();

    // 2. Testa exibição no MessageBubble
    const event: NormalizedEvent = {
      eventId: "$event1",
      roomId: "!canal1:hs",
      sender: "@amigo:litteris.online",
      body: "Olá guilda!",
      originServerTs: Date.now(),
      msgtype: "m.text",
    };

    render(
      <MessageBubble
        event={event}
        showHeader={true}
        myUserId="@lucas:litteris.online"
      />,
    );

    expect(screen.getByText("Amigo Lendário")).toBeTruthy();
  });

  it("resolve mensagens pendentes sem duplicar no syncStore", () => {
    const roomId = "!canal1:hs";
    useSyncStore.setState({
      timelineByChannel: {
        [roomId]: [],
      },
    });

    // 1. Composer adiciona placeholder otimista
    const localId = "pending-12345";
    useSyncStore.getState().addPendingEvent({
      eventId: localId,
      roomId,
      sender: "@lucas:litteris.online",
      body: "Mensagem de teste",
      originServerTs: Date.now(),
      msgtype: "m.text",
    });

    expect(useSyncStore.getState().timelineByChannel[roomId]).toHaveLength(1);
    expect(useSyncStore.getState().timelineByChannel[roomId][0].eventId).toBe(localId);

    // 2. Evento real retornado pela API substitui o placeholder
    useSyncStore.getState().resolvePending(localId, {
      eventId: "$real_123",
      roomId,
      sender: "@lucas:litteris.online",
      body: "Mensagem de teste",
      originServerTs: Date.now(),
      msgtype: "m.text",
    });

    const timeline = useSyncStore.getState().timelineByChannel[roomId];
    expect(timeline).toHaveLength(1);
    expect(timeline[0].eventId).toBe("$real_123");
    expect(timeline.some((m) => m.eventId.startsWith("pending-"))).toBe(false);

    // 3. Se Matrix /sync enviar o mesmo evento novamente, não duplica
    useSyncStore.getState().applyEvent({
      eventId: "$real_123",
      roomId,
      sender: "@lucas:litteris.online",
      body: "Mensagem de teste",
      originServerTs: Date.now(),
      msgtype: "m.text",
    });

    expect(useSyncStore.getState().timelineByChannel[roomId]).toHaveLength(1);
  });
});

