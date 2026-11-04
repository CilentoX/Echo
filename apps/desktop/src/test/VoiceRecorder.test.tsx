import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceRecorder from "@/features/chat/VoiceRecorder";

describe("VoiceRecorder Component", () => {
  let mockStream: any;
  let mockTrack: any;
  let mockRecorder: any;

  beforeEach(() => {
    mockTrack = {
      stop: vi.fn(),
    };

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };

    mockRecorder = {
      state: "inactive",
      mimeType: "audio/webm;codecs=opus",
      start: vi.fn(function (this: any) {
        this.state = "recording";
      }),
      pause: vi.fn(function (this: any) {
        this.state = "paused";
      }),
      resume: vi.fn(function (this: any) {
        this.state = "recording";
      }),
      stop: vi.fn(function (this: any) {
        this.state = "inactive";
        if (this.onstop) this.onstop();
      }),
      ondataavailable: null,
      onstop: null,
    };

    function MockMediaRecorder(this: any) {
      return mockRecorder;
    }
    MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);
    (window as any).MediaRecorder = MockMediaRecorder;

    Object.defineProperty(navigator, "mediaDevices", {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    });

    function MockAudioContext(this: any) {
      return {
        state: "running",
        createMediaStreamSource: vi.fn(() => ({
          connect: vi.fn(),
        })),
        createAnalyser: vi.fn(() => ({
          fftSize: 128,
          frequencyBinCount: 64,
          getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(100)),
        })),
        close: vi.fn().mockResolvedValue(undefined),
      };
    }
    (window as any).AudioContext = MockAudioContext;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("inicia gravação ao montar e renderiza o container e timer inicial", async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(<VoiceRecorder onCancel={onCancel} onSend={onSend} />);

    expect(screen.getByTestId("voice-recorder")).toBeTruthy();
    expect(screen.getByText("00:00")).toBeTruthy();

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(mockRecorder.start).toHaveBeenCalledWith(100);
  });

  it("permite pausar e retomar a gravação", async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(<VoiceRecorder onCancel={onCancel} onSend={onSend} />);

    await act(async () => {
      await Promise.resolve();
    });

    const pauseButton = screen.getByRole("button", { name: "Pausar gravação" });
    await userEvent.click(pauseButton);

    expect(mockRecorder.pause).toHaveBeenCalled();

    const resumeButton = screen.getByRole("button", { name: "Retomar gravação" });
    await userEvent.click(resumeButton);

    expect(mockRecorder.resume).toHaveBeenCalled();
  });

  it("cancela e descarta a gravação ao clicar na lixeira", async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(<VoiceRecorder onCancel={onCancel} onSend={onSend} />);

    await act(async () => {
      await Promise.resolve();
    });

    const discardBtn = screen.getByRole("button", { name: "Descartar gravação" });
    await userEvent.click(discardBtn);

    expect(onCancel).toHaveBeenCalled();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("envia áudio gravado ao clicar em enviar", async () => {
    const onCancel = vi.fn();
    const onSend = vi.fn();

    render(<VoiceRecorder onCancel={onCancel} onSend={onSend} />);

    await act(async () => {
      await Promise.resolve();
    });

    // Simula chunk recebido
    if (mockRecorder.ondataavailable) {
      mockRecorder.ondataavailable({ data: new Blob(["fake-audio"], { type: "audio/webm" }) });
    }

    const sendBtn = screen.getByRole("button", { name: "Enviar mensagem de voz" });
    await userEvent.click(sendBtn);

    expect(mockRecorder.stop).toHaveBeenCalled();
    expect(onSend).toHaveBeenCalled();
    const [file, duration] = onSend.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(typeof duration).toBe("number");
  });
});
