import { create } from "zustand";

/**
 * Estado do auto-updater para a UI (banner estilo Discord).
 * `idle` = nada a mostrar; `downloading` = baixando em background;
 * `ready` = instalado, aplica no próximo restart.
 */
export type UpdateStatus = "idle" | "downloading" | "ready";

interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  beginDownload: (version: string) => void;
  markReady: () => void;
  reset: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  status: "idle",
  version: null,
  beginDownload: (version) => set({ status: "downloading", version }),
  markReady: () => set({ status: "ready" }),
  reset: () => set({ status: "idle", version: null }),
}));
