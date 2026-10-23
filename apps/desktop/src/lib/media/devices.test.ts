import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_DEVICES, listRealDevices } from "./devices";

interface FakeInfo {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
}

/** Instala um navigator.mediaDevices falso e devolve os spies. */
function mockMediaDevices(infos: FakeInfo[], getUserMediaImpl?: () => Promise<unknown>) {
  const enumerateDevices = vi.fn(async () => infos as unknown as MediaDeviceInfo[]);
  const getUserMedia = vi.fn(
    getUserMediaImpl ??
      (async () => {
        throw new Error("denied");
      })
  );
  Object.defineProperty(navigator, "mediaDevices", {
    value: { enumerateDevices, getUserMedia },
    configurable: true,
    writable: true,
  });
  return { enumerateDevices, getUserMedia };
}

/** Remove navigator.mediaDevices (estado padrão do jsdom). */
function mockNoMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  mockNoMediaDevices();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listRealDevices", () => {
  it("retorna o fallback quando navigator.mediaDevices não existe", async () => {
    const result = await listRealDevices();
    expect(result).toEqual(FALLBACK_DEVICES);
  });

  it("categoriza dispositivos reais por kind (audioinput/videoinput/audiooutput)", async () => {
    mockMediaDevices([
      { deviceId: "mic-1", kind: "audioinput", label: "Microfone Realtek", groupId: "g1" },
      { deviceId: "cam-1", kind: "videoinput", label: "Câmera Integrada", groupId: "g2" },
      { deviceId: "spk-1", kind: "audiooutput", label: "Alto-falantes (Realtek)", groupId: "g3" },
    ]);

    const result = await listRealDevices();

    expect(result.microphone).toEqual([{ id: "mic-1", label: "Microfone Realtek" }]);
    expect(result.camera).toEqual([{ id: "cam-1", label: "Câmera Integrada" }]);
    expect(result.headphones).toEqual([{ id: "spk-1", label: "Alto-falantes (Realtek)" }]);
  });

  it("pede permissão via getUserMedia quando os labels estão vazios e usa os labels liberados", async () => {
    const { getUserMedia, enumerateDevices } = mockMediaDevices(
      [
        { deviceId: "mic-1", kind: "audioinput", label: "", groupId: "g1" },
        { deviceId: "cam-1", kind: "videoinput", label: "", groupId: "g2" },
      ],
      async () => ({
        getTracks: () => [{ stop: vi.fn() }, { stop: vi.fn() }],
      })
    );
    // Segunda chamada (pós-permissão) devolve labels
    enumerateDevices
      .mockResolvedValueOnce([
        { deviceId: "mic-1", kind: "audioinput", label: "", groupId: "g1" },
        { deviceId: "cam-1", kind: "videoinput", label: "", groupId: "g2" },
      ] as unknown as MediaDeviceInfo[])
      .mockResolvedValueOnce([
        { deviceId: "mic-1", kind: "audioinput", label: "Microfone Realtek", groupId: "g1" },
        { deviceId: "cam-1", kind: "videoinput", label: "Câmera Integrada", groupId: "g2" },
      ] as unknown as MediaDeviceInfo[]);

    const result = await listRealDevices();

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true, video: true });
    expect(result.microphone[0].label).toBe("Microfone Realtek");
    expect(result.camera[0].label).toBe("Câmera Integrada");
  });

  it("usa placeholders numerados quando o usuário nega a permissão", async () => {
    mockMediaDevices([
      { deviceId: "mic-1", kind: "audioinput", label: "", groupId: "g1" },
      { deviceId: "mic-2", kind: "audioinput", label: "", groupId: "g1" },
      { deviceId: "cam-1", kind: "videoinput", label: "", groupId: "g2" },
    ]);

    const result = await listRealDevices();

    expect(result.microphone).toEqual([
      { id: "mic-1", label: "Microfone 1" },
      { id: "mic-2", label: "Microfone 2" },
    ]);
    expect(result.camera).toEqual([{ id: "cam-1", label: "Câmera 1" }]);
    expect(result.headphones).toEqual(FALLBACK_DEVICES.headphones);
  });

  it("ignora kinds desconhecidos e entradas sem deviceId", async () => {
    mockMediaDevices([
      { deviceId: "", kind: "audioinput", label: "Sem id", groupId: "g1" },
      { deviceId: "weird", kind: "sometingelse", label: "Kind inválido", groupId: "g2" },
      { deviceId: "mic-1", kind: "audioinput", label: "Microfone ok", groupId: "g3" },
    ]);

    const result = await listRealDevices();

    expect(result.microphone).toEqual([{ id: "mic-1", label: "Microfone ok" }]);
    expect(result.camera).toEqual(FALLBACK_DEVICES.camera);
  });
});
