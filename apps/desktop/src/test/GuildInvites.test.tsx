import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import InviteModal from "@/features/guild/InviteModal";
import JoinGuildModal from "@/features/guild/JoinGuildModal";
import { matrixService } from "@/lib/matrix/instance";

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    createGuildInvite: vi.fn(),
    getInvitePreview: vi.fn(),
    joinGuildViaInvite: vi.fn(),
  },
}));

describe("Guild Invites System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("InviteModal", () => {
    it("não renderiza quando open é falso", () => {
      render(
        <InviteModal
          open={false}
          guildId="!guild:hs"
          guildName="Echo Devs"
          onClose={vi.fn()}
        />
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("chama createGuildInvite ao abrir e exibe o link gerado", async () => {
      vi.mocked(matrixService.createGuildInvite).mockResolvedValueOnce({
        code: "testcode",
        url: "https://echo.litteris.online/invite/testcode",
        maxUses: null,
        usesCount: 0,
        expiresAt: null,
      });

      render(
        <InviteModal
          open={true}
          guildId="!guild:hs"
          guildName="Echo Devs"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText(/Convidar amigos para Echo Devs/i)).toBeTruthy();

      await vi.waitFor(() => {
        expect(matrixService.createGuildInvite).toHaveBeenCalledWith("!guild:hs", {
          expiresInHours: 168,
          maxUses: undefined,
        });
      });

      const input = await screen.findByDisplayValue("https://echo.litteris.online/invite/testcode");
      expect(input).toBeTruthy();
    });
  });

  describe("JoinGuildModal", () => {
    it("não renderiza quando open é falso", () => {
      render(
        <JoinGuildModal
          open={false}
          onClose={vi.fn()}
          onJoined={vi.fn()}
        />
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("busca prévia da guilda e permite entrar com sucesso", async () => {
      vi.mocked(matrixService.getInvitePreview).mockResolvedValueOnce({
        code: "code123",
        guildId: "!space:hs",
        name: "Comunidade Echo",
        description: "Servidor de desenvolvedores",
        avatarUrl: null,
        bannerUrl: null,
        channelsCount: 3,
        expiresAt: null,
      });

      vi.mocked(matrixService.joinGuildViaInvite).mockResolvedValueOnce({
        success: true,
        guildId: "!space:hs",
        name: "Comunidade Echo",
      });

      const onJoined = vi.fn();
      render(
        <JoinGuildModal
          open={true}
          onClose={vi.fn()}
          onJoined={onJoined}
        />
      );

      const input = screen.getByPlaceholderText(/echo.litteris.online\/invite/i);
      await userEvent.type(input, "code123");

      const buscarBtn = screen.getByRole("button", { name: "Buscar" });
      await userEvent.click(buscarBtn);

      await vi.waitFor(() => {
        expect(matrixService.getInvitePreview).toHaveBeenCalledWith("code123");
      });

      expect(await screen.findByText("Comunidade Echo")).toBeTruthy();
      expect(screen.getByText("Servidor de desenvolvedores")).toBeTruthy();

      const entrarBtn = screen.getByRole("button", { name: /Entrar na guilda/i });
      await userEvent.click(entrarBtn);

      await vi.waitFor(() => {
        expect(matrixService.joinGuildViaInvite).toHaveBeenCalledWith("code123");
        expect(onJoined).toHaveBeenCalledWith({
          guildId: "!space:hs",
          name: "Comunidade Echo",
        });
      });
    });
  });
});

