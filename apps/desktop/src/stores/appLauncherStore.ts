import { create } from "zustand";

export interface AppLauncherAlertState {
  isOpen: boolean;
  appName: string;
  webUrl: string;
  protocolUrl?: string;
  openAlert: (params: { appName: string; webUrl: string; protocolUrl?: string }) => void;
  closeAlert: () => void;
}

export const useAppLauncherStore = create<AppLauncherAlertState>((set) => ({
  isOpen: false,
  appName: "",
  webUrl: "",
  protocolUrl: undefined,
  openAlert: ({ appName, webUrl, protocolUrl }) =>
    set({
      isOpen: true,
      appName,
      webUrl,
      protocolUrl,
    }),
  closeAlert: () =>
    set({
      isOpen: false,
      appName: "",
      webUrl: "",
      protocolUrl: undefined,
    }),
}));

