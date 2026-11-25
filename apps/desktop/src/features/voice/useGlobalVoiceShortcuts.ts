import { useEffect } from "react";
import { isTauri } from "@/lib/updater";
import { useVoiceStore } from "@/stores/voiceStore";

const MUTE_SHORTCUT = "CommandOrControl+Shift+M";
const DEAFEN_SHORTCUT = "CommandOrControl+Shift+D";

/**
 * Registra atalhos globais de sistema operacional (Tauri) para mutar microfone
 * (`Ctrl+Shift+M`) e ensurdecer (`Ctrl+Shift+D`), funcionando mesmo com o Echo
 * minimizado ou fora de foco.
 */
export function useGlobalVoiceShortcuts(): void {
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    const registered: string[] = [];

    void (async () => {
      try {
        const { register, unregister } = await import("@tauri-apps/plugin-global-shortcut");
        if (cancelled) return;

        await register(MUTE_SHORTCUT, (event) => {
          if (event.state === "Pressed") {
            useVoiceStore.getState().toggleMute();
          }
        }).then(() => {
          registered.push(MUTE_SHORTCUT);
        }).catch(() => {});

        if (cancelled) {
          for (const key of registered) {
            void unregister(key).catch(() => {});
          }
          return;
        }

        await register(DEAFEN_SHORTCUT, (event) => {
          if (event.state === "Pressed") {
            useVoiceStore.getState().toggleDeafen();
          }
        }).then(() => {
          registered.push(DEAFEN_SHORTCUT);
        }).catch(() => {});
      } catch {
        // Ambiente sem plugin global-shortcut disponível
      }
    })();

    return () => {
      cancelled = true;
      if (registered.length === 0) return;
      void import("@tauri-apps/plugin-global-shortcut")
        .then(({ unregister }) => {
          for (const key of registered) {
            void unregister(key).catch(() => {});
          }
        })
        .catch(() => {});
    };
  }, []);
}
