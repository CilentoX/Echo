import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceConnectionBar from "@/features/shell/VoiceConnectionBar";
import { useVoiceStore } from "@/stores/voiceStore";

describe("VoiceConnectionBar Component", () => {
  beforeEach(() => {
    useVoiceStore.getState().disconnectVoice();
  });

  it("não renderiza nada quando desconectado", () => {
    const { container } = render(<VoiceConnectionBar />);
    expect(container.firstChild).toBeNull();
  });

  it("renderiza indicador de conexão e detalhes do canal quando conectado", () => {
    useVoiceStore.setState({
      isConnected: true,
      isConnecting: false,
      activeVoiceGuildName: "Guilda dos Devs",
      activeVoiceChannelName: "Sala de Reunião",
      pingMs: 22,
    });

    render(<VoiceConnectionBar />);

    expect(screen.getByTestId("voice-connection-bar")).toBeTruthy();
    expect(screen.getByText("Voz Conectada")).toBeTruthy();
    expect(screen.getByText(/Guilda dos Devs \/ #Sala de Reunião/)).toBeTruthy();
    expect(screen.getByText("22ms")).toBeTruthy();
  });

  it("permite desconectar da chamada ao clicar no botão de desconectar", async () => {
    useVoiceStore.setState({
      isConnected: true,
      isConnecting: false,
      activeVoiceChannelId: "ch-1",
      activeVoiceChannelName: "Voz Geral",
    });

    render(<VoiceConnectionBar />);

    const disconnectBtn = screen.getByTestId("voice-disconnect-btn");
    await userEvent.click(disconnectBtn);

    expect(useVoiceStore.getState().isConnected).toBe(false);
    expect(useVoiceStore.getState().activeVoiceChannelId).toBeNull();
  });
});
