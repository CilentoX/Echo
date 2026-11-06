import { openUrl } from "@tauri-apps/plugin-opener";
import { useAppLauncherStore } from "@/stores/appLauncherStore";

export interface LaunchAppOptions {
  appName: string;
  protocolUrl: string;
  webUrl: string;
}

/**
 * Mapeamento de esquemas de protocolo conhecidos para nomes amigáveis e URLs de fallback web.
 */
export const KNOWN_PROTOCOLS: Record<
  string,
  { appName: string; resolveWebUrl: (url: string) => string }
> = {
  steam: {
    appName: "Steam",
    resolveWebUrl: (url) => {
      const match = url.match(/steam:\/\/(?:store|run)\/(\d+)/i);
      if (match) {
        return `https://store.steampowered.com/app/${match[1]}/`;
      }
      return "https://store.steampowered.com/";
    },
  },
  spotify: {
    appName: "Spotify",
    resolveWebUrl: (url) => {
      const match = url.match(/spotify:(track|album|playlist|artist|episode|show):([a-zA-Z0-9]+)/i);
      if (match) {
        return `https://open.spotify.com/${match[1]}/${match[2]}`;
      }
      return "https://open.spotify.com/";
    },
  },
  discord: {
    appName: "Discord",
    resolveWebUrl: () => "https://discord.com/app",
  },
  tg: {
    appName: "Telegram",
    resolveWebUrl: (url) => {
      const match = url.match(/tg:\/\/resolve\?domain=([a-zA-Z0-9_]+)/i);
      if (match) {
        return `https://t.me/${match[1]}`;
      }
      return "https://web.telegram.org/";
    },
  },
};

/**
 * Tenta abrir uma URL de aplicativo nativo (ex: steam://, spotify:).
 * Se o aplicativo não estiver instalado ou falhar, exibe o alerta amigável
 * com o link direto para a versão web.
 */
export async function launchAppProtocol(options: LaunchAppOptions): Promise<void> {
  const { appName, protocolUrl, webUrl } = options;

  try {
    await openUrl(protocolUrl);
  } catch (err) {
    console.warn(`[AppLauncher] Falha ao abrir protocolo ${protocolUrl}:`, err);
    useAppLauncherStore.getState().openAlert({
      appName,
      webUrl,
      protocolUrl,
    });
  }
}

/**
 * Intercepta qualquer URL com esquema nativo desconhecido e executa com fallback web.
 */
export function handleProtocolLinkClick(rawUrl: string, e?: { preventDefault: () => void }): boolean {
  if (!rawUrl) return false;

  const schemeMatch = rawUrl.match(/^([a-zA-Z0-9._-]+):/);
  if (!schemeMatch) return false;

  const scheme = schemeMatch[1].toLowerCase();
  // Ignora protocolos web comuns (http, https, mailto, etc)
  if (["http", "https", "mailto", "tel", "blob", "data"].includes(scheme)) {
    return false;
  }

  e?.preventDefault();

  const config = KNOWN_PROTOCOLS[scheme];
  const appName = config?.appName || scheme.toUpperCase();
  const webUrl = config?.resolveWebUrl(rawUrl) || rawUrl;

  void launchAppProtocol({
    appName,
    protocolUrl: rawUrl,
    webUrl,
  });

  return true;
}

