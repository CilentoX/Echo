import { create } from "zustand";

export interface InAppNotification {
  id: string;
  type: "message" | "friend_request" | "system";
  title: string;
  body: string;
  avatarUrl?: string | null;
  roomId?: string;
  guildId?: string;
  createdAt: number;
  onClick?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

export interface NotificationStoreState {
  notifications: InAppNotification[];
  addNotification: (item: Omit<InAppNotification, "id" | "createdAt">) => string;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStoreState>((set) => ({
  notifications: [],

  addNotification: (item) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newNotification: InAppNotification = {
      ...item,
      id,
      createdAt: Date.now(),
    };

    set((state) => ({
      // Mantém no máximo 4 notificações simultâneas no topo
      notifications: [newNotification, ...state.notifications].slice(0, 4),
    }));

    // Auto-dismiss após 4.5 segundos
    setTimeout(() => {
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      }));
    }, 4500);

    return id;
  },

  dismissNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

