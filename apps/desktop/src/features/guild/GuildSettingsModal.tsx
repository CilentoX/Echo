import { useState, useRef, useEffect } from "react";
import {
  X,
  Trash,
  Camera,
  Gear,
  ShieldCheck,
  Users,
  Link as LinkIcon,
  Plus,
  Check,
  Copy,
  WarningCircle,
  Info,
  UserPlus,
} from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import ImageEditor from "@/components/media/ImageEditor";
import { useEchoApi, GuildRole, GuildInviteItem, GuildMembersData } from "@/lib/api/echoApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface GuildSettingsModalProps {
  open: boolean;
  onClose: () => void;
  guild: {
    guildId: string;
    name: string;
    avatarUrl?: string | null;
    description?: string | null;
    bannerUrl?: string | null;
    createdBy?: string | null;
  };
  onSave?: (updates: {
    name: string;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    description?: string | null;
  }) => Promise<void>;
}

type TabType = "overview" | "roles" | "members" | "invites";

const PRESET_COLORS = [
  "#0FB9A8", // Echo Teal
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#10b981", // Emerald
  "#94a3b8", // Slate
];

const AVAILABLE_PERMISSIONS: { id: string; name: string; desc: string }[] = [
  {
    id: "MANAGE_GUILD",
    name: "Gerenciar Servidor",
    desc: "Permite alterar nome, ícone, banner e configurações gerais do servidor.",
  },
  {
    id: "MANAGE_ROLES",
    name: "Gerenciar Cargos",
    desc: "Permite criar, editar e excluir cargos e gerenciar permissões.",
  },
  {
    id: "MANAGE_CHANNELS",
    name: "Gerenciar Canais",
    desc: "Permite criar, editar e excluir canais de texto e voz.",
  },
  {
    id: "CREATE_INVITE",
    name: "Criar Convites",
    desc: "Permite gerar links de convite para trazer novas pessoas.",
  },
  {
    id: "KICK_MEMBERS",
    name: "Expulsar Membros",
    desc: "Permite remover membros indesejados da comunidade.",
  },
  {
    id: "BAN_MEMBERS",
    name: "Banir Membros",
    desc: "Impede permanentemente que membros retornem à guilda.",
  },
  {
    id: "SEND_MESSAGES",
    name: "Enviar Mensagens",
    desc: "Permite publicar mensagens nos canais de texto.",
  },
  {
    id: "MANAGE_MESSAGES",
    name: "Gerenciar Mensagens",
    desc: "Permite deletar ou fixar mensagens enviadas por outros usuários.",
  },
  {
    id: "CONNECT_VOICE",
    name: "Conectar em Voz",
    desc: "Permite entrar e falar nas salas de conferência por voz.",
  },
];

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "E";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function GuildSettingsModal({
  open,
  onClose,
  guild,
  onSave,
}: GuildSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Overview tab state
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? "");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(guild.avatarUrl ?? null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(guild.bannerUrl ?? null);

  // Editor states
  const [iconEditorOpen, setIconEditorOpen] = useState(false);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [rawIconUrl, setRawIconUrl] = useState<string | null>(null);
  const [rawBannerUrl, setRawBannerUrl] = useState<string | null>(null);

  const [savingOverview, setSavingOverview] = useState(false);
  const [deletingGuild, setDeletingGuild] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Roles tab state
  const [roles, setRoles] = useState<GuildRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#0FB9A8");
  const [roleIsHoisted, setRoleIsHoisted] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(false);

  // Members tab state
  const [membersData, setMembersData] = useState<GuildMembersData | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Invites tab state
  const [invites, setInvites] = useState<GuildInviteItem[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const echoApi = useEchoApi();
  const myUserId = useUiStore((state) => state.myUserId);

  // Determine if current user is owner
  const isOwner =
    Boolean(myUserId && guild.createdBy && guild.createdBy === myUserId) ||
    Boolean(myUserId && (!guild.createdBy || guild.createdBy === myUserId));

  const setGuilds = useSyncStore((state) => state.setGuilds);
  const setActiveGuild = useUiStore((state) => state.setActiveGuild);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName(guild.name);
      setDescription(guild.description ?? "");
      setIconPreview(guild.avatarUrl ?? null);
      setBannerPreview(guild.bannerUrl ?? null);
      setIconFile(null);
      setBannerFile(null);
      setErrorMessage(null);
      setStatusMessage(null);
      setActiveTab("overview");
      loadRoles();
      loadMembers();
      loadInvites();
    }
  }, [open, guild]);

  const loadRoles = async () => {
    try {
      setLoadingRoles(true);
      const list = await echoApi.getGuildRoles(guild.guildId);
      setRoles(list);
      if (list.length > 0 && !selectedRoleId) {
        selectRole(list[0]);
      }
    } catch {
      // Ignora falha de rede
    } finally {
      setLoadingRoles(false);
    }
  };

  const loadMembers = async () => {
    try {
      setLoadingMembers(true);
      const data = await echoApi.getGuildMembersData(guild.guildId);
      setMembersData(data);
    } catch {
      // Ignora falha
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadInvites = async () => {
    try {
      setLoadingInvites(true);
      const list = await echoApi.listGuildInvites(guild.guildId);
      setInvites(list);
    } catch {
      // Ignora falha
    } finally {
      setLoadingInvites(false);
    }
  };

  const selectRole = (r: GuildRole) => {
    setSelectedRoleId(r.id);
    setRoleName(r.name);
    setRoleColor(r.color || "#0FB9A8");
    setRoleIsHoisted(r.isHoisted);
    setRolePermissions(r.permissions || []);
  };

  // ── Overview Handlers ──────────────────────────────────────────

  const handleIconSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    setRawIconUrl(url);
    setIconEditorOpen(true);
    e.target.value = "";
  };

  const handleIconConfirm = (croppedFile: File) => {
    setIconFile(croppedFile);
    if (iconPreview && iconPreview.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
    setIconPreview(URL.createObjectURL(croppedFile));
    setIconEditorOpen(false);
  };

  const handleBannerSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    setRawBannerUrl(url);
    setBannerEditorOpen(true);
    e.target.value = "";
  };

  const handleBannerConfirm = (croppedFile: File) => {
    setBannerFile(croppedFile);
    if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(URL.createObjectURL(croppedFile));
    setBannerEditorOpen(false);
  };

  const handleSaveOverview = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage("Dê um nome para a guilda.");
      return;
    }
    setSavingOverview(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      let iconUrl: string | undefined = iconPreview === null ? undefined : guild.avatarUrl ?? undefined;
      let bannerUrl: string | undefined = bannerPreview === null ? undefined : guild.bannerUrl ?? undefined;

      if (iconFile) {
        iconUrl = await echoApi.uploadChatMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await echoApi.uploadChatMedia(bannerFile);
      }

      if (onSave) {
        await onSave({
          name: trimmed,
          iconUrl,
          bannerUrl,
          description: description.trim() || undefined,
        });
      } else {
        await echoApi.upsertGuildProfile(guild.guildId, {
          name: trimmed,
          avatarUrl: iconUrl,
          bannerUrl,
          description: description.trim() || null,
        });
      }

      // Atualiza store local
      const current = useSyncStore.getState().guilds;
      setGuilds(
        current.map((g) =>
          g.guildId === guild.guildId
            ? {
                ...g,
                name: trimmed,
                avatarUrl: iconUrl !== undefined ? iconUrl : g.avatarUrl,
                bannerUrl: bannerUrl !== undefined ? bannerUrl : g.bannerUrl,
                description: description.trim() || undefined,
              }
            : g,
        ),
      );

      setStatusMessage("Alterações salvas com sucesso!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setErrorMessage("Não foi possível salvar as alterações.");
    } finally {
      setSavingOverview(false);
    }
  };

  const handleDeleteGuild = async () => {
    setDeletingGuild(true);
    setErrorMessage(null);
    try {
      await matrixService.deleteGuild(guild.guildId);
      const current = useSyncStore.getState().guilds;
      setGuilds(current.filter((g) => g.guildId !== guild.guildId));
      const ui = useUiStore.getState();
      if (ui.activeGuildId === guild.guildId) {
        setActiveGuild(null);
        setActiveChannel(null);
      }
      setConfirmDeleteOpen(false);
      onClose();
    } catch {
      setErrorMessage("Não foi possível excluir a guilda.");
    } finally {
      setDeletingGuild(false);
    }
  };

  // ── Role Management Handlers ────────────────────────────────────

  const handleCreateRole = async () => {
    try {
      const newRole = await echoApi.createGuildRole(guild.guildId, {
        name: "Novo Cargo",
        color: "#0FB9A8",
        position: roles.length,
        isHoisted: false,
        permissions: ["SEND_MESSAGES", "CONNECT_VOICE"],
      });
      const updated = [...roles, newRole];
      setRoles(updated);
      selectRole(newRole);
    } catch {
      setErrorMessage("Falha ao criar novo cargo.");
    }
  };

  const handleSaveRole = async () => {
    if (!selectedRoleId) return;
    setSavingRole(true);
    setErrorMessage(null);
    try {
      const updated = await echoApi.updateGuildRole(guild.guildId, selectedRoleId, {
        name: roleName.trim() || "Cargo",
        color: roleColor,
        isHoisted: roleIsHoisted,
        permissions: rolePermissions,
      });
      setRoles(roles.map((r) => (r.id === selectedRoleId ? updated : r)));
      setStatusMessage("Cargo atualizado!");
      setTimeout(() => setStatusMessage(null), 2500);
    } catch {
      setErrorMessage("Falha ao salvar cargo.");
    } finally {
      setSavingRole(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      await echoApi.deleteGuildRole(guild.guildId, roleId);
      const nextRoles = roles.filter((r) => r.id !== roleId);
      setRoles(nextRoles);
      if (selectedRoleId === roleId) {
        if (nextRoles.length > 0) selectRole(nextRoles[0]);
        else setSelectedRoleId(null);
      }
    } catch {
      setErrorMessage("Falha ao excluir cargo.");
    }
  };

  const togglePermission = (permId: string) => {
    setRolePermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId],
    );
  };

  // ── Invites Handlers ────────────────────────────────────────────

  const handleCreateNewInvite = async () => {
    setCreatingInvite(true);
    try {
      await echoApi.createGuildInvite(guild.guildId, { expiresInHours: 168 });
      await loadInvites();
    } catch {
      setErrorMessage("Falha ao criar convite.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    try {
      await echoApi.deleteGuildInvite(guild.guildId, inviteId);
      setInvites(invites.filter((i) => i.id !== inviteId));
    } catch {
      setErrorMessage("Falha ao remover convite.");
    }
  };

  const handleCopyInvite = async (url: string, code: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Ignora erro
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="w-full sm:max-w-[780px] max-h-[88vh] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col gap-0 text-txt"
        >
          {/* Header Superior Padrão Guild Modal */}
          <div className="relative p-5 pb-4 border-b border-white/[0.04] flex items-center justify-between shrink-0 bg-[#10141d]/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
                <Gear size={20} weight="bold" />
              </div>
              <div>
                <DialogTitle className="font-display text-base font-semibold text-txt flex items-center gap-2">
                  Configurações do Servidor
                  <span className="text-xs px-2 py-0.5 rounded-md bg-white/[0.06] text-mut font-normal">
                    {guild.name}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-mut/80 mt-0.5">
                  Gerencie informações visuais, cargos com permissões e convites ativos.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {/* Banner de permissão se não for o dono */}
          {!isOwner && (
            <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <WarningCircle size={16} weight="bold" className="shrink-0" />
              <span>
                Apenas o dono da guilda possui permissão para salvar alterações ou modificar cargos.
              </span>
            </div>
          )}

          {/* Navegação por Abas no Topo */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-white/[0.04] bg-[#0e1117] shrink-0 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "overview"
                  ? "bg-acc text-bg shadow-sm shadow-acc/20"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <Info size={15} weight="bold" />
              Visão Geral
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("roles")}
              className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "roles"
                  ? "bg-acc text-bg shadow-sm shadow-acc/20"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <ShieldCheck size={15} weight="bold" />
              Cargos & Permissões
              {roles.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === "roles" ? "bg-bg/20 text-bg" : "bg-white/[0.08] text-mut"
                  }`}
                >
                  {roles.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "members"
                  ? "bg-acc text-bg shadow-sm shadow-acc/20"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <Users size={15} weight="bold" />
              Membros
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("invites")}
              className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === "invites"
                  ? "bg-acc text-bg shadow-sm shadow-acc/20"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <LinkIcon size={15} weight="bold" />
              Convites
              {invites.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    activeTab === "invites" ? "bg-bg/20 text-bg" : "bg-white/[0.08] text-mut"
                  }`}
                >
                  {invites.length}
                </span>
              )}
            </button>
          </div>

          {/* Feedback de Status / Erro */}
          {statusMessage && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-acc/10 border border-acc/20 text-acc text-xs flex items-center gap-2">
              <Check size={16} weight="bold" />
              <span>{statusMessage}</span>
            </div>
          )}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2">
              <WarningCircle size={16} weight="bold" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Área de Conteúdo da Aba Ativa */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
            {/* ── ABA 1: VISÃO GERAL ──────────────────────────────────── */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Hero Preview Interativo */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-mut/80 px-0.5">
                    <span>Personalização Visual</span>
                    <span className="text-[10px] font-normal lowercase tracking-normal text-mut/50">
                      Clique para alterar imagem
                    </span>
                  </div>

                  <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1017] shadow-inner group/hero">
                    {/* Área do Banner */}
                    <div
                      onClick={() => isOwner && bannerInputRef.current?.click()}
                      className={`relative h-32 w-full bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950 overflow-hidden group/banner flex items-center justify-center transition-all ${
                        isOwner ? "cursor-pointer" : "cursor-default"
                      }`}
                    >
                      {bannerPreview ? (
                        <img
                          src={bannerPreview}
                          alt="Banner da guilda"
                          className="w-full h-full object-cover group-hover/banner:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-mut/60 gap-1.5 transition-colors group-hover/banner:text-txt">
                          <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm group-hover/banner:bg-white/[0.08] group-hover/banner:border-acc/40 transition-all">
                            <Camera size={18} className="group-hover/banner:text-acc transition-colors" />
                          </div>
                          <span className="text-[11px] font-medium">Adicionar banner (16:9)</span>
                        </div>
                      )}

                      {/* Overlay no Hover para o Dono */}
                      {bannerPreview && isOwner && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/banner:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          <span className="px-3 py-1.5 rounded-xl bg-black/60 text-xs font-medium text-white backdrop-blur-md flex items-center gap-1.5 border border-white/10">
                            <Camera size={14} /> Trocar banner
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBannerFile(null);
                              setBannerPreview(null);
                            }}
                            className="cursor-pointer p-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors"
                            title="Remover banner"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Avatar Flutuante e Título Dinâmico */}
                    <div className="px-5 pb-3.5 -mt-9 flex items-end justify-between relative z-10">
                      <div
                        onClick={() => isOwner && iconInputRef.current?.click()}
                        className={`relative h-20 w-20 rounded-2xl border-4 border-[#12161f] bg-[#161c28] shadow-xl overflow-hidden group/avatar flex items-center justify-center shrink-0 ${
                          isOwner ? "cursor-pointer" : "cursor-default"
                        }`}
                      >
                        {iconPreview ? (
                          <img
                            src={iconPreview}
                            alt="Ícone da guilda"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-acc/20 to-acc/5 text-acc">
                            <span className="font-display text-2xl font-bold tracking-wider">
                              {getInitials(name)}
                            </span>
                          </div>
                        )}

                        {isOwner && (
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-1 text-white transition-opacity">
                            <Camera size={18} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                              {iconPreview ? "Trocar" : "Ícone"}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mb-1 text-right">
                        <div className="font-display font-bold text-sm text-txt drop-shadow">
                          {name.trim() || "Nome da Guilda"}
                        </div>
                        <div className="text-[11px] text-mut/80">
                          ID: {guild.guildId.slice(0, 14)}...
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Campos de Nome e Descrição */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="guild-name-input" className="text-xs font-semibold uppercase tracking-wider text-mut">
                        Nome da Guilda <span className="text-acc">*</span>
                      </Label>
                      <span className="font-mono text-[11px] text-mut/60">{name.length}/100</span>
                    </div>
                    <Input
                      id="guild-name-input"
                      value={name}
                      maxLength={100}
                      disabled={!isOwner}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Minha Comunidade"
                      className="bg-white/[0.03] border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-txt focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="guild-desc-input" className="text-xs font-semibold uppercase tracking-wider text-mut">
                        Descrição da Comunidade
                      </Label>
                      <span className="font-mono text-[11px] text-mut/60">{description.length}/280</span>
                    </div>
                    <Textarea
                      id="guild-desc-input"
                      value={description}
                      maxLength={280}
                      rows={3}
                      disabled={!isOwner}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva o propósito da comunidade..."
                      className="bg-white/[0.03] border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-txt focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all resize-none"
                    />
                  </div>
                </div>

                {/* Botão de Salvar Overview */}
                {isOwner && (
                  <div className="flex justify-end pt-2">
                    <Button
                      type="button"
                      disabled={savingOverview || !name.trim()}
                      onClick={handleSaveOverview}
                      className="cursor-pointer rounded-xl bg-acc text-bg font-semibold px-6 py-2.5 shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center gap-2"
                    >
                      {savingOverview ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                )}

                {/* Zona de Perigo (Exclusão da Guilda) */}
                {isOwner && (
                  <div className="mt-8 pt-6 border-t border-white/[0.08] space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-red-400">
                      Zona de Perigo
                    </h3>
                    <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.04] flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-txt">Excluir este servidor</div>
                        <div className="text-xs text-mut/80 mt-0.5">
                          Essa ação é irreversível. Todos os canais, mensagens e permissões serão apagados.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => setConfirmDeleteOpen(true)}
                        className="cursor-pointer shrink-0 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 active:scale-95 transition-all text-xs font-medium px-4 py-2"
                      >
                        Excluir Guilda
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ABA 2: CARGOS & PERMISSÕES ─────────────────────────── */}
            {activeTab === "roles" && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[380px]">
                {/* Coluna da Esquerda: Lista de Cargos */}
                <div className="md:col-span-4 border-r border-white/[0.06] pr-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-mut">
                      Cargos ({roles.length})
                    </span>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={handleCreateRole}
                        className="cursor-pointer text-xs font-semibold text-acc hover:underline flex items-center gap-1"
                      >
                        <Plus size={14} weight="bold" /> Criar Cargo
                      </button>
                    )}
                  </div>

                  <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-thin">
                    {loadingRoles ? (
                      <div className="text-xs text-mut py-4 text-center">Carregando cargos...</div>
                    ) : roles.length === 0 ? (
                      <div className="text-xs text-mut py-6 text-center border border-dashed border-white/[0.06] rounded-xl">
                        Nenhum cargo criado ainda.
                      </div>
                    ) : (
                      roles.map((r) => {
                        const isSelected = selectedRoleId === r.id;
                        return (
                          <div
                            key={r.id}
                            onClick={() => selectRole(r)}
                            className={`group cursor-pointer flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                              isSelected
                                ? "bg-white/[0.08] text-txt font-semibold border border-white/[0.12]"
                                : "text-mut hover:bg-white/[0.03] hover:text-txt"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-3 h-3 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: r.color || "#0FB9A8" }}
                              />
                              <span className="truncate">{r.name}</span>
                            </div>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteRole(r.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-mut hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title="Excluir cargo"
                              >
                                <Trash size={13} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Coluna da Direita: Editor do Cargo Selecionado */}
                <div className="md:col-span-8 space-y-5">
                  {selectedRoleId ? (
                    <>
                      <div className="space-y-4">
                        {/* Nome do cargo */}
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-mut">
                            Nome do Cargo
                          </Label>
                          <Input
                            value={roleName}
                            disabled={!isOwner}
                            onChange={(e) => setRoleName(e.target.value)}
                            className="bg-white/[0.03] border-white/[0.08] rounded-xl px-3.5 py-2 text-sm text-txt focus:border-acc/50"
                          />
                        </div>

                        {/* Cor do Cargo */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-mut">
                            Cor do Cargo
                          </Label>
                          <div className="flex items-center gap-2 flex-wrap">
                            {PRESET_COLORS.map((hex) => (
                              <button
                                key={hex}
                                type="button"
                                disabled={!isOwner}
                                onClick={() => setRoleColor(hex)}
                                className={`w-7 h-7 rounded-lg transition-transform ${
                                  roleColor === hex
                                    ? "scale-110 ring-2 ring-white shadow-lg"
                                    : "hover:scale-105 opacity-80"
                                }`}
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                            <div className="flex items-center gap-1.5 ml-2">
                              <input
                                type="color"
                                disabled={!isOwner}
                                value={roleColor}
                                onChange={(e) => setRoleColor(e.target.value)}
                                className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border-0"
                              />
                              <span className="font-mono text-xs text-mut">{roleColor}</span>
                            </div>
                          </div>
                        </div>

                        {/* Hoist Toggle */}
                        <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                          <div>
                            <div className="text-xs font-semibold text-txt">Exibir cargo separadamente</div>
                            <div className="text-[11px] text-mut/70">
                              Agrupa os membros deste cargo em destaque na lista de membros.
                            </div>
                          </div>
                          <input
                            type="checkbox"
                            disabled={!isOwner}
                            checked={roleIsHoisted}
                            onChange={(e) => setRoleIsHoisted(e.target.checked)}
                            className="w-4 h-4 rounded text-acc cursor-pointer accent-acc"
                          />
                        </div>

                        {/* Permissões Granulares */}
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-mut">
                            Permissões do Cargo
                          </Label>
                          <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-thin pr-1">
                            {AVAILABLE_PERMISSIONS.map((perm) => {
                              const checked = rolePermissions.includes(perm.id);
                              return (
                                <div
                                  key={perm.id}
                                  onClick={() => isOwner && togglePermission(perm.id)}
                                  className={`p-2.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                    isOwner ? "cursor-pointer" : "cursor-default"
                                  } ${
                                    checked
                                      ? "bg-acc/5 border-acc/30 text-txt"
                                      : "bg-white/[0.01] border-white/[0.05] text-mut hover:border-white/[0.1]"
                                  }`}
                                >
                                  <div>
                                    <div className="text-xs font-semibold text-txt">{perm.name}</div>
                                    <div className="text-[11px] text-mut/70">{perm.desc}</div>
                                  </div>
                                  <input
                                    type="checkbox"
                                    disabled={!isOwner}
                                    checked={checked}
                                    onChange={() => {}}
                                    className="mt-0.5 w-4 h-4 rounded text-acc cursor-pointer accent-acc shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Ações do Cargo */}
                      {isOwner && (
                        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => selectedRoleId && handleDeleteRole(selectedRoleId)}
                            className="cursor-pointer rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 text-xs px-3 py-1.5"
                          >
                            Excluir Cargo
                          </Button>
                          <Button
                            type="button"
                            disabled={savingRole}
                            onClick={handleSaveRole}
                            className="cursor-pointer rounded-xl bg-acc text-bg font-semibold text-xs px-5 py-2 shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all"
                          >
                            {savingRole ? "Salvando..." : "Salvar Cargo"}
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-mut text-xs py-12">
                      <ShieldCheck size={36} className="text-mut/40 mb-2" />
                      Selecione um cargo à esquerda para editar permissões.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ABA 3: MEMBROS & APELIDOS ───────────────────────────── */}
            {activeTab === "members" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-mut">
                  <span>Membros da Comunidade</span>
                  <span className="text-[11px] font-normal lowercase text-mut/60">
                    Gerencie cargos e apelidos no servidor
                  </span>
                </div>

                {loadingMembers ? (
                  <div className="text-xs text-mut py-6 text-center">Carregando membros...</div>
                ) : (
                  <div className="space-y-2">
                    {/* Lista membros mapeados */}
                    {membersData?.memberProfiles && membersData.memberProfiles.length > 0 ? (
                      membersData.memberProfiles.map((mp) => {
                        const userRoles = (membersData.memberRoles || [])
                          .filter((mr) => mr.userId === mp.userId)
                          .map((mr) => (membersData.roles || []).find((r) => r.id === mr.roleId))
                          .filter(Boolean) as GuildRole[];

                        return (
                          <div
                            key={mp.userId}
                            className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-[#161c28] border border-white/[0.08] flex items-center justify-center font-bold text-xs text-acc shrink-0">
                                {mp.nickname ? mp.nickname[0].toUpperCase() : mp.userId[1]?.toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-txt flex items-center gap-2">
                                  <span>{mp.nickname || mp.userId.replace(/^@/, "").split(":")[0]}</span>
                                  {mp.userId === guild.createdBy && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-medium">
                                      Dono
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-mut/60 truncate">
                                  @{mp.userId.replace(/^@/, "").split(":")[0]}
                                </div>
                              </div>
                            </div>

                            {/* Badges de Cargos */}
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {userRoles.map((role) => (
                                <span
                                  key={role.id}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1"
                                  style={{
                                    backgroundColor: `${role.color || "#0FB9A8"}20`,
                                    color: role.color || "#0FB9A8",
                                    border: `1px solid ${role.color || "#0FB9A8"}40`,
                                  }}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: role.color || "#0FB9A8" }}
                                  />
                                  {role.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-xs text-mut border border-dashed border-white/[0.06] rounded-xl">
                        Nenhum perfil específico registrado para esta guilda. Novos membros sincronizarão automaticamente.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ABA 4: CONVITES ATIVOS ──────────────────────────────── */}
            {activeTab === "invites" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-mut">
                      Links de Convite Ativos
                    </h3>
                    <p className="text-xs text-mut/70 mt-0.5">
                      Qualquer pessoa com estes links pode entrar no seu servidor pelo navegador ou pelo Echo.
                    </p>
                  </div>
                  {isOwner && (
                    <Button
                      type="button"
                      disabled={creatingInvite}
                      onClick={handleCreateNewInvite}
                      className="cursor-pointer rounded-xl bg-acc text-bg font-semibold text-xs px-3.5 py-2 shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center gap-1.5"
                    >
                      <UserPlus size={14} weight="bold" />
                      {creatingInvite ? "Gerando..." : "Novo Convite"}
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  {loadingInvites ? (
                    <div className="text-xs text-mut py-6 text-center">Carregando convites...</div>
                  ) : invites.length === 0 ? (
                    <div className="text-xs text-mut py-8 text-center border border-dashed border-white/[0.06] rounded-xl">
                      Nenhum link de convite ativo encontrado. Clique acima para gerar um!
                    </div>
                  ) : (
                    invites.map((inv) => {
                      const isCopied = copiedCode === inv.code;
                      return (
                        <div
                          key={inv.id}
                          className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="font-mono text-xs text-acc font-semibold flex items-center gap-2">
                              <span>{inv.code}</span>
                              <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-white/[0.06] text-mut">
                                {inv.usesCount} {inv.usesCount === 1 ? "uso" : "usos"}
                              </span>
                            </div>
                            <div className="text-[11px] text-mut/80 truncate">{inv.url}</div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyInvite(inv.url, inv.code)}
                              className="cursor-pointer px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-txt text-xs font-medium flex items-center gap-1.5 active:scale-95 transition-all"
                            >
                              {isCopied ? (
                                <>
                                  <Check size={13} className="text-acc" /> Copiado
                                </>
                              ) : (
                                <>
                                  <Copy size={13} /> Copiar
                                </>
                              )}
                            </button>
                            {isOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteInvite(inv.id)}
                                className="cursor-pointer p-1.5 rounded-xl text-mut hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all"
                                title="Revogar convite"
                              >
                                <Trash size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hidden inputs para arquivos de imagem */}
          <input
            ref={iconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleIconSelected}
          />
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleBannerSelected}
          />
        </DialogContent>
      </Dialog>

      {/* Image Cropper Modals */}
      {rawIconUrl && (
        <ImageEditor
          open={iconEditorOpen}
          imageSrc={rawIconUrl}
          title="Ajustar Ícone da Guilda"
          aspect={1}
          outputWidth={512}
          outputHeight={512}
          onClose={() => setIconEditorOpen(false)}
          onConfirm={handleIconConfirm}
        />
      )}
      {rawBannerUrl && (
        <ImageEditor
          open={bannerEditorOpen}
          imageSrc={rawBannerUrl}
          title="Ajustar Banner da Guilda"
          aspect={16 / 9}
          outputWidth={1280}
          outputHeight={720}
          onClose={() => setBannerEditorOpen(false)}
          onConfirm={handleBannerConfirm}
        />
      )}

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent
          showCloseButton={false}
          className="w-full sm:max-w-[400px] rounded-2xl border border-red-500/30 bg-[#12161f] p-6 shadow-2xl text-txt gap-4"
        >
          <div className="flex items-center gap-3 text-red-400">
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
              <WarningCircle size={24} weight="bold" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-txt">Excluir Guilda</DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Essa ação é permanente e irreversível.
              </DialogDescription>
            </div>
          </div>
          <p className="text-xs text-mut leading-relaxed">
            Tem certeza absoluta de que deseja excluir permanentemente a guilda{" "}
            <strong className="text-txt">{guild.name}</strong>? Todas as salas, cargos e mensagens serão perdidos.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deletingGuild}
              onClick={() => setConfirmDeleteOpen(false)}
              className="cursor-pointer flex-1 rounded-xl border-white/[0.08] bg-white/[0.03] text-txt hover:bg-white/[0.08]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingGuild}
              onClick={handleDeleteGuild}
              className="cursor-pointer flex-1 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 active:scale-95"
            >
              {deletingGuild ? "Excluindo..." : "Sim, Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
