import { useEffect, useMemo, useState } from "react";
import { Users, Plus, X, MagnifyingGlass, ChatCircle } from "@phosphor-icons/react";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";
import MxcImage from "@/components/media/MxcImage";

export interface HomeSidebarProps {
  variant?: "static" | "overlay";
  onClose?: () => void;
}

export default function HomeSidebar({ variant = "static", onClose }: HomeSidebarProps) {
  const overlay = variant === "overlay";
  const { friends, pendingIncoming, loadFriends, openDirectMessage, setActiveTab } = useFriendsStore();
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);
  const uiPresence = useUiStore((s) => s.presence);

  const [search, setSearch] = useState("");

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  const filteredFriends = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        (f.nickname ?? "").toLowerCase().includes(q) ||
        f.userId.toLowerCase().includes(q),
    );
  }, [friends, search]);

  const handleSelectFriendsTab = () => {
    setActiveChannel(null);
    useFriendsStore.getState().setSelectedFriendId(null);
    onClose?.();
  };

  const handleOpenDm = async (userId: string) => {
    await openDirectMessage(userId);
    onClose?.();
  };

  const handleAddFriendClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveChannel(null);
    useFriendsStore.getState().setSelectedFriendId(null);
    setActiveTab("add");
    onClose?.();
  };

  return (
    <aside
      data-column="sidebar"
      aria-label="Mensagens Diretas e Amigos"
      className={`flex w-[232px] shrink-0 flex-col border-r border-bd bg-rail select-none ${
        overlay
          ? "fixed inset-y-0 left-[72px] z-20 shadow-lg shadow-black/60"
          : "h-full"
      }`}
    >
      {/* Header com Busca Rápida */}
      <header className="flex h-14 items-center justify-between border-b border-bd px-3">
        <div className="relative w-full">
          <MagnifyingGlass
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mut pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Encontrar conversa..."
            className="w-full rounded bg-bg/80 py-1.5 pl-8 pr-2 text-xs text-txt placeholder:text-mut focus:bg-bg focus:outline-none focus:ring-1 focus:ring-acc transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-mut hover:text-txt"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </header>

      {/* Navegação Principal */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1 scrollbar-thin">
        {/* Botão Amigos */}
        <button
          type="button"
          onClick={handleSelectFriendsTab}
          className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
            !activeChannelId
              ? "bg-surf2 text-txt"
              : "text-mut hover:bg-surf2/50 hover:text-txt"
          }`}
        >
          <Users
            size={20}
            weight={!activeChannelId ? "fill" : "regular"}
            className={!activeChannelId ? "text-acc" : "text-mut group-hover:text-txt"}
          />
          <span className="flex-1 text-left truncate text-xs font-semibold">Amigos</span>
          {pendingIncoming.length > 0 && (
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
              title={`${pendingIncoming.length} pedidos pendentes`}
            >
              {pendingIncoming.length}
            </span>
          )}
        </button>

        {/* Separador e Cabeçalho DMs */}
        <div className="pt-4 pb-1.5 px-2 flex items-center justify-between group">
          <span className="text-[10px] font-bold uppercase tracking-wider text-mut">
            Mensagens Diretas
          </span>
          <button
            type="button"
            onClick={handleAddFriendClick}
            title="Criar conversa / Adicionar Amigo"
            aria-label="Adicionar Amigo"
            className="cursor-pointer text-mut hover:text-acc p-0.5 rounded transition-colors"
          >
            <Plus size={14} weight="bold" />
          </button>
        </div>

        {/* Lista de Mensagens Diretas / Amigos */}
        {filteredFriends.length === 0 ? (
          <div className="px-2 py-6 text-center text-mut space-y-2">
            <ChatCircle size={28} className="mx-auto opacity-30" />
            <p className="text-[11px] leading-relaxed">
              {search ? "Nenhum amigo encontrado." : "Nenhuma conversa direta ainda."}
            </p>
          </div>
        ) : (
          filteredFriends.map((friend) => {
            const isDmActive = activeChannelId === friend.directRoomId;
            const presence = uiPresence[friend.userId] || friend.presence || "offline";
            const presenceColor =
              presence === "online"
                ? "bg-emerald-500"
                : presence === "unavailable"
                ? "bg-amber-500"
                : "bg-zinc-500";

            return (
              <button
                key={friend.friendshipId}
                type="button"
                onClick={() => handleOpenDm(friend.userId)}
                className={`group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                  isDmActive
                    ? "bg-surf2 text-txt"
                    : "text-mut hover:bg-surf2/50 hover:text-txt"
                }`}
              >
                {/* Avatar com status */}
                <div className="relative shrink-0">
                  {friend.avatarUrl ? (
                    <MxcImage
                      mxcUrl={friend.avatarUrl}
                      alt={friend.displayName}
                      className="h-8 w-8 rounded-full object-cover"
                      width={32}
                      height={32}
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc/20 font-display text-xs font-bold text-acc">
                      {friend.displayName.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-rail ${presenceColor}`}
                    aria-hidden="true"
                  />
                </div>

                {/* Nome do amigo */}
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-txt group-hover:text-txt">
                    {friend.displayName}
                  </p>
                  <p className="truncate text-[10px] text-mut font-mono">
                    {friend.nickname ? `@${friend.nickname}` : friend.userId.split(":")[0]}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
