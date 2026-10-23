import { useEffect, useState } from "react";
import { Trash, X } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";

export interface EditGuildModalProps {
  open: boolean;
  onClose: () => void;
  guild: { guildId: string; name: string };
  /** Salva as alterações na guilda. */
  onSave: (updates: { name: string }) => Promise<void>;
}

/**
 * Modal de edição de guilda: renomear a guilda própria.
 */
export default function EditGuildModal({ open, onClose, guild, onSave }: EditGuildModalProps) {
  const [name, setName] = useState(guild.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Re-sync do input quando a guilda muda (ex: renomeada de outro lugar)
  useEffect(() => {
    setName(guild.name);
  }, [guild.name]);

  // Fecha o modal ao pressionar Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setActiveGuild = useUiStore((state) => state.setActiveGuild);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const setGuilds = useSyncStore((state) => state.setGuilds);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === guild.name) {
      onClose();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSave({ name: trimmed });
      onClose();
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Tem certeza que deseja excluir a guilda "${guild.name}"?`)) return;
    setDeleting(true);
    setError(null);
    try {
      await matrixService.deleteGuild(guild.guildId);
      // Remove da store e desliga a seleção se era a ativa
      const current = useSyncStore.getState().guilds;
      setGuilds(current.filter((g) => g.guildId !== guild.guildId));
      const ui = useUiStore.getState();
      if (ui.activeGuildId === guild.guildId) {
        setActiveGuild(null);
        setActiveChannel(null);
      }
      onClose();
    } catch {
      setError("Não foi possível excluir a guilda. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Editar guilda"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[380px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-txt">Editar guilda</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

        <p className="text-xs text-mut mb-4">Altere o nome da sua guilda. Membros verão o novo nome.</p>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Nome da guilda
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) void handleSave();
          }}
          autoFocus
          className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-acc"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm text-err">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex-1 rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-mut hover:bg-surf2 transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading}
            className="cursor-pointer flex-1 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="cursor-pointer mt-4 w-full rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-err hover:bg-err/10 transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "Excluindo…" : <Trash size={14} className="mr-2" />} Excluir guilda
        </button>
      </div>
    </div>
  );
}
