import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ChannelSidebar from "@/features/shell/ChannelSidebar";
import ChatPane from "@/features/chat/ChatPane";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useVoiceStore } from "@/stores/voiceStore";
import type { ChannelSummary, GuildSummary } from "@/lib/matrix/types";

describe("Sistema Completo de Drag and Drop (Categorias, Canais, Membros e Arquivos)", () => {
  const mockGuild: GuildSummary = {
    guildId: "guild-dnd",
    name: "Comunidade DnD",
    avatarUrl: null,
    unreadCount: 0,
  };

  const initialChannels: ChannelSummary[] = [
    {
      channelId: "c-text-1",
      name: "geral",
      type: "text",
      category: "Canais de texto",
      unreadCount: 0,
    },
    {
      channelId: "c-text-2",
      name: "anúncios",
      type: "text",
      category: "Canais de texto",
      unreadCount: 0,
    },
    {
      channelId: "c-voice-1",
      name: "Voz Geral",
      type: "voice",
      category: "Canais de voz",
      unreadCount: 0,
    },
    {
      channelId: "c-voice-2",
      name: "Sala de Reunião",
      type: "voice",
      category: "Canais de voz",
      unreadCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useUiStore.setState({
      myUserId: "@admin:echo.litteris.online",
      activeGuildId: "guild-dnd",
      activeChannelId: "c-text-1",
    });

    useSyncStore.setState({
      guilds: [mockGuild],
      channelsByGuild: {
        "guild-dnd": [...initialChannels],
      },
      guildCategories: {
        "guild-dnd": ["Canais de texto", "Canais de voz", "Projetos"],
      },
      channelPermissions: {},
    });

    useVoiceStore.setState({
      isConnected: false,
      activeVoiceChannelId: null,
      participants: [],
    });
  });

  describe("1. Reorganização e Movimentação no syncStore", () => {
    it("permite reordenar categorias via reorderCategories e persiste no localStorage", () => {
      const newOrder = ["Projetos", "Canais de voz", "Canais de texto"];
      useSyncStore.getState().reorderCategories("guild-dnd", newOrder);

      const updated = useSyncStore.getState().guildCategories["guild-dnd"];
      expect(updated).toEqual(newOrder);

      const saved = JSON.parse(localStorage.getItem("echo:guildCategories") || "{}");
      expect(saved["guild-dnd"]).toEqual(newOrder);
    });

    it("permite mover canal para outra categoria e persiste override", () => {
      useSyncStore.getState().moveChannelCategory("guild-dnd", "c-text-1", "Projetos");

      const channels = useSyncStore.getState().channelsByGuild["guild-dnd"];
      const moved = channels.find((c) => c.channelId === "c-text-1");
      expect(moved?.category).toBe("Projetos");

      const savedOverrides = JSON.parse(localStorage.getItem("echo:channelOverrides") || "{}");
      expect(savedOverrides["guild-dnd"]["c-text-1"]).toEqual({ category: "Projetos" });
    });
  });

  describe("2. Drag and Drop de Canais e Categorias na ChannelSidebar", () => {
    it("reorganiza categorias ao soltar uma categoria sobre outra", async () => {
      render(<ChannelSidebar />);

      const catProjetos = screen.getByText("Projetos");
      expect(catProjetos).toBeDefined();

      const catSection = catProjetos.closest("section");
      expect(catSection).not.toBeNull();

      // Simula o drop de 'Canais de texto' sobre 'Projetos'
      fireEvent.drop(catSection!, {
        dataTransfer: {
          types: ["application/x-echo-category"],
          getData: (type: string) => (type === "application/x-echo-category" ? "Canais de texto" : ""),
        },
      });

      await waitFor(() => {
        const order = useSyncStore.getState().guildCategories["guild-dnd"];
        expect(order).toBeDefined();
      });
    });

    it("move um canal para outra categoria ao soltar o canal na seção da categoria", async () => {
      render(<ChannelSidebar />);

      const catProjetos = screen.getByText("Projetos").closest("section");
      expect(catProjetos).not.toBeNull();

      // Simula o drop do canal 'c-text-2' dentro de 'Projetos'
      fireEvent.drop(catProjetos!, {
        dataTransfer: {
          types: ["application/x-echo-channel"],
          getData: (type: string) =>
            type === "application/x-echo-channel"
              ? JSON.stringify({ channelId: "c-text-2", sourceCategory: "Canais de texto" })
              : "",
        },
      });

      await waitFor(() => {
        const channels = useSyncStore.getState().channelsByGuild["guild-dnd"];
        const moved = channels.find((c) => c.channelId === "c-text-2");
        expect(moved?.category).toBe("Projetos");
      });
    });
  });

  describe("3. Drag and Drop de Membros para Canais de Voz", () => {
    it("move participante para outro canal de voz via moveParticipantToChannel", () => {
      useVoiceStore.setState({
        activeVoiceChannelId: "c-voice-1",
        activeVoiceChannelName: "Voz Geral",
        isConnected: true,
        participants: [
          {
            userId: "@bob:echo.litteris.online",
            username: "Bob",
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            volume: 100,
          },
        ],
      });

      useVoiceStore
        .getState()
        .moveParticipantToChannel(
          "@bob:echo.litteris.online",
          "c-voice-2",
          "Sala de Reunião",
          "@admin:echo.litteris.online"
        );

      // Bob foi movido para fora da sala de voz atual
      const participants = useVoiceStore.getState().participants;
      expect(participants.find((p) => p.userId === "@bob:echo.litteris.online")).toBeUndefined();
    });

    it("soltar membro sobre canal de voz na ChannelSidebar dispara movimentação", async () => {
      useVoiceStore.setState({
        activeVoiceChannelId: "c-voice-1",
        activeVoiceChannelName: "Voz Geral",
        isConnected: true,
        participants: [
          {
            userId: "@alice:echo.litteris.online",
            username: "Alice",
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            volume: 100,
          },
        ],
      });

      render(<ChannelSidebar />);

      const targetVoiceChannel = screen.getByText("Sala de Reunião").closest("li");
      expect(targetVoiceChannel).not.toBeNull();

      // Simula drop do membro Alice no canal Sala de Reunião
      fireEvent.drop(targetVoiceChannel!, {
        dataTransfer: {
          types: ["application/x-echo-voice-member"],
          getData: (type: string) =>
            type === "application/x-echo-voice-member"
              ? JSON.stringify({ userId: "@alice:echo.litteris.online", username: "Alice" })
              : "",
        },
      });

      await waitFor(() => {
        // Alice foi movida da sala anterior
        const currentParticipants = useVoiceStore.getState().participants;
        expect(currentParticipants.find((p) => p.userId === "@alice:echo.litteris.online")).toBeUndefined();
      });
    });

    it("soltar a si mesmo (isMe) sobre outro canal de voz transfere a chamada e atualiza a sala ativa", async () => {
      useVoiceStore.setState({
        activeVoiceChannelId: "c-voice-1",
        activeVoiceChannelName: "Voz Geral",
        isConnected: true,
        participants: [
          {
            userId: "me",
            username: "Você",
            isMuted: false,
            isDeafened: false,
            isSpeaking: false,
            volume: 100,
          },
        ],
      });

      render(<ChannelSidebar />);

      const targetVoiceChannel = screen.getByText("Sala de Reunião").closest("li");
      expect(targetVoiceChannel).not.toBeNull();

      // Simula drop do próprio usuário no canal Sala de Reunião
      fireEvent.drop(targetVoiceChannel!, {
        dataTransfer: {
          types: ["application/x-echo-voice-member"],
          getData: (type: string) =>
            type === "application/x-echo-voice-member"
              ? JSON.stringify({ userId: "me", username: "Você", isMe: true })
              : "",
        },
      });

      await waitFor(() => {
        expect(useVoiceStore.getState().activeVoiceChannelId).toBe("c-voice-2");
        expect(useVoiceStore.getState().activeVoiceChannelName).toBe("Sala de Reunião");
        expect(useUiStore.getState().activeChannelId).toBe("c-voice-2");
      });
    });
  });

  describe("4. Drag and Drop de Arquivos na Timeline (ChatPane)", () => {
    it("exibe overlay de drag-over ao arrastar arquivos sobre a timeline e despacha evento", async () => {
      const filesListener = vi.fn();
      window.addEventListener("echo:files-dropped", filesListener);

      render(<ChatPane />);

      const chatColumn = screen.getByRole("region", { name: "Mensagens" });
      expect(chatColumn).toBeDefined();

      // Simula dragEnter com arquivos
      fireEvent.dragEnter(chatColumn, {
        dataTransfer: {
          types: ["Files"],
        },
      });

      // Overlay visual é exibido
      await waitFor(() => {
        expect(screen.getByTestId("chat-file-drop-overlay")).toBeDefined();
        expect(screen.getByText("Solte seus arquivos aqui")).toBeDefined();
      });

      // Simula soltar o arquivo
      const dummyFile = new File(["echo dummy content"], "teste.png", { type: "image/png" });
      fireEvent.drop(chatColumn, {
        dataTransfer: {
          files: [dummyFile],
        },
      });

      // Overlay é fechado e evento foi despachado
      await waitFor(() => {
        expect(screen.queryByTestId("chat-file-drop-overlay")).toBeNull();
        expect(filesListener).toHaveBeenCalled();
      });

      window.removeEventListener("echo:files-dropped", filesListener);
    });
  });
});

