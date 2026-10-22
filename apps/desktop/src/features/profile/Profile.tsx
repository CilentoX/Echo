import { useState } from "react";
import { Pencil, Link } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";

export interface ProfileProps {
  /** Quando verdadeiro, a sheet fica aberta. Controlada pelo pai. */
  open: boolean;
  onClose: () => void;
}

/**
 * Sheet de perfil do usuário logado.
 * Exibe avatar, nome, username, bio, cargo, data de entrada e links sociais.
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

  return (
    <aside
      data-column="profile"
      aria-label="Perfil"
      className="fixed inset-y-0 right-0 z-50 w-[420px] bg-surf border-l border-bd flex flex-col"
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
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div
            className="relative"
            aria-label="Avatar do perfil"
          >
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center font-display font-bold ${
                avatarUrl
                  ? "bg-bg"
                  : "bg-acc text-bg"
              }`}
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
            >
              {avatarUrl ? null : initials(displayName || username)}
            </div>
            {editing && (
              <button
                type="button"
                aria-label="Alterar avatar"
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-acc flex items-center justify-center text-xs text-bg shadow-md hover:bg-acc-press transition-colors"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          <p className="mt-3 font-display text-xl font-semibold text-txt">
            {displayName || username}
          </p>
          <p className="text-sm text-mut">{username}</p>
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
              rows={3}
              className="w-full bg-bg border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none resize-none"
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
                className="w-full bg-bg border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none"
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
              Links sociais
            </label>
            {editing && (
              <button
                type="button"
                onClick={handleAddLink}
                className="flex items-center gap-1.5 text-xs text-acc hover:text-acc-press underline underline-offset-4"
              >
                <span className="text-[10px]">+</span> Adicionar link
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
                      placeholder="Nome do link"
                      className="flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-mut"
                    />
                    <input
                      value={link.url}
                      onChange={(e) => handleLinkChange(i, "url", e.target.value)}
                      placeholder="https://"
                      className="flex-1 bg-transparent text-sm text-txt outline-none placeholder:text-mut"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(i)}
                      className="p-1 text-err hover:bg-err/10 rounded"
                      aria-label="Remover link"
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
                      className="flex items-center gap-2 text-sm text-acc hover:text-acc-press"
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
          <div className="pt-4">
            <button
              type="button"
              onClick={handleSave}
              className="w-full bg-acc text-bg font-display font-semibold py-3 rounded-lg hover:bg-acc-press transition-colors"
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
              className="w-full mt-2 bg-transparent border border-bd text-mut font-display py-3 rounded-lg hover:bg-surf2 transition-colors"
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
            className="w-full bg-transparent border border-bd text-mut py-3 rounded-lg hover:bg-surf2 hover:text-txt transition-colors text-sm font-medium"
          >
            Editar perfil
          </button>
        )}
      </div>
    </aside>
  );
}