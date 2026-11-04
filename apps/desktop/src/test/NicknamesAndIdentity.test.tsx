import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";
import MemberDropdownContent from "@/features/shell/MemberDropdownContent";
import { echoApi } from "@/lib/matrix/instance";

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
});

