/**
 * Módulo de Notificações Integrado do Echo:
 * - Notificações nativas do SO via @tauri-apps/plugin-notification (quando em segundo plano).
 * - Toasts visuais interativos em tempo real dentro do app.
 * - Alertas sonoros com sintetizador Web Audio harmônico e sem dependência de assets.
 * - Suporte completo a Novas Mensagens e Pedidos de Amizade.
 * - Respeita configurações de Notificações Nativas e status "Não Perturbar" (DND).
 */
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { useUiStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProfileStore } from "@/stores/profileStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useSyncStore } from "@/stores/syncStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { playMessageChime, playFriendRequestChime } from "./sound";

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

/** Dispara notificação de nova mensagem recebida (nativa + in-app toast + áudio). */
export async function notifyNewMessage(
  roomId: string,
  senderName: string,
  body: string,
  roomName?: string,
  senderAvatarUrl?: string | null,
  senderUserId?: string,
  isMention?: boolean,
): Promise<void> {
  const myUserId = useUiStore.getState().myUserId;
  // Não notifica mensagens enviadas pelo próprio usuário local
  if (senderUserId && myUserId && (senderUserId === myUserId || senderUserId.toLowerCase() === myUserId.toLowerCase())) {
    return;
  }

  // Respeita modo Não Perturbar (DND)
  const presence = useProfileStore.getState().presence;
  if (presence === "dnd") return;

  // Gate de mute: canais/guildas mutados não disparam notificações
  const syncState = useSyncStore.getState();
  const friends = useFriendsStore.getState().friends;
  const isDm = friends.some((f) => f.directRoomId === roomId);
  if (!isDm) {
    for (const [gId, channels] of Object.entries(syncState.channelsByGuild)) {
      if (channels.some((c) => c.channelId === roomId)) {
        if (syncState.isChannelMuted(roomId, gId)) return;
        break;
      }
    }
  }

  // Gate de mentionOnly: se ativado, só notifica menções (pula som e nativa, mantém toast)
  const mentionOnly = useSettingsStore.getState().mentionOnly;
  const shouldSuppressNonMention = mentionOnly && !isMention;

  // Se o canal já está ativo e a janela do app está focada, dispensa notificação intrusiva
  const ui = useUiStore.getState();
  const isChannelActive = ui.activeChannelId === roomId;
  const isWindowFocused = typeof document !== "undefined" && document.hasFocus();

  if (isChannelActive && isWindowFocused) {
    return;
  }

  // Toca chime sonoro suave se habilitado nas configurações (suprimido por mentionOnly)
  if (!shouldSuppressNonMention) {
    const soundEnabled = useSettingsStore.getState().messageSound;
    if (soundEnabled) {
      playMessageChime(0.25);
    }
  }

  const displayTitle = roomName ? `${senderName} (#${roomName})` : senderName;
  const truncatedBody = body.length > 120 ? body.slice(0, 117) + "..." : body;

  // Adiciona toast flutuante no app com ação de navegação
  useNotificationStore.getState().addNotification({
    type: "message",
    title: displayTitle,
    body: truncatedBody,
    avatarUrl: senderAvatarUrl ?? null,
    roomId,
    onClick: () => {
      // Localiza guilda dona do canal se aplicável
      const channelsByGuild = useSyncStore.getState().channelsByGuild;
      let targetGuildId: string | null = "home";
      for (const [gId, channels] of Object.entries(channelsByGuild)) {
        if (channels.some((c) => c.channelId === roomId)) {
          targetGuildId = gId;
          break;
        }
      }
      ui.setActiveGuild(targetGuildId);
      ui.setActiveChannel(roomId);
    },
  });

  // Notificação nativa do SO (se habilitada nas configurações; suprimida por mentionOnly)
  if (shouldSuppressNonMention) return;

  const nativeEnabled = useSettingsStore.getState().nativeNotifications;
  if (!nativeEnabled) return;

  if (permissionChecked && permissionGranted) {
    try {
      await sendNotification({
        title: displayTitle,
        body: truncatedBody,
        sound: "default",
      });
    } catch {
      // Falha silenciosa
    }
  }
}

/** Dispara notificação de solicitação de amizade recebida (nativa + in-app toast + áudio). */
export async function notifyFriendRequest(
  senderName: string,
  senderUserId?: string,
  avatarUrl?: string | null,
): Promise<void> {
  const myUserId = useUiStore.getState().myUserId;
  // Não notifica pedidos gerados pelo próprio usuário
  if (senderUserId && myUserId && (senderUserId === myUserId || senderUserId.toLowerCase() === myUserId.toLowerCase())) {
    return;
  }

  // Respeita modo Não Perturbar (DND)
  const presence = useProfileStore.getState().presence;
  if (presence === "dnd") return;

  // Alerta sonoro amigável se habilitado nas configurações
  const soundEnabled = useSettingsStore.getState().messageSound;
  if (soundEnabled) {
    playFriendRequestChime(0.3);
  }

  const title = "Novo Pedido de Amizade";
  const body = `${senderName} quer se conectar com você no Echo!`;

  // Adiciona toast in-app com botão direto para "Ver Pedidos"
  useNotificationStore.getState().addNotification({
    type: "friend_request",
    title,
    body,
    avatarUrl: avatarUrl ?? null,
    actionLabel: "Ver Pedidos",
    onAction: () => {
      const ui = useUiStore.getState();
      ui.setActiveGuild("home");
      ui.setActiveChannel(null);
      ui.setHomeTab("friends");
      useFriendsStore.getState().setActiveTab("pending");
      void useFriendsStore.getState().loadFriends();
    },
    onClick: () => {
      const ui = useUiStore.getState();
      ui.setActiveGuild("home");
      ui.setActiveChannel(null);
      ui.setHomeTab("friends");
      useFriendsStore.getState().setActiveTab("pending");
      void useFriendsStore.getState().loadFriends();
    },
  });

  // Notificação nativa do SO
  const nativeEnabled = useSettingsStore.getState().nativeNotifications;
  if (!nativeEnabled) return;

  if (permissionChecked && permissionGranted) {
    try {
      await sendNotification({
        title: "Solicitação de Amizade",
        body,
        sound: "default",
      });
    } catch {
      // Falha silenciosa
    }
  }
}
