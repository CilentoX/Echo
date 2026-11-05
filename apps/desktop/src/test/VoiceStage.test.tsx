import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import VoiceStage from "@/features/voice/VoiceStage";
import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";

vi.mock("@/lib/matrix/instance", () => ({
  matrixService: {
    getUserId: () => "@nina:echo.litteris.online",
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "@nina:echo.litteris.online",
      displayName: "Nina Silva",
      avatarUrl: "https://echo.litteris.online/avatar.png",
    }),
  },
}));

vi.mock("@/lib/api/echoApi", () => ({
  useEchoApi: () => ({
    getUserProfile: vi.fn().mockResolvedValue({
      userId: "@nina:echo.litteris.online",
      displayName: "Nina Silva",
      avatarUrl: "https://echo.litteris.online/avatar.png",
    }),
  }),
}));

describe("VoiceStage Component", () => {
  beforeEach(() => {
    useVoiceStore.getState().disconnectVoice();
    useUiStore.setState({
      myUserId: "@nina:echo.litteris.online",
      activeGuildId: "!guild1:echo",
      activeChannelId: "ch-voice-1",
    });
    useSyncStore.setState({
      channelsByGuild: {
        "!guild1:echo": [
          { channelId: "ch-text-1", name: "geral", type: "text", unreadCount: 0 },
          { channelId: "ch-voice-1", name: "Voz Geral", type: "voice", unreadCount: 0 },
        ],
      },
      guildMemberProfiles: {
        "!guild1:echo": {
          "@nina:echo.litteris.online": {
            id: "prof-1",
            guildId: "!guild1:echo",
            userId: "@nina:echo.litteris.online",
            nickname: "Nina Pro",
            avatarUrl: "https://echo.litteris.online/nina-guild.png",
          },
          "@amigo:echo.litteris.online": {
            id: "prof-2",
            guildId: "!guild1:echo",
            userId: "@amigo:echo.litteris.online",
            nickname: "Amigo Gamer",
            avatarUrl: null,
          },
        },
      },
    });
  });

  it("conecta automaticamente ao abrir o canal de áudio e exibe informações da sala", () => {
    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        topic="Bate-papo por voz da guilda"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    expect(screen.getByText("Voz Geral")).toBeTruthy();
    expect(screen.getByText("Bate-papo por voz da guilda")).toBeTruthy();
    expect(useVoiceStore.getState().activeVoiceChannelId).toBe("ch-voice-1");
  });

  it("renderiza os participantes conectados com apelidos e fotos de perfil quando conectado", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina Silva",
          avatarUrl: "https://echo.litteris.online/nina-guild.png",
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          volume: 100,
        },
        {
          userId: "@amigo:echo.litteris.online",
          username: "Amigo",
          avatarUrl: null,
          isMuted: true,
          isDeafened: false,
          isSpeaking: false,
          volume: 100,
        },
      ],
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    // Apelidos da guilda devem ser exibidos
    expect(screen.getByText("Nina Pro")).toBeTruthy();
    expect(screen.getByText("Amigo Gamer")).toBeTruthy();

    // Foto de perfil via MxcImage deve ser renderizada
    const avatarImg = screen.getByAltText("Nina Pro");
    expect(avatarImg).toBeTruthy();

    // Participante mutado exibe badge
    expect(screen.getByTitle("Microfone mutado")).toBeTruthy();
  });

  it("exibe a animação verde e badge 'Falando' quando o participante está falando", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina Pro",
          avatarUrl: null,
          isMuted: false,
          isDeafened: false,
          isSpeaking: true,
          volume: 100,
        },
      ],
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    // Indicador e badge de fala devem aparecer
    expect(screen.getByText("Falando")).toBeTruthy();
    expect(screen.getByTitle("Falando agora")).toBeTruthy();
  });

  it("permite alternar fala com o botão 'Falar (Teste)' para testar a animação", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina Pro",
          isSpeaking: false,
          volume: 100,
        },
      ],
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    const testSpeakBtn = screen.getByTitle("Clique para alternar fala e testar a animação verde em tempo real");
    expect(testSpeakBtn).toBeTruthy();

    fireEvent.click(testSpeakBtn);
    expect(useVoiceStore.getState().isSpeaking).toBe(true);

    fireEvent.click(testSpeakBtn);
    expect(useVoiceStore.getState().isSpeaking).toBe(false);
  });

  it("permite desconectar da chamada com o botão Desconectar e volta ao canal de texto", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    const disconnectBtn = screen.getByLabelText("Desconectar da chamada de voz");
    fireEvent.click(disconnectBtn);

    expect(useVoiceStore.getState().isConnected).toBe(false);
    expect(useVoiceStore.getState().activeVoiceChannelId).toBeNull();
    // Ao desconectar, redireciona o activeChannelId para o primeiro canal de texto da guilda
    expect(useUiStore.getState().activeChannelId).toBe("ch-text-1");
  });

  it("permite alternar compartilhamento de tela exibindo o palco cinema e botão de parar", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina Pro",
          isSpeaking: false,
          volume: 100,
        },
      ],
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    const shareBtn = screen.getByLabelText("Compartilhar tela");
    expect(shareBtn).toBeTruthy();

    fireEvent.click(shareBtn);

    // Modal próprio de compartilhamento de tela do Echo (estilo Discord) deve abrir
    expect(screen.getByText("Compartilhar Sua Tela")).toBeTruthy();
    expect(screen.getByText("Telas Inteiras")).toBeTruthy();
    expect(screen.getByText("Janelas de Aplicativos")).toBeTruthy();

    // Clica no botão "Transmitir ao Vivo"
    const goLiveBtn = screen.getByRole("button", { name: /Transmitir ao Vivo/i });
    expect(goLiveBtn).toBeTruthy();
    fireEvent.click(goLiveBtn);

    expect(useVoiceStore.getState().isScreenSharing).toBe(true);

    // Deve exibir o cinema de tela compartilhada
    expect(screen.getByText("Transmitindo Tela")).toBeTruthy();
    expect(screen.getByText("1080p 60fps")).toBeTruthy();

    const stopBtn = screen.getByRole("button", { name: /Parar Transmissão/i });
    expect(stopBtn).toBeTruthy();
    fireEvent.click(stopBtn);

    expect(useVoiceStore.getState().isScreenSharing).toBe(false);
  });

  it("permite alternar câmera ao vivo exibindo o badge de câmera ativa", () => {
    useVoiceStore.getState().connectVoice(
      "!guild1:echo",
      "Echo Guild",
      "ch-voice-1",
      "Voz Geral",
      [
        {
          userId: "@nina:echo.litteris.online",
          username: "Nina Pro",
          isSpeaking: false,
          volume: 100,
        },
      ],
    );

    render(
      <VoiceStage
        channelId="ch-voice-1"
        channelName="Voz Geral"
        guildId="!guild1:echo"
        guildName="Echo Guild"
      />,
    );

    const cameraBtn = screen.getByLabelText("Ativar câmera");
    expect(cameraBtn).toBeTruthy();

    fireEvent.click(cameraBtn);
    expect(useVoiceStore.getState().isCameraOn).toBe(true);
    expect(screen.getByText("Câmera ativa")).toBeTruthy();

    const cameraOffBtn = screen.getByLabelText("Desativar câmera");
    fireEvent.click(cameraOffBtn);
    expect(useVoiceStore.getState().isCameraOn).toBe(false);
  });
});
