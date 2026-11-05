"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Hash,
  SpeakerHigh,
  X,
  Check,
  Plus,
  Trash,
  Lock,
  LockOpen,
  ShieldCheck,
  User,
  Users,
  WarningCircle,
  Gear,
} from "@phosphor-icons/react";
import {
  ALL_CHANNEL_PERMISSIONS,
  ChannelOverride,
  ChannelPermissionType,
  ChannelPermissionsConfig,
  PermissionState,
  createDefaultChannelPermissions,
  getOverrideState,
  setOverrideState,
} from "@/lib/permissions/channelPermissions";
import { useSyncStore } from "@/stores/syncStore";
import MxcImage from "@/components/media/MxcImage";

export interface ChannelSettingsModalProps {
  open: boolean;
  onClose: () => void;
  channel: {
    channelId: string;
    name: string;
    type?: string;
    topic?: string | null;
  };
  guildId: string;
  onSave?: (updates: { name: string; topic?: string | null }) => Promise<void> | void;
  onDelete?: (channelId: string) => Promise<void> | void;
}

const EMPTY_ARRAY: any[] = Object.freeze([]) as any;
const EMPTY_RECORD: Record<string, any> = Object.freeze({}) as any;

type TabType = "overview" | "permissions";

export default function ChannelSettingsModal({
  open,
  onClose,
  channel,
  guildId,
  onSave,
  onDelete,
}: ChannelSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic || "");
  const [isPrivate, setIsPrivate] = useState(false);
  const [overrides, setOverrides] = useState<ChannelOverride[]>([]);
  const [selectedOverrideId, setSelectedOverrideId] = useState<string>("@everyone");
  const [addEntityModalOpen, setAddEntityModalOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVoice = channel.type === "voice";

  // Guild roles and member profiles from syncStore (using stable fallback to prevent infinite loop)
  const guildRoles = useSyncStore((s) => s.guildRoles[guildId] ?? EMPTY_ARRAY);
  const guildMemberProfiles = useSyncStore((s) => s.guildMemberProfiles[guildId] ?? EMPTY_RECORD);
  const roomMembers = useSyncStore((s) => s.membersByRoom[channel.channelId] ?? s.membersByRoom[guildId] ?? EMPTY_ARRAY);
  const setChannelPermissions = useSyncStore((s) => s.setChannelPermissions);

  // Initialize form state when channel changes or modal opens
  useEffect(() => {
    if (!open) return;
    setName(channel.name);
    setTopic(channel.topic || "");
    setError(null);
    setActiveTab("overview");

    const existingConfig = useSyncStore.getState().channelPermissions[channel.channelId];
    if (existingConfig) {
      setIsPrivate(Boolean(existingConfig.isPrivate));
      setOverrides(existingConfig.overrides || []);
      setSelectedOverrideId(existingConfig.overrides[0]?.id || "@everyone");
    } else {
      const def = createDefaultChannelPermissions(channel.channelId, { isPrivate: false });
      setIsPrivate(def.isPrivate || false);
      setOverrides(def.overrides);
      setSelectedOverrideId("@everyone");
    }
  }, [open, channel.channelId, channel.name, channel.topic]);

  // Selected override entity
  const selectedOverride = useMemo(() => {
    return overrides.find((o) => o.id === selectedOverrideId) || overrides[0];
  }, [overrides, selectedOverrideId]);

  // Filter permissions based on channel type
  const availablePermissions = useMemo(() => {
    return ALL_CHANNEL_PERMISSIONS.filter((p) => {
      if (p.category === "general") return true;
      if (isVoice) return p.category === "voice";
      return p.category === "text";
    });
  }, [isVoice]);

  // Change permission state for selected entity
  const handlePermissionChange = (
    permId: ChannelPermissionType,
    nextState: PermissionState,
  ) => {
    if (!selectedOverride) return;
    const updated = setOverrideState(selectedOverride, permId, nextState);
    setOverrides((prev) =>
      prev.map((o) => (o.id === updated.id && o.type === updated.type ? updated : o)),
    );
  };

  // Toggle private channel status
  const handleTogglePrivate = (newIsPrivate: boolean) => {
    setIsPrivate(newIsPrivate);
    // If making private, ensure @everyone is denied VIEW_CHANNEL
    setOverrides((prev) => {
      return prev.map((o) => {
        if (o.id === "@everyone") {
          return setOverrideState(o, "VIEW_CHANNEL", newIsPrivate ? "deny" : "allow");
        }
        return o;
      });
    });
  };

  // Add role or member to overrides
  const handleAddRoleOverride = (role: { id?: string; roleId?: string; name: string; color?: string | null }) => {
    const roleId = role.id || role.roleId || "";
    if (!roleId || overrides.some((o) => o.id === roleId)) return;
    const newOverride: ChannelOverride = {
      id: roleId,
      type: "role",
      name: role.name,
      color: role.color || null,
      allow: isPrivate ? ["VIEW_CHANNEL"] : [],
      deny: [],
    };
    setOverrides((prev) => [...prev, newOverride]);
    setSelectedOverrideId(roleId);
    setAddEntityModalOpen(false);
  };

  const handleAddMemberOverride = (member: { userId: string; name: string; avatarUrl?: string | null }) => {
    if (overrides.some((o) => o.id === member.userId)) return;
    const newOverride: ChannelOverride = {
      id: member.userId,
      type: "member",
      name: member.name,
      avatarUrl: member.avatarUrl || null,
      allow: isPrivate ? ["VIEW_CHANNEL"] : [],
      deny: [],
    };
    setOverrides((prev) => [...prev, newOverride]);
    setSelectedOverrideId(member.userId);
    setAddEntityModalOpen(false);
  };

  // Remove override
  const handleRemoveOverride = (overrideId: string) => {
    if (overrideId === "@everyone") return; // cannot remove @everyone
    setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    setSelectedOverrideId("@everyone");
  };

  // Save changes
  const handleSave = async () => {
    const trimmedName = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmedName) {
      setError("O canal precisa de um nome válido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const config: ChannelPermissionsConfig = {
        channelId: channel.channelId,
        isPrivate,
        overrides,
      };
      setChannelPermissions(channel.channelId, config);

      if (onSave) {
        await onSave({ name: trimmedName, topic: topic.trim() || null });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar alterações no canal.");
    } finally {
      setSaving(false);
    }
  };

  // Delete channel
  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(channel.channelId);
      setConfirmDeleteOpen(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao excluir o canal.");
    } finally {
      setDeleting(false);
    }
  };

  // Lists for Add Modal (filtered to unadded entities)
  const availableRolesToAdd = useMemo(() => {
    return guildRoles.filter((r) => !overrides.some((o) => o.id === (r.id || (r as any).roleId)));
  }, [guildRoles, overrides]);

  const availableMembersToAdd = useMemo(() => {
    const list: { userId: string; name: string; avatarUrl?: string | null }[] = [];
    const seen = new Set<string>();

    for (const [uid, prof] of Object.entries(guildMemberProfiles)) {
      if (seen.has(uid)) continue;
      seen.add(uid);
      list.push({
        userId: uid,
        name: prof.nickname || uid.replace(/^@/, "").split(":")[0],
        avatarUrl: prof.avatarUrl,
      });
    }

    for (const m of roomMembers) {
      if (seen.has(m.userId)) continue;
      seen.add(m.userId);
      list.push({
        userId: m.userId,
        name: m.displayName || m.userId.replace(/^@/, "").split(":")[0],
        avatarUrl: m.avatarUrl,
      });
    }

    return list.filter((m) => !overrides.some((o) => o.id === m.userId));
  }, [guildMemberProfiles, roomMembers, overrides]);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="w-full sm:max-w-[700px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0 text-txt"
        >
          {/* Header Superior Fixo - Padrão Guild Modal */}
          <div className="relative p-6 pb-4 border-b border-white/[0.08] flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20 shrink-0">
                {isVoice ? <SpeakerHigh size={20} weight="bold" /> : <Hash size={20} weight="bold" />}
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display text-lg font-semibold text-txt flex items-center gap-2 truncate">
                  <span>Configurações do Canal:</span>
                  <span className="text-acc font-mono">#{channel.name}</span>
                </DialogTitle>
                <DialogDescription className="text-xs text-mut/80 mt-0.5">
                  Personalize visão geral e controle detalhado de permissões de cargos e membros.
                </DialogDescription>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          {/* Abas de Navegação */}
          <div className="flex items-center gap-2 px-6 pt-3 border-b border-white/[0.06] bg-white/[0.01]">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`cursor-pointer px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "overview"
                  ? "border-acc text-acc bg-white/[0.03]"
                  : "border-transparent text-mut hover:text-txt hover:bg-white/[0.02]"
              }`}
            >
              <Gear size={15} />
              <span>Visão Geral</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("permissions")}
              className={`cursor-pointer px-3.5 py-2 text-xs font-semibold rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
                activeTab === "permissions"
                  ? "border-acc text-acc bg-white/[0.03]"
                  : "border-transparent text-mut hover:text-txt hover:bg-white/[0.02]"
              }`}
            >
              <ShieldCheck size={15} />
              <span>Permissões (Cargos e Membros)</span>
              {isPrivate && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-400 font-mono">
                  <Lock size={10} /> Privado
                </span>
              )}
            </button>
          </div>

          {/* Feedback de Erro */}
          {error && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
              <WarningCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Conteúdo da Aba: Visão Geral */}
          {activeTab === "overview" && (
            <div className="p-6 space-y-5">
              {/* Nome do Canal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="channel-name" className="text-xs font-semibold uppercase tracking-wider text-mut">
                    Nome do Canal
                  </label>
                  <span className="font-mono text-[11px] text-mut/60">{name.length}/40</span>
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-mut/60">
                    {isVoice ? <SpeakerHigh size={15} /> : <Hash size={15} />}
                  </span>
                  <input
                    id="channel-name"
                    type="text"
                    maxLength={40}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-txt focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all outline-none"
                    placeholder="nome-do-canal"
                  />
                </div>
              </div>

              {/* Tópico do Canal */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="channel-topic" className="text-xs font-semibold uppercase tracking-wider text-mut">
                    Tópico do Canal
                  </label>
                  <span className="font-mono text-[11px] text-mut/60">{topic.length}/1024</span>
                </div>
                <textarea
                  id="channel-topic"
                  rows={3}
                  maxLength={1024}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-txt focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all outline-none resize-none"
                  placeholder="Defina o assunto ou as diretrizes deste canal..."
                />
              </div>

              {/* Card de Canal Privado */}
              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${isPrivate ? "bg-amber-500/10 text-amber-400" : "bg-white/[0.05] text-mut"}`}>
                    {isPrivate ? <Lock size={20} /> : <LockOpen size={20} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-txt flex items-center gap-2">
                      <span>Canal Privado</span>
                    </h4>
                    <p className="text-xs text-mut/80 mt-0.5 leading-relaxed">
                      Ao ativar, apenas membros e cargos permitidos explicitamente na aba de permissões poderão ver este canal.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={isPrivate}
                  onClick={() => handleTogglePrivate(!isPrivate)}
                  className={`cursor-pointer w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                    isPrivate ? "bg-acc" : "bg-white/[0.15]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                      isPrivate ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Conteúdo da Aba: Permissões de Cargos e Membros */}
          {activeTab === "permissions" && (
            <div className="flex flex-col md:flex-row h-[420px] border-t border-white/[0.06]">
              {/* Coluna Esquerda: Lista de Sobrescritas (Cargos e Membros) */}
              <div className="w-full md:w-[220px] border-r border-white/[0.08] p-3 flex flex-col bg-white/[0.01]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-mut/80">
                    Cargos & Membros
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddEntityModalOpen(true)}
                    className="cursor-pointer p-1 rounded-lg text-acc hover:bg-acc/10 active:scale-95 transition-all"
                    title="Adicionar cargo ou membro"
                  >
                    <Plus size={15} weight="bold" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {overrides.map((override) => {
                    const isSelected = selectedOverride?.id === override.id;
                    const isRole = override.type === "role";

                    return (
                      <button
                        key={`${override.type}-${override.id}`}
                        type="button"
                        onClick={() => setSelectedOverrideId(override.id)}
                        className={`cursor-pointer w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium text-left transition-all ${
                          isSelected
                            ? "bg-white/[0.08] text-txt shadow-sm border border-white/[0.08]"
                            : "text-mut hover:bg-white/[0.03] hover:text-txt"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isRole ? (
                            override.id === "@everyone" ? (
                              <Users size={14} className="text-mut/70 shrink-0" />
                            ) : (
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: override.color || "#0FB9A8" }}
                              />
                            )
                          ) : override.avatarUrl ? (
                            <MxcImage
                              mxcUrl={override.avatarUrl}
                              alt={override.name}
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                              width={16}
                              height={16}
                            />
                          ) : (
                            <User size={14} className="text-mut/70 shrink-0" />
                          )}
                          <span className="truncate">{override.name}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coluna Direita: Editor de Permissões para a Sobrescrita Selecionada */}
              <div className="flex-1 flex flex-col p-4 overflow-y-auto scrollbar-thin">
                {selectedOverride ? (
                  <>
                    {/* Header do Cargo/Membro Selecionado */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
                      <div className="flex items-center gap-2.5">
                        {selectedOverride.type === "role" ? (
                          selectedOverride.id === "@everyone" ? (
                            <div className="p-2 rounded-xl bg-white/[0.05] text-mut">
                              <Users size={16} />
                            </div>
                          ) : (
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: selectedOverride.color || "#0FB9A8" }}
                            />
                          )
                        ) : (
                          <div className="p-1 rounded-xl bg-white/[0.05] text-acc">
                            <User size={16} />
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-semibold text-txt flex items-center gap-2">
                            <span>{selectedOverride.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-mut">
                              {selectedOverride.type === "role" ? "Cargo" : "Membro"}
                            </span>
                          </h4>
                        </div>
                      </div>

                      {selectedOverride.id !== "@everyone" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOverride(selectedOverride.id)}
                          className="cursor-pointer px-2.5 py-1.5 rounded-xl text-xs text-red-400 hover:bg-red-500/10 active:scale-95 transition-all flex items-center gap-1.5"
                          title="Remover sobrescrita deste canal"
                        >
                          <Trash size={14} />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    {/* Lista de Permissões com Controle de 3 Estados (Negar / Herdar / Permitir) */}
                    <div className="space-y-3.5 pr-1">
                      {availablePermissions.map((perm) => {
                        const state = getOverrideState(selectedOverride, perm.id);

                        return (
                          <div
                            key={perm.id}
                            className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="text-xs font-semibold text-txt">{perm.name}</div>
                              <div className="text-[11px] text-mut/80 mt-0.5 leading-relaxed">
                                {perm.description}
                              </div>
                            </div>

                            {/* Seletor 3-State: Negar (X), Herdar (/), Permitir (✓) */}
                            <div className="flex items-center rounded-xl bg-white/[0.04] p-1 border border-white/[0.08] shrink-0">
                              {/* Botão Negar */}
                              <button
                                type="button"
                                title="Negar permissão"
                                onClick={() => handlePermissionChange(perm.id, "deny")}
                                className={`cursor-pointer p-1.5 rounded-lg text-xs font-bold transition-all ${
                                  state === "deny"
                                    ? "bg-red-500 text-white shadow-sm shadow-red-500/30"
                                    : "text-mut hover:text-red-400 hover:bg-red-500/10"
                                }`}
                              >
                                <X size={14} weight="bold" />
                              </button>

                              {/* Botão Herdar / Neutro */}
                              <button
                                type="button"
                                title="Herdar permissão padrão"
                                onClick={() => handlePermissionChange(perm.id, "inherit")}
                                className={`cursor-pointer px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  state === "inherit"
                                    ? "bg-white/[0.12] text-txt shadow-sm"
                                    : "text-mut/60 hover:text-txt hover:bg-white/[0.06]"
                                }`}
                              >
                                /
                              </button>

                              {/* Botão Permitir */}
                              <button
                                type="button"
                                title="Permitir permissão"
                                onClick={() => handlePermissionChange(perm.id, "allow")}
                                className={`cursor-pointer p-1.5 rounded-lg text-xs font-bold transition-all ${
                                  state === "allow"
                                    ? "bg-acc text-bg shadow-sm shadow-acc/30"
                                    : "text-mut hover:text-acc hover:bg-acc/10"
                                }`}
                              >
                                <Check size={14} weight="bold" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-mut text-xs">
                    Selecione um cargo ou membro à esquerda para gerenciar permissões.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rodapé de Ações - Padrão Guild Modal */}
          <div className="p-6 pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3 bg-white/[0.01]">
            {onDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="cursor-pointer px-3.5 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 active:scale-95 transition-all flex items-center gap-1.5"
              >
                <Trash size={15} />
                <span>Excluir Canal</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-semibold text-txt hover:bg-white/[0.08] active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSave}
                className="cursor-pointer px-5 py-2 rounded-xl bg-acc text-bg text-xs font-semibold shadow-lg shadow-acc/20 hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Cargo ou Membro à Sobrescrita */}
      {addEntityModalOpen && (
        <Dialog open={addEntityModalOpen} onOpenChange={setAddEntityModalOpen}>
          <DialogContent
            showCloseButton={false}
            className="w-full sm:max-w-[420px] max-h-[80vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0 text-txt"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="font-display font-semibold text-sm">Adicionar Cargo ou Membro</div>
              <button
                type="button"
                onClick={() => setAddEntityModalOpen(false)}
                className="cursor-pointer p-1 rounded-lg text-mut hover:text-txt"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {/* Seção Cargos */}
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-mut/70 px-1 mb-1.5">
                  Cargos da Guilda
                </h5>
                {availableRolesToAdd.length > 0 ? (
                  <div className="space-y-1">
                    {availableRolesToAdd.map((role) => (
                      <button
                        key={role.id || (role as any).roleId}
                        type="button"
                        onClick={() => handleAddRoleOverride(role)}
                        className="cursor-pointer w-full flex items-center gap-2.5 p-2 rounded-xl text-xs hover:bg-white/[0.05] text-left transition-all"
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: role.color || "#0FB9A8" }}
                        />
                        <span className="font-medium text-txt">{role.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-mut/50 px-1 italic">Todos os cargos já foram adicionados.</p>
                )}
              </div>

              {/* Seção Membros */}
              <div>
                <h5 className="text-[10px] font-bold uppercase tracking-wider text-mut/70 px-1 mb-1.5">
                  Membros
                </h5>
                {availableMembersToAdd.length > 0 ? (
                  <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                    {availableMembersToAdd.map((member) => (
                      <button
                        key={member.userId}
                        type="button"
                        onClick={() => handleAddMemberOverride(member)}
                        className="cursor-pointer w-full flex items-center gap-2.5 p-2 rounded-xl text-xs hover:bg-white/[0.05] text-left transition-all"
                      >
                        {member.avatarUrl ? (
                          <MxcImage
                            mxcUrl={member.avatarUrl}
                            alt={member.name}
                            className="w-5 h-5 rounded-full object-cover shrink-0"
                            width={20}
                            height={20}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-acc/10 text-acc flex items-center justify-center font-bold text-[10px] shrink-0">
                            {member.name[0]?.toUpperCase() || "U"}
                          </div>
                        )}
                        <span className="font-medium text-txt truncate">{member.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-mut/50 px-1 italic">Nenhum outro membro disponível.</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmação de Exclusão de Canal */}
      {confirmDeleteOpen && (
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent
            showCloseButton={false}
            className="w-full sm:max-w-[400px] rounded-2xl border border-white/[0.08] bg-[#12161f] p-5 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0 text-txt"
          >
            <div className="flex items-center gap-3 pb-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400">
                <WarningCircle size={22} weight="bold" />
              </div>
              <div>
                <DialogTitle className="font-display text-sm font-semibold text-txt">
                  Excluir canal #{channel.name}?
                </DialogTitle>
                <DialogDescription className="text-xs text-mut mt-0.5">
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </div>
            </div>

            <p className="text-xs text-mut/90 py-2">
              Todas as mensagens e configurações deste canal serão permanentemente removidas.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="cursor-pointer px-3.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-medium text-txt hover:bg-white/[0.06]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="cursor-pointer px-4 py-1.5 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 active:scale-95 disabled:opacity-50"
              >
                {deleting ? "Excluindo..." : "Sim, Excluir"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
