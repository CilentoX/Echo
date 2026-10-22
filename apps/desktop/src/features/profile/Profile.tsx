import { useState } from "react";
import { Pencil, Link, ShieldCheck, Users, Gift } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";

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
    avatarUrl,
    bio,
    role,
    joinedAt,
    links,
    setDisplayName,
    setBio,
    setRole,
    setLinks,
  } = useProfileStore();

  const [tab, setTab] = useState<string>("profile");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [draftRole, setDraftRole] = useState(role ?? "");
  const [draftLinks, setDraftLinks] = useState([...links]);

  const initials = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const handleSave = () => {
    setDisplayName(draftName);
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

  if (!open) return null;

  const TABS: Array<[string, string]> = [
    ["profile", "Perfil"],
    ["badges", "Conquistas"],
    ["connections", "Ligações"],
  ];

  return (
    <aside
      data-column="profile"
      aria-label="Perfil"
      className="fixed inset-y-0 right-0 z-50 w-[460px] bg-surf border-l border-bd flex flex-col animate-[fadeIn_0.3s_ease-out]"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-bd px-5 py-4 bg-surf/50 backdrop-blur">
        <h2 className="font-display text-lg font-semibold text-txt">Perfil</h2>
        <button
          type="button"
          aria-label="Fechar perfil"
          onClick={onClose}
          className="flex items-center rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors"
        >
          <span aria-hidden>✕</span>
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
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
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
            {/* Avatar */}
            <div className="flex flex-col items-center">
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
                </div>
                {editing && (
                  <button
                    type="button"
                    aria-label="Alterar avatar"
                    className="absolute bottom-1 right-1 w-10 h-10 rounded-full bg-acc flex items-center justify-center text-sm text-bg shadow-lg hover:bg-acc-press transition-all active:scale-95"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              <p className="mt-4 font-display text-2xl font-bold text-txt">
                {displayName || username}
              </p>
              <p className="text-sm text-mut">{username}</p>
              {role && (
                <p className="mt-1 text-xs text-acc bg-acc/10 px-2 py-0.5 rounded-full border border-acc/30">
                  {role}
                </p>
              )}
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

            {/* Cargo + entrada */}
            <div className="grid grid-cols-2 gap-4">
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
                          className="p-1.5 text-err hover:bg-err/10 rounded transition-colors"
                          aria-label="Remover ligação"
                        >
                          <span aria-hidden>✕</span>
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
                  className="w-full bg-acc text-bg font-display font-semibold py-3.5 rounded-xl hover:bg-acc-press transition-all active:scale-95 shadow-lg shadow-acc/20"
                >
                  Salvar alterações
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(displayName);
                    setDraftBio(bio ?? "");
                    setDraftRole(role ?? "");
                    setDraftLinks([...links]);
                    setEditing(false);
                  }}
                  className="w-full bg-transparent border border-bd text-mut font-display py-3.5 rounded-xl hover:bg-surf2 transition-colors active:scale-95"
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
                  setDraftBio(bio ?? "");
                  setDraftRole(role ?? "");
                  setDraftLinks([...links]);
                  setEditing(true);
                }}
                className="w-full bg-transparent border border-bd text-mut py-3.5 rounded-xl hover:bg-surf2 hover:text-txt transition-colors active:scale-95 text-sm font-medium"
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
                      className="text-xs text-acc hover:text-acc-press underline underline-offset-4 transition-colors"
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
