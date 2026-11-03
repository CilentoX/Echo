import { create } from "zustand";

/**
 * Estado do auto-updater para a UI (splash compacta + banner).
 * `idle` = nada a mostrar; `checking` = verificando no boot;
 * `downloading` = baixando em background; `ready` = instalado, aplica no próximo restart.
 */
export type UpdateStatus = "idle" | "checking" | "downloading" | "ready";

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  progress: number | null;
  statusText: string | null;
  beginCheck: () => void;
  beginDownload: (version: string) => void;
  setProgress: (progress: number | null) => void;
  setStatusText: (text: string | null) => void;
  markReady: () => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: "idle",
  version: null,
  progress: null,
  statusText: null,
  beginCheck: () => set({ status: "checking", progress: null, statusText: null }),
  beginDownload: (version) => set({ status: "downloading", version }),
  setProgress: (progress) => set({ progress }),
  setStatusText: (statusText) => set({ statusText }),
  markReady: () => set({ status: "ready", progress: 100 }),
  reset: () => set({ status: "idle", version: null, progress: null, statusText: null }),
}));
