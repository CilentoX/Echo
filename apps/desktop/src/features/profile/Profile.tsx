import { useEffect, useState } from "react";
import { Pencil, Link, ShieldCheck, Users, Gift, X, Image } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";
import { matrixService } from "@/lib/matrix/instance";

export interface ProfileProps {
  /** Quando verdadeiro, a sheet fica aberta. Controlada pelo pai. */
  open: boolean;
  onClose: () => void;
}

/**
 * Sheet de perfil do usuário logado.
 * Abas estilo Discord: Perfil (padrão), Conquistas e Ligações.
 * Qualquer membro da mesma guilda pode ver o perfil de outro usuário.
 */
export default function Profile({ open, onClose }: ProfileProps) {
  const {
    displayName,
    username,
    nickname,
    avatarUrl,
    bannerUrl,
    bio,
    role,
    joinedAt,
    links,
    setDisplayName,
    setNickname,
    setBio,
    setRole,
    setAvatarUrl,
    setBannerUrl,
    setLinks,
  } = useProfileStore();

  const [tab, setTab] = useState<string>("profile");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [draftNickname, setDraftNickname] = useState(nickname ?? "");
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [draftRole, setDraftRole] = useState(role ?? "");
  const [draftLinks, setDraftLinks] = useState([...links]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const handleSave = async () => {
    setDisplayName(draftName);
    setNickname(draftNickname || null);
    setBio(draftBio || null);
    setRole(draftRole || null);
    setLinks(draftLinks);
    setEditing(false);
  };

  const handleAddLink = () => {
    setDraftLinks([...draftLinks, { label: "", url: "" }]);
  };

  const handleRemoveLink = (index: number) => {
    setDraftLinks(draftLinks.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, field: "label" | "url", value: string) => {
    const next = [...draftLinks];
    next[index] = { ...next[index], [field]: value };
    setDraftLinks(next);
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploadingAvatar(true);
    try {
      const uri = await matrixService.uploadMedia(file);
      await matrixService.setAvatarUrl(uri);
      setAvatarUrl(uri);
    } catch {
      // falha silenciosa — o usuário pode tentar novamente
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleBannerChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setUploadingBanner(true);
    try {
      const uri = await matrixService.uploadMedia(file);
      await setBannerUrl(uri);
    } catch {
      // falha silenciosa
    } finally {
      setUploadingBanner(false);
      e.target.value = "";
    }
  };

  if (!open) return null;

  // Fecha a sheet ao pressionar Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const TABS: Array<[string, string]> = [
    ["profile", "Perfil"],
    ["badges", "Conquistas"],
    ["connections", "Ligações"],
  ];

  return (
    <aside
      data-column="profile"
      aria-label="Perfil"
      className="fixed inset-y-0 right-0 z-50 w-[460px] bg-surf border-l border-bd flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-bd px-5 py-4 bg-surf/50 backdrop-blur">
        <h2 className="font-display text-lg font-semibold text-txt">Perfil</h2>
        <button
          type="button"
          aria-label="Fechar perfil"
          onClick={onClose}
          className="cursor-pointer flex items-center rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {/* Abas */}
        <div className="flex gap-1 border-b border-bd">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`cursor-pointer -mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-acc text-txt"
                  : "border-transparent text-mut hover:text-txt hover:bg-surf2"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "profile" && (
          <>
            {/* Banner */}
            {bannerUrl && (
              <div
                className="w-full h-24 rounded-xl bg-bg border border-bd overflow-hidden relative mb-2"
                style={{ backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
              >
                {editing && (
                  <button
                    type="button"
                    aria-label="Alterar banner"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById("banner-input")?.click();
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 transition-colors group"
                  >
                    <Image size={24} className="text-white" />
                    <span className="mt-2 text-xs text-white font-medium bg-black/60 px-2 py-1 rounded">
                      Alterar banner
                    </span>
                  </button>
                )}
                <input
                  id="banner-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerChange}
                />
              </div>
            )}
            {editing && !bannerUrl && (
              <button
                type="button"
                aria-label="Adicionar banner"
                onClick={() => document.getElementById("banner-input")?.click()}
                className="w-full h-24 rounded-xl bg-surf2 border border-bd/50 flex items-center justify-center cursor-pointer hover:border-acc transition-colors active:scale-95 group"
              >
                <Image size={20} className="text-mut group-hover:text-acc transition-colors" />
                <span className="mt-2 text-xs text-mut group-hover:text-acc transition-colors">
                  Adicionar banner de perfil
                </span>
              </button>
            )}

            {/* Avatar */}
            <div className="flex flex-col items-center mt-4">
              <div
                className="relative"
                aria-label="Avatar do perfil"
              >
                <div
                  className={`w-32 h-32 rounded-full flex items-center justify-center font-display font-bold ${
                    avatarUrl ? "bg-bg" : "bg-acc text-bg"
                  }`}
                  style={avatarUrl
                    ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined}
                >
                  {avatarUrl ? null : initials(displayName || username)}
                  <input
                    id="avatar-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                  {editing && (
                    <button
                      type="button"
                      aria-label="Alterar avatar"
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById("avatar-input")?.click();
                      }}
                      className={`cursor-pointer absolute bottom-1 right-1 w-10 h-10 rounded-full flex items-center justify-center text-sm text-bg shadow-lg hover:bg-acc-press transition-all active:scale-95 ${
                        uploadingAvatar ? "opacity-50 cursor-not-allowed" : "bg-acc"
                      }`}
                    >
                      {uploadingAvatar ? (
                        <span className="text-[10px] animate-spin">⟳</span>
                      ) : (
                        <Pencil size={16} />
                      )}
                    </button>
                  )}
                </div>
                <p className="mt-4 font-display text-2xl font-bold text-txt">
                  {displayName || username}
                </p>
                {nickname && (
                  <p className="text-sm text-acc font-medium">
                    @{nickname}
                  </p>
                )}
                {!nickname && (
                  <p className="text-sm text-mut">{username}</p>
                )}
                {role && (
                  <p className="mt-1 text-xs text-acc bg-acc/10 px-2 py-0.5 rounded-full border border-acc/30">
                    {role}
                  </p>
                )}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                Biografia
              </label>
              {editing ? (
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  rows={4}
                  className="w-full bg-bg border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none resize-none transition-colors"
                  placeholder="Conte um pouco sobre você…"
                />
              ) : (
                <p className="text-sm text-txt leading-relaxed">
                  {bio || "Sem biografia ainda."}
                </p>
              )}
            </div>

            {/* Nickname + cargo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                  Apelido (nickname)
                </label>
                {editing ? (
                  <input
                    value={draftNickname}
                    onChange={(e) => setDraftNickname(e.target.value)}
                    className="w-full bg-bg border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none transition-colors"
                    placeholder="Seu apelido"
                  />
                ) : (
                  <p className="text-sm text-txt">{nickname || "—"}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                  Cargo
                </label>
                {editing ? (
                  <input
                    value={draftRole}
                    onChange={(e) => setDraftRole(e.target.value)}
                    className="w-full bg-bg border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none transition-colors"
                    placeholder="Seu cargo"
                  />
                ) : (
                  <p className="text-sm text-txt">{role || "—"}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                  Entrou em
                </label>
                <p className="text-sm text-txt">{joinedAt || "—"}</p>
              </div>
            </div>

            {/* Links sociais */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                  Ligações sociais
                </label>
                {editing && (
                  <button
                    type="button"
                    onClick={handleAddLink}
                    className="flex items-center gap-1.5 text-xs text-acc hover:text-acc-press underline underline-offset-4 transition-colors"
                  >
                    <span className="text-[10px]">+</span> Adicionar ligação
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {draftLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 bg-bg border border-bd rounded-lg p-2.5">
                    {editing ? (
                      <>
                        <input
                          value={link.label}
                          onChange={(e) => handleLinkChange(i, "label", e.target.value)}
                          placeholder="Nome da ligação"
                          className="flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-mut transition-colors"
                        />
                        <input
                          value={link.url}
                          onChange={(e) => handleLinkChange(i, "url", e.target.value)}
                          placeholder="https://"
                          className="flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-mut transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(i)}
                          className="cursor-pointer p-1.5 text-err hover:bg-err/10 rounded transition-colors active:scale-95"
                          aria-label="Remover ligação"
                        >
                          <X size={14} weight="bold" />
                        </button>
                      </>
                    ) : (
                      link.url && (
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-sm text-acc hover:text-acc-press transition-colors"
                        >
                          <Link size={14} />
                          <span className="truncate">{link.label || link.url}</span>
                        </a>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>

            {editing && (
              <div className="pt-6 space-y-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={uploadingAvatar || uploadingBanner}
                  className={`cursor-pointer w-full ${uploadingAvatar || uploadingBanner ? "opacity-50 cursor-not-allowed" : "bg-acc text-bg font-display font-semibold py-3.5 rounded-xl hover:bg-acc-press transition-all active:scale-95 shadow-lg shadow-acc/20"}`}
                >
                  {uploadingAvatar || uploadingBanner ? "Atualizando…" : "Salvar alterações"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(displayName);
                    setDraftNickname(nickname ?? "");
                    setDraftBio(bio ?? "");
                    setDraftRole(role ?? "");
                    setDraftLinks([...links]);
                    setEditing(false);
                  }}
                  className="cursor-pointer w-full bg-transparent border border-bd text-mut font-display py-3.5 rounded-xl hover:bg-surf2 transition-colors active:scale-95"
                >
                  Cancelar
                </button>
              </div>
            )}
            {!editing && (
              <button
                type="button"
                onClick={() => {
                  setDraftName(displayName);
                  setDraftNickname(nickname ?? "");
                  setDraftBio(bio ?? "");
                  setDraftRole(role ?? "");
                  setDraftLinks([...links]);
                  setEditing(true);
                }}
                className="cursor-pointer w-full bg-transparent border border-bd text-mut py-3.5 rounded-xl hover:bg-surf2 hover:text-txt transition-colors active:scale-95 text-sm font-medium"
              >
                <Pencil size={16} className="mr-2" />
                Editar perfil
              </button>
            )}
          </>
        )}

        {tab === "badges" && (
          <div className="flex flex-col items-center gap-4 py-4">
            <p className="text-xs text-mut">Conquistas e badges do perfil</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "Membro", color: "text-acc" },
                { label: "Iniciante", color: "text-mut" },
                { label: "Verificado", color: "text-acc" },
                { label: "Bot", color: "text-err" },
              ].map((badge, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surf2 border border-bd/50 hover:border-acc/50 transition-colors group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badge.color} bg-bg/50`}>
                    <ShieldCheck size={16} />
                  </div>
                  <span className="text-xs text-txt">{badge.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-mut mt-2">
              Sem badges adicionais ainda.
            </p>
          </div>
        )}

        {tab === "connections" && (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-mut">Conecte suas contas externas</p>
            <div className="space-y-3">
              {[
                { name: "Google", icon: <ShieldCheck size={16} className="text-acc" />, connected: true },
                { name: "GitHub", icon: <Users size={16} className="text-mut" />, connected: false },
                { name: "Twitch", icon: <Gift size={16} className="text-mut" />, connected: false },
              ].map((conn, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg border border-bd bg-bg transition-colors hover:bg-surf2`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                      {conn.icon}
                    </div>
                    <div className="text-sm text-txt">{conn.name}</div>
                  </div>
                  {conn.connected ? (
                    <span className="text-xs text-acc bg-acc/10 px-2 py-0.5 rounded border border-acc/20">
                      Conectado
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="cursor-pointer text-xs text-acc hover:text-acc-press underline underline-offset-4 transition-colors active:scale-95"
                    >
                      Conectar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
