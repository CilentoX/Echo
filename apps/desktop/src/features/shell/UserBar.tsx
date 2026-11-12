import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useSyncStore } from "@/stores/syncStore";
import { useFriendsStore } from "@/stores/friendsStore";
import { useUnreadStore } from "@/stores/unreadStore";
import MxcImage from "@/components/media/MxcImage";
import { CaretDown, Clock, Gear, Hash, Headphones, MagnifyingGlass, Microphone, MicrophoneSlash, ShieldCheck, X, WifiHigh, WifiX, ArrowsClockwise, Star } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AudioDeviceQuickMenu from "./AudioDeviceQuickMenu";
import PresenceQuickPopover from "./PresenceQuickPopover";

export interface UserBarProps {
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenVoiceSettings?: () => void;
}

/**
 * Dock Inferior Persistente do Echo (Padrão Discord):
 * Ancorada na base da Coluna 2 (Sidebar de 232px).
 * Exibe foto de perfil com anel de presença/fala, nome/handle,
 * controles de áudio (microfone e fone com mute/deafen) e acesso a configurações.
 */
export default function UserBar({ onOpenProfile, onOpenSettings, onOpenVoiceSettings }: UserBarProps) {
  const myUserId = useUiStore((s) => s.myUserId);
  const username = useProfileStore((s) => s.username);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl ?? s.appwriteAvatarUrl);
  const presence = useProfileStore((s) => s.presence);
  const customStatus = useProfileStore((s) => s.customStatus);

  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const setMicrophoneEnabled = useSettingsStore((s) => s.setMicrophoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const setHeadphonesEnabled = useSettingsStore((s) => s.setHeadphonesEnabled);
  const quickSwitchFavorites = useSettingsStore((s) => s.quickSwitchFavorites);
  const toggleQuickSwitchFavorite = useSettingsStore((s) => s.toggleQuickSwitchFavorite);

  const isConnected = useVoiceStore((s) => s.isConnected);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const isSpeaking = useVoiceStore((s) => s.isSpeaking);
  const setParticipantMuted = useVoiceStore((s) => s.setParticipantMuted);
  const setParticipantDeafened = useVoiceStore((s) => s.setParticipantDeafened);

  // Usuário só é considerado falando se estiver conectado na call, com mic ativo e sem ensurdecimento
  const isUserSpeaking = isConnected && microphoneEnabled && headphonesEnabled && isSpeaking;

  const [audioQuickOpen, setAudioQuickOpen] = useState(false);
  const [presenceQuickOpen, setPresenceQuickOpen] = useState(false);
  const [quickSwitchOpen, setQuickSwitchOpen] = useState(false);
  const [quickSwitchQuery, setQuickSwitchQuery] = useState("");
  const [quickSwitchSelectedIndex, setQuickSwitchSelectedIndex] = useState(0);
  const [sessionStart] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const quickSwitchInputRef = useRef<HTMLInputElement>(null);

  // Matrix sync status for connection indicator
  const syncStatus = useSyncStore((s) => s.status);

  // Relógio + timer de sessão (atualiza a cada minuto)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Foca no input do Quick Switch ao abrir e reseta seleção
  useEffect(() => {
    if (quickSwitchOpen) {
      setQuickSwitchSelectedIndex(0);
      setTimeout(() => quickSwitchInputRef.current?.focus(), 50);
    } else {
      setQuickSwitchQuery("");
      setQuickSwitchSelectedIndex(0);
    }
  }, [quickSwitchOpen]);

  // Atalho global Ctrl+K para abrir/fechar Quick Switch
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setQuickSwitchOpen((prev) => !prev);
      }
      if (e.key === "Escape" && quickSwitchOpen) {
        e.preventDefault();
        setQuickSwitchOpen(false);
        setQuickSwitchQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickSwitchOpen]);

  const handleQuickSwitchSelect = useCallback((id: string, kind: "channel" | "dm") => {
    setQuickSwitchOpen(false);
    setQuickSwitchQuery("");
    if (kind === "channel") {
      useUiStore.getState().setActiveChannel(id);
    } else {
      useFriendsStore.getState().openDirectMessage(id);
    }
  }, []);

  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const activeChannelId = useUiStore((s) => s.activeChannelId);
  const guilds = useSyncStore((s) => s.guilds);
  const channelsByGuild = useSyncStore((s) => s.channelsByGuild);
  const guildProfiles = useSyncStore((s) =>
    activeGuildId && activeGuildId !== "home" && myUserId ? s.guildMemberProfiles[activeGuildId] : undefined,
  );
  const myGuildNick = myUserId && guildProfiles ? guildProfiles[myUserId]?.nickname : null;

  const isHome = activeGuildId === "home" || !activeGuildId;
  const activeGuild = guilds.find((g) => g.guildId === activeGuildId);
  const activeChannel = activeGuildId && activeChannelId
    ? (channelsByGuild[activeGuildId] ?? []).find((c) => c.channelId === activeChannelId)
    : null;

  const effectiveAvatar = avatarUrl;
  const effectiveHandle = username || myUserId?.replace(/^@/, "").split(":")[0] || "";
  const effectiveName = myGuildNick || nickname || displayName || effectiveHandle || "Usuário";
  const userTag = effectiveHandle ? `@${effectiveHandle}` : "";

  const presenceColor =
    presence === "dnd"
      ? "bg-dnd"
      : presence === "idle"
        ? "bg-idle"
        : presence === "offline"
          ? "bg-offline"
          : "bg-online";

  const initial = effectiveName.charAt(0).toUpperCase();

  // Dados para Quick Switch: canais + DMs recentes, ordenados por menções primeiro
  const friends = useFriendsStore((s) => s.friends);
  const unreadByChannel = useUnreadStore((s) => s.unreadByChannel);
  const mentionsByChannel = useUnreadStore((s) => s.mentionsByChannel);
  const unreadByDm = useUnreadStore((s) => s.unreadByDm);

  const allChannels = useMemo(() => {
    const items: Array<{ id: string; name: string; guildName?: string; kind: "channel" | "dm"; hasMention: boolean }> = [];
    // Canais de todas as guildas
    for (const g of guilds) {
      const channels = channelsByGuild[g.guildId] ?? [];
      for (const ch of channels) {
        const hasMention = (mentionsByChannel[ch.channelId] ?? 0) > 0 || (unreadByChannel[ch.channelId] ?? 0) > 0;
        items.push({ id: ch.channelId, name: ch.name, guildName: g.name, kind: "channel", hasMention });
      }
    }
    // DMs recentes
    for (const f of friends.slice(0, 10)) {
      const hasMention = (unreadByDm[f.userId] ?? 0) > 0;
      items.push({ id: f.userId, name: f.displayName, kind: "dm", hasMention });
    }
    return items;
  }, [guilds, channelsByGuild, friends, unreadByChannel, mentionsByChannel, unreadByDm]);

  const filteredQuickSwitch = useMemo(() => {
    const q = quickSwitchQuery.toLowerCase().trim();
    const base = !q
      ? allChannels
      : allChannels.filter(
          (item) => item.name.toLowerCase().includes(q) || (item.guildName?.toLowerCase().includes(q)),
        );
    // Favorites first, then non-favorites; each group preserves original order
    const favSet = new Set(quickSwitchFavorites);
    const favs = base.filter((item) => favSet.has(item.id));
    const rest = base.filter((item) => !favSet.has(item.id));
    return [...favs, ...rest].slice(0, 12);
  }, [allChannels, quickSwitchQuery, quickSwitchFavorites]);

  // Reseta índice selecionado quando os resultados filtrados mudam
  useEffect(() => {
    setQuickSwitchSelectedIndex(0);
  }, [filteredQuickSwitch]);

  // Navegação por teclado no Quick Switch (↑/↓/Enter)
  const handleQuickSwitchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setQuickSwitchSelectedIndex((prev) =>
          prev < filteredQuickSwitch.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setQuickSwitchSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredQuickSwitch.length - 1,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredQuickSwitch[quickSwitchSelectedIndex];
        if (selected) {
          handleQuickSwitchSelect(selected.id, selected.kind);
        }
      }
    },
    [filteredQuickSwitch, quickSwitchSelectedIndex, handleQuickSwitchSelect],
  );

  // Formata timer de sessão
  const sessionElapsed = useMemo(() => {
    const diff = Math.floor((now - sessionStart) / 60_000);
    if (diff < 60) return `${diff}min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h${m > 0 ? `${m}m` : ""}`;
  }, [now, sessionStart]);

  const clockTime = useMemo(() => {
    return new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }, [now]);

  return (
    <footer
      data-testid="user-bar"
      className="grid h-14 w-full shrink-0 grid-cols-[1fr_auto_1fr] items-center bg-userbar-bg/95 backdrop-blur-md text-txt z-30 select-none border-t border-bd-glass px-3"
    >
      {/* Esquerda: Cápsula de Perfil */}
      <div className="flex min-w-0 items-center justify-start">
        <Popover open={presenceQuickOpen} onOpenChange={setPresenceQuickOpen}>
          <div className="flex h-10 max-w-[280px] items-center gap-2 px-1.5 rounded-xl text-left transition-all dark:hover:bg-white/[0.05] hover:bg-black/[0.05] min-w-0">
            {/* Foto / Avatar do usuário com anel de presença e anel de fala */}
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPresenceQuickOpen(true);
                }}
                title="Alterar status de presença"
                aria-label="Alterar status de presença"
                className="relative shrink-0 cursor-pointer outline-none active:scale-95 transition-transform"
              >
                {effectiveAvatar ? (
                  <MxcImage
                    mxcUrl={effectiveAvatar}
                    alt={effectiveName}
                    className={`h-8 w-8 rounded-full object-cover transition-all shadow-sm ${
                      isUserSpeaking
                        ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                        : "ring-1 ring-bd-subtle group-hover:ring-acc/60"
                    }`}
                    width={32}
                    height={32}
                  />
                ) : (
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full bg-acc font-display text-xs font-bold text-bg shadow-sm transition-all ${
                      isUserSpeaking
                        ? "ring-2 ring-online shadow-sm shadow-online/50 animate-pulse"
                        : ""
                    }`}
                  >
                    {initial}
                  </div>
                )}

                {/* Equalizer Waveform quando Falando */}
                {isUserSpeaking && (
                  <div className="absolute -top-1 -right-1 flex items-center gap-0.5 bg-surf/90 rounded-full px-1 py-0.5 shadow-sm border border-online/30">
                    <span className="h-2 w-0.5 rounded-full bg-online animate-[pulse_0.6s_ease-in-out_infinite]" />
                    <span className="h-3 w-0.5 rounded-full bg-online animate-[pulse_0.4s_ease-in-out_infinite_150ms]" />
                    <span className="h-1.5 w-0.5 rounded-full bg-online animate-[pulse_0.5s_ease-in-out_infinite_300ms]" />
                  </div>
                )}

                {/* Anel de presença com corte e indicador visual */}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-userbar-bg hover:scale-125 transition-transform ${presenceColor}`}
                  aria-hidden="true"
                />
              </button>
            </PopoverTrigger>

            {/* Nome e @tag ou Status de Atividade (clique abre perfil) */}
            <button
              type="button"
              onClick={onOpenProfile}
              title="Abrir perfil"
              className="flex-1 min-w-0 leading-tight text-left cursor-pointer group/name outline-none"
            >
              <p className="truncate text-xs font-semibold text-txt group-hover/name:text-acc transition-colors">
                {effectiveName}
              </p>
              {customStatus ? (
                <p className="truncate text-[10px] text-acc/90 flex items-center gap-1 font-medium" title={customStatus.text}>
                  {customStatus.emoji && <span>{customStatus.emoji}</span>}
                  <span className="truncate">{customStatus.text}</span>
                </p>
              ) : (
                <p className="truncate text-[10px] text-mut/80 font-mono">{userTag}</p>
              )}
            </button>
          </div>

          <PopoverContent
            side="top"
            align="start"
            sideOffset={10}
            className="p-0 border-0 bg-transparent shadow-none w-auto"
          >
            <PresenceQuickPopover onClose={() => setPresenceQuickOpen(false)} />
          </PopoverContent>
        </Popover>
      </div>

      {/* Centro: Quick Switch clicável + Relógio/Timer */}
      <div className="hidden md:flex items-center gap-2 mx-2 relative">
        <button
          type="button"
          onClick={() => setQuickSwitchOpen((o) => !o)}
          title="Trocar canal ou conversa (Ctrl+K)"
          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 rounded-full bg-surf2/40 border border-bd/30 text-xs text-mut max-w-sm hover:bg-surf2/60 hover:border-acc/30 hover:text-txt transition-all group"
        >
          {isHome ? (
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck size={14} className="text-acc shrink-0" />
              <span className="font-medium text-txt/90 truncate">Echo</span>
              <span className="text-bd shrink-0">•</span>
              <span className="text-mut text-[11px] truncate group-hover:text-txt/70">Rede Segura</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-txt truncate">{activeGuild?.name ?? "Guilda"}</span>
              {activeChannel && (
                <>
                  <span className="text-bd shrink-0">/</span>
                  <Hash size={12} className="text-acc shrink-0" weight="bold" />
                  <span className="text-acc font-mono font-medium truncate">{activeChannel.name}</span>
                </>
              )}
            </div>
          )}
          <CaretDown size={10} className="text-mut/50 group-hover:text-acc transition-colors" />
        </button>

        {/* Indicador de Conexão Matrix + Relógio + Timer de Sessão */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] text-mut/70 font-mono select-none" title={`Status: ${syncStatus} · Sessão ativa há ${sessionElapsed}`}>
          {syncStatus === "syncing" ? (
            <WifiHigh size={12} className="text-online" aria-label="Conectado" />
          ) : syncStatus === "connecting" ? (
            <ArrowsClockwise size={12} className="text-idle animate-spin" aria-label="Conectando" />
          ) : (
            <WifiX size={12} className="text-err" aria-label="Erro de conexão" />
          )}
          <Clock size={12} className="text-acc/60" />
          <span>{clockTime}</span>
          <span className="text-bd/40">|</span>
          <span className="text-acc/80">{sessionElapsed}</span>
        </div>

        {/* Painel Quick Switch flutuante */}
        {quickSwitchOpen && (
          <>
            {/* Backdrop para fechar ao clicar fora */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => { setQuickSwitchOpen(false); setQuickSwitchQuery(""); }}
            />
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 w-[420px] max-h-[380px] rounded-2xl bg-[#1a1f2e] border border-bd/60 shadow-2xl shadow-black/50 z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-bd/40">
              <MagnifyingGlass size={16} className="text-mut shrink-0" />
              <input
                ref={quickSwitchInputRef}
                type="text"
                value={quickSwitchQuery}
                onChange={(e) => setQuickSwitchQuery(e.target.value)}
                onKeyDown={handleQuickSwitchKeyDown}
                placeholder="Buscar canais, amigos..."
                role="combobox"
                aria-expanded={filteredQuickSwitch.length > 0}
                aria-activedescendant={
                  filteredQuickSwitch[quickSwitchSelectedIndex]
                    ? `qs-${filteredQuickSwitch[quickSwitchSelectedIndex].kind}-${filteredQuickSwitch[quickSwitchSelectedIndex].id}`
                    : undefined
                }
                className="flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-mut/50"
              />
              <button
                type="button"
                onClick={() => { setQuickSwitchOpen(false); setQuickSwitchQuery(""); }}
                className="cursor-pointer p-1 rounded-md text-mut hover:text-txt hover:bg-white/[0.06] transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
              {filteredQuickSwitch.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-mut/60">Nenhum resultado encontrado</div>
              ) : (
                filteredQuickSwitch.map((item, idx) => (
                  <button
                    id={`qs-${item.kind}-${item.id}`}
                    key={`${item.kind}-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={idx === quickSwitchSelectedIndex}
                    onClick={() => handleQuickSwitchSelect(item.id, item.kind)}
                    className={`cursor-pointer w-full flex items-center gap-3 px-3 py-2 text-left transition-colors group ${
                      idx === quickSwitchSelectedIndex ? "bg-acc/15" : "hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                      item.kind === "channel" ? "bg-acc/15 text-acc" : "bg-purple-500/15 text-purple-400"
                    }`}>
                      {item.kind === "channel" ? <Hash size={14} weight="bold" /> : item.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-txt truncate group-hover:text-acc transition-colors">
                        {item.kind === "channel" ? `#${item.name}` : item.name}
                      </p>
                      {item.guildName && <p className="text-[10px] text-mut/70 truncate">{item.guildName}</p>}
                    </div>
                    {item.hasMention && <span className="h-2 w-2 rounded-full bg-acc shrink-0 shadow-[0_0_6px_rgba(20,218,166,0.5)]" />}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleQuickSwitchFavorite(item.id); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleQuickSwitchFavorite(item.id); } }}
                      title={quickSwitchFavorites.includes(item.id) ? "Remover dos favoritos" : "Fixar nos favoritos"}
                      className={`cursor-pointer p-1 rounded-md transition-colors ${
                        quickSwitchFavorites.includes(item.id)
                          ? "text-acc hover:text-acc/80"
                          : "text-mut/30 hover:text-acc/60 opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <Star size={14} weight={quickSwitchFavorites.includes(item.id) ? "fill" : "regular"} />
                    </span>
                  </button>
                ))
              )}
            </div>
            <div className="px-3 py-1.5 border-t border-bd/40 text-[10px] text-mut/50 flex items-center justify-between">
              <span><kbd className="px-1 py-0.5 rounded bg-white/[0.06] text-mut/70 font-mono">Esc</kbd> para fechar</span>
              <span>{filteredQuickSwitch.length} resultados</span>
            </div>
          </div>
        </>
        )}
      </div>

      {/* Direita: Controles de Áudio e Configurações */}
      <div className="flex items-center justify-end gap-0.5 shrink-0">
        <Popover open={audioQuickOpen} onOpenChange={setAudioQuickOpen}>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={microphoneEnabled ? "Silenciar microfone" : "Ativar microfone"}
                title={microphoneEnabled ? "Silenciar microfone (Botão direito para opções)" : "Ativar microfone (Botão direito para opções)"}
                onClick={() => {
                  const next = !microphoneEnabled;
                  setMicrophoneEnabled(next);
                  if (myUserId) {
                    setParticipantMuted(myUserId, !next);
                  }
                  setParticipantMuted("me", !next);
                  if (!next) setSpeaking(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAudioQuickOpen(true);
                }}
                className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  microphoneEnabled
                    ? isUserSpeaking
                      ? "text-online bg-online/20 ring-1 ring-online/50 shadow-sm shadow-online/30 animate-pulse"
                      : "text-online bg-online/10 hover:bg-online/20"
                    : "text-err bg-err/10 hover:bg-err/20"
                }`}
              >
                {microphoneEnabled ? <Microphone size={16} weight="fill" /> : <MicrophoneSlash size={16} />}
              </button>

              <button
                type="button"
                aria-label={headphonesEnabled ? "Desativar áudio" : "Ativar áudio"}
                title={headphonesEnabled ? "Desativar áudio (Botão direito para opções)" : "Ativar áudio (Botão direito para opções)"}
                onClick={() => {
                  const next = !headphonesEnabled;
                  setHeadphonesEnabled(next);
                  if (myUserId) {
                    setParticipantDeafened(myUserId, !next);
                  }
                  setParticipantDeafened("me", !next);
                  if (!next) setSpeaking(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setAudioQuickOpen(true);
                }}
                className={`cursor-pointer flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                  headphonesEnabled
                    ? "text-online bg-online/10 hover:bg-online/20"
                    : "text-err bg-err/10 hover:bg-err/20"
                }`}
              >
                <Headphones size={16} weight={headphonesEnabled ? "fill" : "regular"} />
              </button>
            </div>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="end"
            sideOffset={10}
            className="p-0 border-0 bg-transparent shadow-none w-auto"
          >
            <AudioDeviceQuickMenu
              onClose={() => setAudioQuickOpen(false)}
              onOpenVoiceSettings={() => {
                setAudioQuickOpen(false);
                if (onOpenVoiceSettings) {
                  onOpenVoiceSettings();
                } else if (onOpenSettings) {
                  onOpenSettings();
                }
              }}
            />
          </PopoverContent>
        </Popover>

        <button
          type="button"
          aria-label="Configurações"
          title="Configurações"
          onClick={onOpenSettings}
          className="cursor-pointer group flex h-8 w-8 items-center justify-center rounded-lg text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.06] hover:text-txt transition-all"
        >
          <Gear size={16} className="transition-transform duration-300 group-hover:rotate-45" />
        </button>
      </div>
    </footer>
  );
}
