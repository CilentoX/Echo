/**
 * Módulo de Notificações Nativas via tauri-plugin-notification.
 * Dispara toast do SO quando mensagem é recebida em canal inativo.
 * Respeita permissão do usuário e estado DND/presence.
 */
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useUiStore } from "@/stores/uiStore";

let permissionChecked = false;
let permissionGranted = false;

/** Verifica/solicita permissão de notificação (chamar uma vez no boot). */
export async function initNotifications(): Promise<void> {
  try {
    const granted = await isPermissionGranted();
    if (!granted) {
      const result = await requestPermission();
      permissionGranted = result === "granted";
    } else {
      permissionGranted = true;
    }
    permissionChecked = true;
  } catch {
    // Plugin não disponível (dev/browser) — silencioso
    permissionChecked = true;
    permissionGranted = false;
  }
}

/** Dispara notificação nativa se permitido e canal não estiver ativo. */
export async function notifyNewMessage(
  channelId: string,
  senderName: string,
  body: string,
): Promise<void> {
  if (!permissionChecked || !permissionGranted) return;

  // Não notificar se o canal já está ativo/focado
  const ui = useUiStore.getState();
  if (ui.activeChannelId === channelId) return;

  // Truncar corpo longo
  const truncatedBody = body.length > 120 ? body.slice(0, 117) + "..." : body;

  try {
    await sendNotification({
      title: senderName,
      body: truncatedBody,
      sound: "default",
    });
  } catch {
    // Falha silenciosa (SO bloqueou, app minimizado, etc.)
  }
}