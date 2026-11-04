import { useState, useMemo, useEffect } from "react";
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
  Compass,
  UserPlus,
  ArrowsClockwise,
  Sparkle,
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
    discoveredUsers,
    discovering,
    activeTab,
    setActiveTab,
    loadDiscoveredUsers,
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
  const myUserId = useUiStore((s) => s.myUserId);

  const [addInput, setAddInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [discoverQuery, setDiscoverQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (discoveredUsers.length === 0) {
      void loadDiscoveredUsers();
    }
  }, [discoveredUsers.length, loadDiscoveredUsers]);

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

  // Filtra usuários descobertos pela busca
  const filteredDiscoveredUsers = useMemo(() => {
    const q = discoverQuery.toLowerCase().trim();
    if (!q) return discoveredUsers;
    return discoveredUsers.filter(
      (u) =>
        u.displayName.toLowerCase().includes(q) ||
        (u.nickname ?? "").toLowerCase().includes(q) ||
        u.userId.toLowerCase().includes(q) ||
        (u.bio ?? "").toLowerCase().includes(q),
    );
  }, [discoveredUsers, discoverQuery]);

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-bd-subtle px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 pr-4 border-r border-bd-subtle text-txt font-semibold">
            <Users size={20} className="text-acc" weight="bold" />
            <span className="font-display text-sm tracking-wide">Amigos</span>
          </div>

          <nav className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("online")}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "online"
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt shadow-sm border border-bd-subtle"
                  : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
              }`}
            >
              Disponível ({onlineFriends.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "all"
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt shadow-sm border border-bd-subtle"
                  : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
              }`}
            >
              Todos ({friends.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`cursor-pointer relative px-3 py-1.5 rounded-xl font-medium transition-all ${
                activeTab === "pending"
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt shadow-sm border border-bd-subtle"
                  : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
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
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt shadow-sm border border-bd-subtle"
                  : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
              }`}
            >
              Bloqueados ({blocked.length})
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("discover");
                void loadDiscoveredUsers();
              }}
              className={`cursor-pointer px-3 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 ${
                activeTab === "discover"
                  ? "dark:bg-white/[0.08] bg-black/[0.06] text-txt shadow-sm border border-bd-subtle"
                  : "text-mut dark:hover:bg-white/[0.04] hover:bg-black/[0.04] hover:text-txt"
              }`}
            >
              <Compass
                size={14}
                weight={activeTab === "discover" ? "fill" : "regular"}
                className={activeTab === "discover" ? "text-acc" : ""}
              />
              Descobrir
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

      {/* Layout em Duas Colunas (Lista Principal + Painel Ativo Agora & Comunidade) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Conteúdo Principal das Abas */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {/* ABA: ADICIONAR AMIGO */}
        {activeTab === "add" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wider text-txt">
                Adicionar Amigo
              </h2>
              <p className="mt-1 text-xs text-mut/70">
                Você pode adicionar um amigo usando o nome de usuário (@username).
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
                  className="w-full rounded-xl dark:bg-white/[0.03] bg-card-bg border border-bd-glass px-4 py-3 text-sm text-txt placeholder:text-mut/50 focus:border-acc/50 focus:bg-card-bg focus:outline-none focus:ring-1 focus:ring-acc/30 shadow-inner transition-all pr-44"
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
                className="w-full rounded-xl dark:bg-white/[0.03] bg-card-bg border border-bd-glass py-2 pl-9 pr-3 text-xs text-txt placeholder:text-mut/50 focus:border-acc/40 focus:bg-card-bg focus:outline-none transition-all"
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
              <div className="divide-y divide-bd-subtle border-t border-bd-subtle">
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
                      className="group flex items-center justify-between py-2.5 px-3 rounded-xl dark:hover:bg-white/[0.04] hover:bg-black/[0.04] transition-all"
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
                            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-bg ${presenceColor}`}
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
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full dark:bg-white/[0.04] bg-black/[0.05] text-txt hover:bg-acc hover:text-bg transition-colors"
                        >
                          <ChatCircle size={16} weight="bold" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setOpenMenuId(isMenuOpen ? null : friend.friendshipId)}
                          title="Mais opções"
                          aria-label="Mais opções"
                          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full dark:bg-white/[0.04] bg-black/[0.05] text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.08] transition-colors"
                        >
                          <DotsThreeVertical size={16} weight="bold" />
                        </button>

                        {/* Menu dropdown */}
                        {isMenuOpen && (
                          <div className="absolute right-0 top-10 z-30 w-44 rounded-xl border border-bd-glass bg-card-bg p-1 shadow-2xl">
                            <button
                              type="button"
                              onClick={() => handleAction(() => blockUser(friend.userId))}
                              className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.05] hover:text-red-400 transition-colors"
                            >
                              <Prohibit size={14} />
                              Bloquear
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAction(() => removeFriend(friend.friendshipId))}
                              className="cursor-pointer flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.05] hover:text-red-400 transition-colors"
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
                <div className="divide-y divide-bd-subtle border-t border-bd-subtle">
                  {pendingIncoming.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between py-3 px-2 rounded-xl dark:hover:bg-white/[0.04] hover:bg-black/[0.04] transition-all"
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
                <div className="divide-y divide-bd-subtle border-t border-bd-subtle">
                  {pendingOutgoing.map((req) => (
                    <div
                      key={req.friendshipId}
                      className="flex items-center justify-between py-3 px-2 rounded-xl dark:hover:bg-white/[0.04] hover:bg-black/[0.04] transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full dark:bg-white/[0.06] bg-black/[0.05] font-display text-xs font-bold text-mut">
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
                        className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-full dark:bg-white/[0.04] bg-black/[0.05] text-mut hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
              <div className="divide-y divide-bd-subtle border-t border-bd-subtle">
                {blocked.map((item) => (
                  <div
                    key={item.friendshipId}
                    className="flex items-center justify-between py-3 px-2 rounded-xl dark:hover:bg-white/[0.04] hover:bg-black/[0.04] transition-all"
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
                      className="cursor-pointer rounded-xl dark:bg-white/[0.04] bg-card-bg border border-bd-glass px-3 py-1.5 text-xs font-medium text-txt dark:hover:bg-white/[0.08] hover:bg-surf2 transition-colors"
                    >
                      Desbloquear
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: DESCOBRIR */}
        {activeTab === "discover" && (
          <div className="space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base font-bold text-txt">
                    Descobrir Usuários
                  </h2>
                  <span className="rounded-full bg-acc/10 px-2.5 py-0.5 text-[11px] font-semibold text-acc border border-acc/20">
                    {discoveredUsers.length} membros
                  </span>
                </div>
                <p className="mt-1 text-xs text-mut/70">
                  Explore novos membros cadastrados no Echo e conecte-se com a comunidade.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <MagnifyingGlass
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-mut/60 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={discoverQuery}
                    onChange={(e) => setDiscoverQuery(e.target.value)}
                    placeholder="Buscar por nome ou @..."
                    className="w-full rounded-xl dark:bg-white/[0.03] bg-card-bg border border-bd-glass py-2 pl-9 pr-3 text-xs text-txt placeholder:text-mut/50 focus:border-acc/40 focus:bg-card-bg focus:outline-none transition-all"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void loadDiscoveredUsers(discoverQuery)}
                  disabled={discovering}
                  title="Atualizar lista"
                  className="cursor-pointer flex h-9 w-9 shrink-0 items-center justify-center rounded-xl dark:bg-white/[0.04] bg-card-bg border border-bd-glass text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-surf2 active:scale-95 transition-all disabled:opacity-40"
                >
                  <ArrowsClockwise size={16} className={discovering ? "animate-spin text-acc" : ""} />
                </button>
              </div>
            </div>

            {discovering && discoveredUsers.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-36 rounded-2xl dark:bg-white/[0.02] bg-surf/40 border border-bd-subtle p-4 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredDiscoveredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-mut/60 space-y-3">
                <Compass size={48} className="opacity-20 text-mut" />
                <p className="text-sm font-medium">Nenhum membro encontrado</p>
                <p className="text-xs text-mut/50 max-w-sm">
                  {discoverQuery
                    ? "Tente buscar com outro nome ou identificador."
                    : "Novos membros cadastrados aparecerão aqui para você descobrir."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredDiscoveredUsers.map((user) => {
                  const handle = (user.nickname || user.userId.replace(/^@/, "").split(":")[0]).toLowerCase();
                  const isPending = user.status === "pending_outgoing";
                  const isIncoming = user.status === "pending_incoming";
                  const isFriend = user.status === "friend";

                  return (
                    <div
                      key={user.userId}
                      className="group relative flex flex-col justify-between rounded-2xl dark:bg-[#141923] bg-card-bg border border-bd-subtle p-4 hover:border-acc/30 dark:hover:bg-[#181f2c] hover:bg-surf2/40 transition-all duration-200 shadow-sm"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="relative">
                            {user.avatarUrl ? (
                              <MxcImage
                                mxcUrl={user.avatarUrl}
                                alt={user.displayName}
                                className="h-12 w-12 rounded-full object-cover ring-2 ring-bd-subtle"
                                width={48}
                                height={48}
                              />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-acc/15 font-display text-base font-bold text-acc ring-2 ring-acc/20">
                                {user.displayName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>

                          {isFriend && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                              <Check size={11} weight="bold" /> Amigo
                            </span>
                          )}
                          {isPending && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20">
                              Enviado
                            </span>
                          )}
                          {isIncoming && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-acc/10 px-2 py-0.5 text-[10px] font-semibold text-acc border border-acc/20">
                              Solicitou
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-sm text-txt truncate group-hover:text-acc transition-colors">
                          {user.displayName}
                        </h3>
                        <p className="font-mono text-xs text-mut/80 truncate">@{handle}</p>

                        {user.bio ? (
                          <p className="mt-2 text-xs text-mut/70 line-clamp-2 leading-relaxed">
                            {user.bio}
                          </p>
                        ) : (
                          <p className="mt-2 text-[11px] text-mut/40 italic">
                            Sem biografia
                          </p>
                        )}
                      </div>

                      <div className="pt-4 mt-2 border-t border-bd-subtle">
                        {isFriend ? (
                          <button
                            type="button"
                            onClick={() => openDirectMessage(user.userId)}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl dark:bg-white/[0.06] bg-black/[0.05] text-txt font-semibold text-xs hover:bg-acc hover:text-bg active:scale-[0.98] transition-all"
                          >
                            <ChatCircle size={15} weight="bold" />
                            Conversar
                          </button>
                        ) : isIncoming ? (
                          <button
                            type="button"
                            onClick={() => user.friendshipId && acceptFriendRequest(user.friendshipId)}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-acc text-bg font-semibold text-xs hover:bg-acc-press active:scale-[0.98] transition-all shadow shadow-acc/20"
                          >
                            <Check size={15} weight="bold" />
                            Aceitar Pedido
                          </button>
                        ) : isPending ? (
                          <div className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl dark:bg-white/[0.03] bg-black/[0.03] text-mut text-xs font-medium border border-bd-subtle">
                            <Check size={13} weight="bold" className="text-amber-400" />
                            Solicitação enviada
                          </div>
                        ) : (
                          <button
                            type="button"
                            aria-label={`Adicionar ${user.displayName} como amigo`}
                            onClick={() => sendFriendRequest(user.userId)}
                            className="cursor-pointer w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-acc text-bg font-semibold text-xs hover:bg-acc-press active:scale-[0.98] transition-all shadow shadow-acc/20"
                          >
                            <UserPlus size={15} weight="bold" />
                            Adicionar Amigo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>

        {/* Coluna Lateral Direita: "Ativo Agora & Comunidade" (visível nas abas de amigos) */}
        {activeTab !== "discover" && (
          <aside
            data-column="active-now"
            aria-label="Ativo Agora e Comunidade"
            className="hidden lg:flex w-[320px] shrink-0 flex-col border-l border-bd-subtle bg-surf/40 p-5 space-y-6 overflow-y-auto scrollbar-thin select-none"
          >
            {/* Bloco 1: Ativo Agora */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-txt">
                  Ativo Agora
                </h3>
                {onlineFriends.length > 0 && (
                  <span className="text-[10px] text-acc font-semibold">
                    {onlineFriends.length} online
                  </span>
                )}
              </div>

              {onlineFriends.length > 0 ? (
                <div className="space-y-2">
                  {onlineFriends.slice(0, 5).map((f) => (
                    <div
                      key={f.userId}
                      onClick={() => openDirectMessage(f.userId)}
                      className="cursor-pointer group flex items-center justify-between p-2.5 rounded-xl bg-card-bg/60 border border-bd-glass dark:bg-white/[0.02] dark:border-white/[0.04] hover:bg-card-bg hover:border-acc/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {f.avatarUrl ? (
                            <MxcImage
                              mxcUrl={f.avatarUrl}
                              alt={f.displayName}
                              className="h-8 w-8 rounded-full object-cover"
                              width={32}
                              height={32}
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc/15 font-display text-xs font-bold text-acc">
                              {f.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card-bg" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-txt truncate group-hover:text-acc transition-colors">
                            {f.displayName}
                          </p>
                          <p className="text-[10px] text-emerald-400/80 truncate">
                            Disponível no Echo
                          </p>
                        </div>
                      </div>
                      <ChatCircle size={15} className="text-mut group-hover:text-txt transition-colors shrink-0" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-bd-glass bg-card-bg/50 p-4 text-center space-y-2">
                  <div className="w-9 h-9 mx-auto rounded-full dark:bg-white/[0.04] bg-black/[0.05] flex items-center justify-center text-mut/60">
                    <Users size={18} />
                  </div>
                  <p className="text-xs font-semibold text-txt">Está meio quieto por aqui…</p>
                  <p className="text-[11px] text-mut/60 leading-relaxed">
                    Quando seus amigos estiverem online no Echo, a atividade deles aparecerá aqui.
                  </p>
                </div>
              )}
            </div>

            {/* Bloco 2: Sugestões de Membros (Descobrir Rápido) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-txt">
                  Descobrir Pessoas
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab("discover")}
                  className="cursor-pointer text-[10px] font-semibold text-acc hover:underline"
                >
                  Explorar todos
                </button>
              </div>

              {discoveredUsers.length > 0 ? (
                <div className="space-y-2">
                  {discoveredUsers.slice(0, 3).map((u) => {
                    const isFriend = u.status === "friend";
                    const isPending = u.status === "pending_outgoing";

                    return (
                      <div
                        key={u.userId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-card-bg/60 border border-bd-glass dark:bg-white/[0.02] dark:border-white/[0.04] hover:bg-card-bg transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            {u.avatarUrl ? (
                              <MxcImage
                                mxcUrl={u.avatarUrl}
                                alt={u.displayName}
                                className="h-8 w-8 rounded-full object-cover"
                                width={32}
                                height={32}
                              />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc/15 font-display text-xs font-bold text-acc">
                                {u.displayName.slice(0, 1).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-txt truncate">
                              {u.displayName}
                            </p>
                            <p className="text-[10px] text-mut/70 truncate font-mono">
                              @{u.nickname || u.userId.replace(/^@/, "").split(":")[0]}
                            </p>
                          </div>
                        </div>

                        {isFriend ? (
                          <button
                            type="button"
                            onClick={() => openDirectMessage(u.userId)}
                            className="cursor-pointer p-1.5 rounded-lg dark:bg-white/[0.06] bg-black/[0.05] text-txt hover:bg-acc hover:text-bg transition-colors"
                            title="Conversar"
                          >
                            <ChatCircle size={14} weight="bold" />
                          </button>
                        ) : isPending ? (
                          <span className="text-[10px] text-amber-400 font-medium px-2 py-1 rounded bg-amber-500/10">
                            Enviado
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => sendFriendRequest(u.userId)}
                            className="cursor-pointer p-1.5 rounded-lg bg-acc text-bg font-semibold hover:bg-acc-press active:scale-95 transition-all shadow shadow-acc/20"
                            title="Adicionar Amigo"
                          >
                            <UserPlus size={14} weight="bold" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-bd-subtle dark:bg-white/[0.02] bg-surf/40 p-3 text-center">
                  <p className="text-[11px] text-mut/60">Novos membros aparecerão aqui.</p>
                </div>
              )}
            </div>

            {/* Bloco 3: Rede Descentralizada Echo */}
            <div className="mt-auto pt-3 border-t border-bd-subtle">
              <div className="rounded-2xl border border-bd-subtle bg-gradient-to-br from-acc/10 via-surf/30 to-transparent p-3.5 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-txt">Rede Segura & Descentralizada</span>
                </div>
                <p className="text-[11px] text-mut/80 leading-relaxed font-mono truncate">
                  {myUserId || "matrix.litteris.online"}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-acc font-semibold flex items-center gap-1">
                    <Sparkle size={12} /> Criptografia E2E
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (myUserId) navigator.clipboard.writeText(myUserId);
                    }}
                    className="cursor-pointer text-[10px] font-semibold text-mut hover:text-txt transition-colors"
                  >
                    Copiar ID
                  </button>
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
