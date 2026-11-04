import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import GuildSettingsModal from "@/features/guild/GuildSettingsModal";
import { useEchoApi } from "@/lib/api/echoApi";

vi.mock("@/lib/api/echoApi", () => ({
  useEchoApi: vi.fn(),
}));

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    getUserId: vi.fn(() => "@lucas:litteris.online"),
    deleteGuild: vi.fn(),
  },
}));

describe("GuildSettingsModal", () => {
  const mockEchoApi = {
    getGuildRoles: vi.fn().mockResolvedValue([
      { id: "role-1", guildId: "guild-1", name: "Admin", color: "#0FB9A8", isHoisted: true, permissions: ["MANAGE_GUILD"] },
    ]),
    getGuildMembersData: vi.fn().mockResolvedValue({
      roles: [],
      memberRoles: [],
      memberProfiles: [
        { id: "mp-1", guildId: "guild-1", userId: "@lucas:litteris.online", nickname: "Lucas Guild Nick" },
      ],
    }),
    listGuildInvites: vi.fn().mockResolvedValue([
      { id: "inv-1", code: "code123", guildId: "guild-1", usesCount: 2, url: "https://echo-api.litteris.online/invite/code123" },
    ]),
    createGuildRole: vi.fn(),
    updateGuildRole: vi.fn(),
    deleteGuildRole: vi.fn(),
    createGuildInvite: vi.fn(),
    deleteGuildInvite: vi.fn(),
    upsertGuildProfile: vi.fn(),
    uploadChatMedia: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useEchoApi).mockReturnValue(mockEchoApi as any);
  });

  it("não renderiza quando open é falso", () => {
    render(
      <GuildSettingsModal
        open={false}
        guild={{ guildId: "guild-1", name: "Minha Guilda" }}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renderiza tabs de Visão Geral, Cargos, Membros e Convites quando aberto", () => {
    render(
      <GuildSettingsModal
        open={true}
        guild={{ guildId: "guild-1", name: "Minha Guilda" }}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Configurações do Servidor")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Visão Geral/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cargos & Permissões/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Membros/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Convites/i })).toBeTruthy();
  });

  it("permite navegar entre as abas", async () => {
    const user = userEvent.setup();
    render(
      <GuildSettingsModal
        open={true}
        guild={{ guildId: "guild-1", name: "Minha Guilda" }}
        onClose={vi.fn()}
      />
    );

    // Clica na aba de Cargos
    await user.click(screen.getByRole("button", { name: /Cargos & Permissões/i }));
    expect(mockEchoApi.getGuildRoles).toHaveBeenCalledWith("guild-1");

    // Clica na aba de Convites
    await user.click(screen.getByRole("button", { name: /Convites/i }));
    expect(mockEchoApi.listGuildInvites).toHaveBeenCalledWith("guild-1");
  });
});

