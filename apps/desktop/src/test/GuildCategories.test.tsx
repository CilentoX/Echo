import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateCategoryModal from "@/features/guild/CreateCategoryModal";
import CreateChannelModal from "@/features/guild/CreateChannelModal";
import ChannelSidebar from "@/features/shell/ChannelSidebar";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    listChannels: vi.fn().mockResolvedValue([]),
    getGuildMembersData: vi.fn().mockResolvedValue({ memberProfiles: [], roles: [], memberRoles: [] }),
    getGuildProfile: vi.fn().mockResolvedValue(null),
    createChannel: vi.fn(),
    getUserId: vi.fn().mockReturnValue("@nina:echo.litteris.online"),
  },
}));

describe("Sistema de Categorias e Criação de Canais de Texto e Voz (Padrão Discord)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSyncStore.getState().reset();
    useUiStore.setState({ activeGuildId: "guild-1", activeChannelId: null, myUserId: "@nina:echo.litteris.online" });

    useSyncStore.getState().setGuilds([
      {
        guildId: "guild-1",
        name: "Servidor dos Devs",
        avatarUrl: null,
        unreadCount: 0,
        createdBy: "@nina:echo.litteris.online",
      } as any,
    ]);
  });

  it("CreateCategoryModal renderiza os campos e permite criar uma nova categoria", () => {
    const handleClose = vi.fn();
    const handleCreate = vi.fn();

    render(
      <CreateCategoryModal
        open={true}
        onClose={handleClose}
        guildId="guild-1"
        onCreateCategory={handleCreate}
      />,
    );

    expect(screen.getByRole("heading", { name: "Criar Categoria" })).toBeTruthy();
    expect(screen.getByPlaceholderText(/Ex: COMUNIDADE, JOGOS, PROJETOS/i)).toBeTruthy();

    const input = screen.getByPlaceholderText(/Ex: COMUNIDADE, JOGOS, PROJETOS/i);
    fireEvent.change(input, { target: { value: "🎮 Jogos e Streams" } });

    const submitBtn = screen.getByRole("button", { name: "Criar Categoria" });
    fireEvent.click(submitBtn);

    expect(handleCreate).toHaveBeenCalledWith("🎮 Jogos e Streams");
    expect(handleClose).toHaveBeenCalled();
  });

  it("CreateChannelModal inicializa com a categoria e tipo pré-definidos", async () => {
    const handleClose = vi.fn();
    const handleCreated = vi.fn();
    const handleCreateApi = vi.fn().mockResolvedValue({
      channelId: "chan-123",
      name: "geral-jogos",
    });

    render(
      <CreateChannelModal
        open={true}
        onClose={handleClose}
        guildId="guild-1"
        initialCategory="🎮 Jogos"
        initialType="voice"
        existingCategories={["Geral", "🎮 Jogos"]}
        onCreate={handleCreateApi}
        onCreated={handleCreated}
      />,
    );

    // Deve indicar no subtítulo e input a categoria recebida
    expect(screen.getByText(/Criando canal na categoria "🎮 Jogos"/i)).toBeTruthy();
    expect(screen.getByDisplayValue("🎮 Jogos")).toBeTruthy();

    // Digita o nome do canal
    const input = screen.getByPlaceholderText(/sala-de-conversa/i);
    fireEvent.change(input, { target: { value: "Voz Principal" } });

    const submitBtn = screen.getByRole("button", { name: "Criar canal" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleCreateApi).toHaveBeenCalledWith({
        name: "voz-principal",
        type: "voice",
        topic: undefined,
        category: "🎮 Jogos",
      });
      expect(handleCreated).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it("renderiza categoria personalizada criada na ChannelSidebar e permite criar canal nela", async () => {
    // Adiciona uma categoria diretamente no store da guilda
    useSyncStore.getState().createCategory("guild-1", "Projetos Secretos");

    render(<ChannelSidebar variant="static" />);

    // Deve exibir o cabeçalho da categoria criada
    expect(screen.getByText("Projetos Secretos")).toBeTruthy();
    // Como está vazia, deve mostrar o aviso acolhedor
    expect(screen.getByText("Nenhum canal")).toBeTruthy();

    // Deve conter o botão de criar categoria no cabeçalho do servidor
    const createCatBtn = screen.getByRole("button", { name: "Criar categoria" });
    expect(createCatBtn).toBeTruthy();

    // Deve conter o botão de criar canal (+) na categoria Projetos Secretos
    const addChannelInCatBtn = screen.getByRole("button", { name: "Criar canal em Projetos Secretos" });
    expect(addChannelInCatBtn).toBeTruthy();

    // Clica no + da categoria Projetos Secretos
    fireEvent.click(addChannelInCatBtn);

    // O modal de criar canal deve abrir já focado na categoria
    expect(await screen.findByText(/Criando canal na categoria "Projetos Secretos"/i)).toBeTruthy();
  });

  it("permite excluir uma categoria personalizada", () => {
    useSyncStore.getState().createCategory("guild-1", "Temporaria");
    expect(useSyncStore.getState().guildCategories["guild-1"]).toContain("Temporaria");

    useSyncStore.getState().deleteCategory("guild-1", "Temporaria");
    expect(useSyncStore.getState().guildCategories["guild-1"]).not.toContain("Temporaria");
  });
});
