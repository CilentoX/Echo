import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useFriendsStore } from "@/stores/friendsStore";
import MemberDropdownContent from "@/features/shell/MemberDropdownContent";

const { mockEchoApi } = vi.hoisted(() => ({
  mockEchoApi: {
    setGuildMemberNickname: vi.fn().mockResolvedValue({
      id: "gmp_1",
      guildId: "guild_alpha",
      userId: "@lucas:litteris.online",
      nickname: "Capitão Estelar",
    }),
    getGuildMembersData: vi.fn().mockResolvedValue({
      roles: [
        { id: "role_mod", guildId: "guild_alpha", name: "Moderador", color: "#10b981", position: 1 },
        { id: "role_vip", guildId: "guild_alpha", name: "VIP", color: "#8b5cf6", position: 2 },
      ],
      memberRoles: [
        { id: "mr_1", guildId: "guild_alpha", userId: "@amigo:litteris.online", roleId: "role_mod" },
      ],
      memberProfiles: [
        { id: "mp_1", guildId: "guild_alpha", userId: "@amigo:litteris.online", nickname: "Amigo Maneiro da Guilda", avatarUrl: null },
      ],
    }),
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "@amigo:litteris.online",
      username: "amigao",
      displayName: "Amigo Maneiro",
      avatarUrl: null,
      bannerUrl: null,
      bio: "Desenvolvedor full-stack no Echo",
    }),
  },
}));

vi.mock("@/lib/api/echoApi", () => ({
  useEchoApi: () => mockEchoApi,
  echoApi: mockEchoApi,
  normalizeInviteCode: (code: string) => code,
}));

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    getUserId: vi.fn().mockReturnValue("@lucas:litteris.online"),
    getUserProfile: vi.fn().mockImplementation((userId?: string) => {
      if (userId === "@amigo:litteris.online") {
        return Promise.resolve({
          userId: "@amigo:litteris.online",
          username: "amigao",
          displayName: "Amigo Maneiro",
          avatarUrl: null,
          bannerUrl: null,
          bio: "Desenvolvedor full-stack no Echo",
        });
      }
      return Promise.resolve({
        userId: "@lucas:litteris.online",
        username: "lucas",
        displayName: "Lucas",
        avatarUrl: null,
        bannerUrl: null,
        bio: "Criador do Echo",
      });
    }),
  },
  echoApi: mockEchoApi,
}));

describe("MemberDropdownContent - Redesign UI/UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({
      myUserId: "@lucas:litteris.online",
      activeGuildId: "guild_alpha",
      presence: {
        "@amigo:litteris.online": "online",
        "@lucas:litteris.online": "online",
      },
    });
    useFriendsStore.setState({
      friends: [],
    });
  });

  it("renderiza o dropdown com banner, avatar, identificação e cargos da guilda", async () => {
    render(<MemberDropdownContent userId="@amigo:litteris.online" />);

    await waitFor(() => {
      // Exibe apelido customizado da guilda
      expect(screen.getByText("Amigo Maneiro da Guilda")).toBeTruthy();
      // Exibe handle limpo
      expect(screen.getByText(/@amigao/)).toBeTruthy();
      // Exibe bio na seção Sobre mim
      expect(screen.getByText("Desenvolvedor full-stack no Echo")).toBeTruthy();
      // Exibe cargo da guilda
      expect(screen.getByText("Moderador")).toBeTruthy();
      // Exibe badge de presença Online
      expect(screen.getByText("Online")).toBeTruthy();
    });
  });

  it("permite copiar o username limpo ao clicar", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<MemberDropdownContent userId="@amigo:litteris.online" />);

    await waitFor(() => {
      expect(screen.getByText(/@amigao/)).toBeTruthy();
    });

    const copyBtn = screen.getByRole("button", { name: /@amigao/i });
    fireEvent.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("@amigao");
  });

  it("chama openDirectMessage ao clicar em Enviar mensagem direta", async () => {
    const openDmSpy = vi.spyOn(useFriendsStore.getState(), "openDirectMessage").mockResolvedValue("!room_dm:hs");
    const onClose = vi.fn();

    render(<MemberDropdownContent userId="@amigo:litteris.online" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Enviar mensagem direta/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: /Enviar mensagem direta/i }));

    expect(openDmSpy).toHaveBeenCalledWith("@amigo:litteris.online");
  });

  it("renderiza opções de editar perfil e alterar apelido quando é o próprio usuário", async () => {
    render(<MemberDropdownContent userId="@lucas:litteris.online" />);

    await waitFor(() => {
      expect(screen.getByText("você")).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Editar perfil/i })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Alterar apelido no servidor/i })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Copiar meu username/i })).toBeTruthy();
    });
  });

  it("abre o formulário de alteração de apelido no servidor e salva", async () => {
    render(<MemberDropdownContent userId="@lucas:litteris.online" />);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /Alterar apelido no servidor/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: /Alterar apelido no servidor/i }));

    const input = screen.getByPlaceholderText(/Seu apelido nesta comunidade/i);
    expect(input).toBeTruthy();

    await userEvent.clear(input);
    await userEvent.type(input, "Capitão Estelar");

    const saveBtn = screen.getByRole("button", { name: "Salvar" });
    await userEvent.click(saveBtn);

    expect(mockEchoApi.setGuildMemberNickname).toHaveBeenCalledWith("guild_alpha", "Capitão Estelar");
  });
});
