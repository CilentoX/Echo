/**
 * Enumeração real de dispositivos de mídia da máquina.
 *
 * Usa navigator.mediaDevices.enumerateDevices (WebView2/Chromium no Tauri).
 * Quando os labels estão vazios (sem permissão do SO), tenta liberar via
 * getUserMedia — Discord pede permissão ao abrir as configurações de voz;
 * aqui pedimos apenas se ainda não há labels, e já paramos as tracks.
 */

export interface MediaDeviceOption {
  id: string;
  label: string;
}

export interface DeviceLists {
  microphone: MediaDeviceOption[];
  camera: MediaDeviceOption[];
  headphones: MediaDeviceOption[];
}

/** Usado quando o navegador não expõe mediaDevices ou nada foi enumerado. */
export const FALLBACK_DEVICES: DeviceLists = {
  microphone: [{ id: "default", label: "Microfone padrão do sistema" }],
  camera: [{ id: "default", label: "Câmera padrão do sistema" }],
  headphones: [{ id: "default", label: "Áudio padrão do sistema" }],
};

const KIND_MAP: Record<string, keyof DeviceLists> = {
  audioinput: "microphone",
  videoinput: "camera",
  audiooutput: "headphones",
};

const FALLBACK_LABELS: Record<keyof DeviceLists, string> = {
  microphone: "Microfone",
  camera: "Câmera",
  headphones: "Saída de áudio",
};

export async function listRealDevices(): Promise<DeviceLists> {
  const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!md?.enumerateDevices) return FALLBACK_DEVICES;

  let infos = await md.enumerateDevices();

  // Sem permissão todos os labels vêm vazios: pede permissão (para as tracks
  // imediatamente) e reenumera. Se negar, seguimos com labels genéricos.
  if (infos.length > 0 && infos.every((d) => !d.label)) {
    try {
      const stream = await md.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((t) => t.stop());
      infos = await md.enumerateDevices();
    } catch {
      // permissão negada ou sem hardware — usa placeholders numerados
    }
  }

  const lists: DeviceLists = { microphone: [], camera: [], headphones: [] };
  const counters: Record<keyof DeviceLists, number> = {
    microphone: 0,
    camera: 0,
    headphones: 0,
  };

  for (const d of infos) {
    const key = KIND_MAP[d.kind];
    if (!key || !d.deviceId) continue;
    counters[key] += 1;
    const label = d.label || `${FALLBACK_LABELS[key]} ${counters[key]}`;
    lists[key].push({ id: d.deviceId, label });
  }

  // Categoria sem dispositivo (ex.: desktop sem câmera) mantém o padrão do sistema.
  for (const key of ["microphone", "camera", "headphones"] as const) {
    if (lists[key].length === 0) lists[key] = FALLBACK_DEVICES[key];
  }

  return lists;
}
