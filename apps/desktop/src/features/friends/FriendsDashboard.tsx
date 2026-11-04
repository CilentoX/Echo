import { useState, useMemo } from "react";
import {
  Users,
  Check,
  X,
  ChatCircle,
  DotsThreeVertical,
  Prohibit,
  UserMinus,
  PaperPlaneTilt,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUiStore } from "@/stores/uiStore";
import MxcImage from "@/components/media/MxcImage";

export default function FriendsDashboard() {
  const {
    friends,
    pendingIncoming,
    pendingOutgoing,
    blocked,
    activeTab,
    setActiveTab,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    cancelFriendRequest,
    removeFriend,
    blockUser,
    unblockUser,
    openDirectMessage,
    error,
    successMessage,
    clearMessages,
  } = useFriendsStore();

  const uiPresence = useUiStore((s) => s.presence);

  const [addInput, setAddInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filtra amigos online
  const onlineFriends = useMemo(() => {
    return friends.filter((f) => {
      const presence = uiPresence[f.userId] || f.presence || "offline";
      return presence !== "offline";
    });
  }, [friends, uiPresence]);

  // Filtra lista ativa pela busca
  const displayedFriends = useMemo(() => {
    const list = activeTab === "online" ? onlineFriends : friends;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (f) =>
        f.displayName.toLowerCase().includes(q) ||
        (f.nickname ?? "").toLowerCase().includes(q) ||
        f.userId.toLowerCase().includes(q),
    );
  }, [activeTab, onlineFriends, friends, searchQuery]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addInput.trim() || submitting) return;
    setSubmitting(true);
    try {
      await sendFriendRequest(addInput.trim());
      setAddInput("");
    } catch {
      // erro gerenciado pelo store
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (fn: () => Promise<void>) => {
    try {
      await fn();
      setOpenMenuId(null);
    } catch {
      // store handles error
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-bg text-txt select-none">
      {/* Barra de Navegação Superior (Tabs) — Integrada com harmonia */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.04] px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 pr-4 border-r border-white/[0.08] text-txt font-semibold">
            <Users size={20} className="text-acc" weight="bold" />
            <span className="font-display text-sm tracking-wide">Amigos</span>
          </div>

          <nav className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("online")}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "online"
                  ? "bg-white/[0.08] text-txt shadow-sm"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              Disponível ({onlineFriends.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "all"
                  ? "bg-white/[0.08] text-txt shadow-sm"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              Todos ({friends.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`cursor-pointer relative px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "pending"
                  ? "bg-white/[0.08] text-txt shadow-sm"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              Pendente
              {pendingIncoming.length > 0 && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                  {pendingIncoming.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("blocked")}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "blocked"
                  ? "bg-white/[0.08] text-txt shadow-sm"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              Bloqueados ({blocked.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("add")}
              className={`cursor-pointer ml-2 px-3 py-1.5 rounded-xl font-semibold transition-all shadow-sm ${
                activeTab === "add"
                  ? "bg-acc text-bg shadow-acc/25"
                  : "bg-acc/15 text-acc hover:bg-acc hover:text-bg"
              }`}
            >
              Adicionar Amigo
            </button>
          </nav>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {/* ABA: ADICIONAR AMIGO */}
        {activeTab === "add" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wider text-txt">
                Adicionar Amigo
              </h2>
              <p className="mt-1 text-xs text-mut/70">
                Você pode adicionar um amigo pelo identificador do Echo (@usuario:servidor) ou apelido.
              </p>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-4">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => {
                    clearMessages();
                    setAddInput(e.target.value);
                  }}
                  placeholder="Ex: @amigo:litteris.online ou minhocabr"
                  className="w-full rounded-xl bg-white/[0.03] border border-white/[0.08] px-4 py-3 text-sm text-txt placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:outline-none focus:ring-1 focus:ring-acc/30 shadow-inner transition-all pr-44"
                />
                <button
                  type="submit"
                  disabled={!addInput.trim() || submitting}
                  className="cursor-pointer absolute right-2 rounded-lg bg-acc px-4 py-2 text-xs font-bold text-bg transition-all hover:bg-acc-press active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5 shadow shadow-acc/20"
                >
                  <PaperPlaneTilt size={14} weight="bold" />
                  {submitting ? "Enviando..." : "Enviar pedido"}
                </button>
              </div>

              {/* Mensagens de Feedback */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                  {error}
                </div>
              )}

              {successMessage && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400">
                  {successMessage}
                </div>
              )}
            </form>
          </div>
        )}

        {/* ABAS: DISPONÍVEL (ONLINE) & TODOS */}
        {(activeTab === "online" || activeTab === "all") && (
          <div className="space-y-4">
            {/* Barra de Busca de Amigos */}
            <div className="relative max-w-md">
              <MagnifyingGlass
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-mut/60 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar amigos..."
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] py-2 pl-9 pr-3 text-xs text-txt placeholder:text-mut/50 focus:border-acc/40 focus:bg-white/[0.05] focus:outline-none transition-all"
              />
            </div>

            <div className="text-[10px] font-bold uppercase tracking-wider text-mut/60 pt-2">
              {activeTab === "online" ? "Disponíveis" : "Todos os Amigos"} — {displayedFriends.length}
            </div>

            {displayedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-mut/60 space-y-3">
                <Users size={48} className="opacity-20 text-mut" />
                <p className="text-sm">
                  {searchQuery
                    ? "Nenhum amigo corresponde à sua busca."
                    : activeTab === "online"
                    ? "Nenhum amigo disponível no momento."
                    : "Você ainda não adicionou nenhum amigo."}
                </p>
                {activeTab === "all" && !searchQuery && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("add")}
                    className="cursor-pointer text-xs font-semibold text-acc hover:underline"
                  >
                    Adicionar seu primeiro amigo
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                {displayedFriends.map((friend) => {
                  const presence = uiPresence[friend.userId] || friend.presence || "offline";
                  const presenceColor =
                    presence === "online"
                      ? "bg-emerald-500"
                      : presence === "unavailable"
                      ? "bg-amber-500"
                      : "bg-zinc-500";
                  const presenceLabel =
                    presence === "online"
                      ? "Disponível"
                      : presence === "unavailable"
                      ? "Ausente"
                      : "Offline";

                  const isMenuOpen = openMenuId === friend.friendshipId;

                  return (
                    <div
                      key={friend.friendshipId}
                      className="group flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-white/[0.04] transition-all"
                    >
                      {/* Dados do Amigo */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          {friend.avatarUrl ? (
                            <MxcImage
                              mxcUrl={friend.avatarUrl}
                              alt={friend.displayName}
                              className="h-10 w-10 rounded-full object-cover"
                              width={40}
                              height={40}
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acc/20 font-display text-sm font-bold text-acc">
                              {friend.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0d1017] ${presenceColor}`}
                            aria-hidden="true"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-txt group-hover:text-acc transition-colors">
                            {friend.displayName}
                          </p>
                          <p className="truncate text-xs text-mut/70 font-mono">
                            {presenceLabel} {friend.nickname ? `• @${friend.nickname}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 relative">
                        <button
                          type="button"
                          onClick={() => openDirectMessage(friend.userId)}
                          title="Iniciar conversa"
                          aria-label="Iniciar conversa"
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-txt hover:bg-acc hover:text-bg transition-colors"
                        >
                          <ChatCircle size={16} weight="bold" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : friend.friendshipId)}
                          title="Mais opções"
                          aria-label="Mais opções"
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-mut hover:text-txt hover:bg-white/[0.08] transition-colors"
                        >
                          <DotsThreeVertical size={16} weight="bold" />
                        </button>

                        {/* Menu dropdown */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-white/[0.08] bg-surf1 p-1 shadow-2xl">
                            <button
                              type="button"
                              onClick={() => handleAction(() => blockUser(friend.userId))}
                              className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.06] hover:text-red-400 transition-colors"
                            >
                              <Prohibit size={14} />
                              Bloquear
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(() => removeFriend(friend.friendshipId))}
                              className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-mut hover:bg-white/[0.06] hover:text-red-400 transition-colors"
                            >
                              <UserMinus size={14} />
                              Desfazer amizade
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA: PENDENTE */}
        {activeTab === "pending" && (
          <div className="space-y-6 max-w-3xl">
            {/* Solicitações Recebidas */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-mut/60 mb-3">
                Recebidas — {pendingIncoming.length}
              </div>

              {pendingIncoming.length === 0 ? (
                <p className="text-xs text-mut/60 py-3">Nenhuma solicitação de amizade pendente.</p>
              ) : (
                <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                  {pendingIncoming.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-acc/20 font-display text-xs font-bold text-acc">
                          {req.user.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-txt">{req.user.displayName}</p>
                          <p className="text-[10px] text-mut/70 font-mono">
                            Pedido de amizade recebido
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => acceptFriendRequest(req.friendshipId)}
                          title="Aceitar"
                          aria-label="Aceitar"
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                          <Check size={16} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() => declineFriendRequest(req.friendshipId)}
                          title="Recusar"
                          aria-label="Recusar"
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <X size={16} weight="bold" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Solicitações Enviadas */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-mut/60 mb-3">
                Enviadas — {pendingOutgoing.length}
              </div>

              {pendingOutgoing.length === 0 ? (
                <p className="text-xs text-mut/60 py-3">Nenhuma solicitação enviada pendente.</p>
              ) : (
                <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                  {pendingOutgoing.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-white/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] font-display text-xs font-bold text-mut">
                          {req.user.displayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-txt">{req.user.displayName}</p>
                          <p className="text-[10px] text-mut/70 font-mono">
                            Pedido de amizade enviado
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => cancelFriendRequest(req.friendshipId)}
                        title="Cancelar pedido"
                        aria-label="Cancelar pedido"
                        className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.04] text-mut hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ABA: BLOQUEADOS */}
        {activeTab === "blocked" && (
          <div className="space-y-4 max-w-3xl">
            <div className="text-[10px] font-bold uppercase tracking-wider text-mut/60 mb-3">
              Usuários Bloqueados — {blocked.length}
            </div>

            {blocked.length === 0 ? (
              <p className="text-xs text-mut/60 py-6 text-center">Nenhum usuário bloqueado.</p>
            ) : (
              <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                {blocked.map((item) => (
                  <div
                    key={item.friendshipId}
                    className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-white/[0.04] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/20 font-display text-xs font-bold text-red-400">
                        {item.user.displayName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-txt">{item.user.displayName}</p>
                        <p className="text-[10px] text-mut/70 font-mono">Bloqueado</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => unblockUser(item.friendshipId)}
                      className="cursor-pointer rounded-xl bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 text-xs font-medium text-txt hover:bg-white/[0.08] transition-colors"
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
