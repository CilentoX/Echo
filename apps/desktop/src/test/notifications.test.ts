import { describe, it, expect, beforeEach, vi } from "vitest";
import { useNotificationStore } from "@/stores/notificationStore";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { notifyNewMessage, notifyFriendRequest } from "@/lib/notifications/nativeNotify";
import { playMessageChime, playFriendRequestChime } from "@/lib/notifications/sound";

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue("granted"),
  sendNotification: vi.fn().mockResolvedValue(undefined),
}));

describe("Sistema de Notificações - Store, Chimes e Triggers", () => {
  beforeEach(() => {
    useNotificationStore.getState().clearAll();
    useUiStore.getState().setMyUserId("@test:domain");
    useUiStore.getState().setActiveChannel("room-active");
    useProfileStore.setState({ presence: "online" });
    useSettingsStore.setState({ nativeNotifications: true });
    vi.clearAllMocks();
  });

  it("notificationStore adiciona toasts e respeita o limite máximo de 4 itens simultâneos", () => {
    const store = useNotificationStore.getState();

    store.addNotification({ type: "message", title: "Msg 1", body: "Corpo 1" });
    store.addNotification({ type: "message", title: "Msg 2", body: "Corpo 2" });
    store.addNotification({ type: "message", title: "Msg 3", body: "Corpo 3" });
    store.addNotification({ type: "friend_request", title: "Amigo 4", body: "Corpo 4" });
    expect(useNotificationStore.getState().notifications).toHaveLength(4);

    // Inserindo o 5º: o mais antigo deve ser removido, mantendo 4
    store.addNotification({ type: "message", title: "Msg 5", body: "Corpo 5" });
    const current = useNotificationStore.getState().notifications;
    expect(current).toHaveLength(4);
    expect(current[0].title).toBe("Msg 5");
  });

  it("notificationStore permite dispensar uma notificação específica e limpar todas", () => {
    const store = useNotificationStore.getState();
    const id = store.addNotification({ type: "message", title: "Teste", body: "Olá" });
    expect(useNotificationStore.getState().notifications).toHaveLength(1);

    store.dismissNotification(id);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);

    store.addNotification({ type: "system", title: "Sys", body: "Info" });
    store.clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("sound helpers executam suavemente sem falhar mesmo em ambientes de teste sem Web Audio completo", () => {
    expect(() => playMessageChime(0.1)).not.toThrow();
    expect(() => playFriendRequestChime(0.1)).not.toThrow();
  });

  it("notifyNewMessage ignora mensagens enviadas pelo próprio usuário local", async () => {
    await notifyNewMessage("room-other", "Meu Nome", "Oi", undefined, null, "@test:domain");
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("notifyNewMessage não notifica quando em modo DND (Não Perturbar)", async () => {
    useProfileStore.setState({ presence: "dnd" });
    await notifyNewMessage("room-other", "Outro Amigo", "Oi!", undefined, null, "@outro:domain");
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("notifyNewMessage adiciona toast quando mensagem chega em canal inativo ou com janela em segundo plano", async () => {
    // Canal diferente de "room-active"
    await notifyNewMessage("room-other", "Amigo Legal", "Nova mensagem!", "geral", null, "@outro:domain");
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toContain("Amigo Legal (#geral)");
    expect(notifications[0].body).toBe("Nova mensagem!");
  });

  it("notifyFriendRequest adiciona toast e ação de ver pedidos", async () => {
    await notifyFriendRequest("Carlos Silva", "@carlos:domain", null);
    const notifications = useNotificationStore.getState().notifications;
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("friend_request");
    expect(notifications[0].title).toBe("Novo Pedido de Amizade");
    expect(notifications[0].body).toContain("Carlos Silva");
    expect(notifications[0].actionLabel).toBe("Ver Pedidos");
  });

  it("notifyFriendRequest ignora requisição do próprio usuário", async () => {
    await notifyFriendRequest("Eu mesmo", "@test:domain", null);
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });

  it("notifyNewMessage e notifyFriendRequest respeitam messageSound: false", async () => {
    useSettingsStore.setState({ messageSound: false });
    await notifyNewMessage("room-other", "Amigo", "Oi", undefined, null, "@outro:domain");
    await notifyFriendRequest("Outro Amigo", "@amigo:domain", null);
    expect(useNotificationStore.getState().notifications).toHaveLength(2);
  });
});

