import { useState } from "react";
import { Pencil, X } from "@phosphor-icons/react";

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

  if (!open) return null;

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

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm"
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
            className="rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
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
            className="flex-1 rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-mut hover:bg-surf2 transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading}
            className="flex-1 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-err hover:bg-err/10 transition-colors active:scale-95"
        >
          <Pencil size={14} className="mr-2" />
          Deletar guilda
        </button>
      </div>
    </div>
  );
}
