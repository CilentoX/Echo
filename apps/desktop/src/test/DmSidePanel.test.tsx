import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DmSidePanel from "@/features/shell/DmSidePanel";
import { useUiStore } from "@/stores/uiStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useVoiceStore } from "@/stores/voiceStore";

describe("DmSidePanel Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVoiceStore.getState().disconnectVoice();
    useUiStore.setState({
      activeGuildId: "home",
      activeChannelId: "!dm1:hs",
      presence: {
        "@amigo:hs": "online",
        "@outro:hs": "online",
      },
    });
    useFriendsStore.setState({
      friends: [
        {
          friendshipId: "f1",
          userId: "@amigo:hs",
          displayName: "Carlos Amigo",
          nickname: "carlos",
          avatarUrl: null,
          status: "accepted",
          directRoomId: "!dm1:hs",
          bio: "Desenvolvedor entusiasta do Echo",
          presence: "online",
        },
        {
          friendshipId: "f2",
          userId: "@outro:hs",
          displayName: "Mariana Online",
          nickname: "mari",
          avatarUrl: null,
          status: "accepted",
          directRoomId: "!dm2:hs",
          presence: "online",
        },
      ],
    });
  });

  it("renderiza o perfil do amigo ativo com nome, @nickname, bio e status", () => {
    render(<DmSidePanel />);

    expect(screen.getByText("Perfil do Usuário")).toBeTruthy();
    expect(screen.getByText("Carlos Amigo")).toBeTruthy();
    expect(screen.getByText("@carlos")).toBeTruthy();
    expect(screen.getByText("Desenvolvedor entusiasta do Echo")).toBeTruthy();
    expect(screen.getByText("Disponível")).toBeTruthy();
    expect(screen.getByText("Criptografia ponta a ponta")).toBeTruthy();
  });

  it("permite iniciar chamada de voz direta com o amigo", async () => {
    const user = userEvent.setup();
    render(<DmSidePanel />);

    const callBtn = screen.getByTitle("Iniciar chamada de voz");
    expect(callBtn).toBeTruthy();

    await user.click(callBtn);

    expect(useVoiceStore.getState().isConnected).toBe(true);
    expect(useVoiceStore.getState().activeVoiceChannelName).toBe("Carlos Amigo");
  });

  it("renderiza amigos online na seção Ativo Agora", () => {
    render(<DmSidePanel />);

    expect(screen.getByText("Amigos Conectados")).toBeTruthy();
    expect(screen.getByText("Mariana Online")).toBeTruthy();
    expect(screen.getByText("Disponível no Echo")).toBeTruthy();
  });

  it("quando variant é overlay, exibe botão de fechar e dispara onClose", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DmSidePanel variant="overlay" onClose={onClose} />);

    const closeBtn = screen.getByRole("button", { name: "Fechar painel" });
    expect(closeBtn).toBeTruthy();

    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
