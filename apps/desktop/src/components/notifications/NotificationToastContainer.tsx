"use client";

import { useNotificationStore, type InAppNotification } from "@/stores/notificationStore";
import { X, ChatCircleText, UserPlus, Bell } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";

export default function NotificationToastContainer() {
  const notifications = useNotificationStore((s) => s.notifications);
  const dismissNotification = useNotificationStore((s) => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div
      data-testid="notification-toast-container"
      className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none"
    >
      {notifications.map((item) => (
        <ToastItem
          key={item.id}
          notification={item}
          onDismiss={() => dismissNotification(item.id)}
        />
      ))}
    </div>
  );
}

function ToastItem({
  notification,
  onDismiss,
}: {
  notification: InAppNotification;
  onDismiss: () => void;
}) {
  const { title, body, avatarUrl, type, onClick, actionLabel, onAction } = notification;

  const handleClick = () => {
    if (onClick) {
      onClick();
      onDismiss();
    }
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAction) {
      onAction();
      onDismiss();
    } else if (onClick) {
      onClick();
      onDismiss();
    }
  };

  return (
    <div
      role="alert"
      onClick={handleClick}
      className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl bg-[#12161f]/95 backdrop-blur-md border border-white/[0.08] shadow-2xl transition-all duration-200 hover:border-acc/40 hover:bg-[#161b26]/95 group animate-in slide-in-from-top-4 fade-in-0 ${
        onClick ? "cursor-pointer active:scale-[0.99]" : ""
      }`}
    >
      {/* Avatar ou Ícone Temático */}
      <div className="relative shrink-0 mt-0.5">
        {avatarUrl ? (
          <MxcImage
            mxcUrl={avatarUrl}
            alt={title}
            className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10"
            width={40}
            height={40}
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center text-bg shadow-sm ${
              type === "friend_request" ? "bg-acc" : "bg-indigo-500"
            }`}
          >
            {type === "friend_request" ? (
              <UserPlus size={20} weight="bold" />
            ) : type === "message" ? (
              <ChatCircleText size={20} weight="bold" />
            ) : (
              <Bell size={20} weight="bold" />
            )}
          </div>
        )}

        {/* Badge indicador de tipo */}
        {avatarUrl && (
          <span
            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-bg ${
              type === "friend_request" ? "bg-acc" : "bg-indigo-500"
            }`}
          >
            {type === "friend_request" ? (
              <UserPlus size={10} weight="bold" />
            ) : (
              <ChatCircleText size={10} weight="bold" />
            )}
          </span>
        )}
      </div>

      {/* Conteúdo da Notificação */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-semibold text-txt truncate group-hover:text-acc transition-colors">
            {title}
          </h4>
          <span className="text-[10px] text-mut/60 font-mono shrink-0">Agora</span>
        </div>
        <p className="text-xs text-mut/90 line-clamp-2 mt-0.5 leading-snug break-words">
          {body}
        </p>

        {actionLabel && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={handleAction}
              className="cursor-pointer px-2.5 py-1 rounded-lg bg-acc text-bg text-[11px] font-semibold hover:bg-acc-press active:scale-95 transition-all shadow-sm"
            >
              {actionLabel}
            </button>
          </div>
        )}
      </div>

      {/* Botão de Fechar */}
      <button
        type="button"
        aria-label="Dispensar notificação"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="cursor-pointer shrink-0 text-mut hover:text-txt p-1 rounded-lg hover:bg-white/[0.06] transition-colors -mr-1 -mt-1"
      >
        <X size={14} />
      </button>
    </div>
  );
}

