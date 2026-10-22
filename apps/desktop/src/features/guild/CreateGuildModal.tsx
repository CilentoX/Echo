import { useState } from "react";
import { X } from "@phosphor-icons/react";

export interface CreateGuildModalProps {
  open: boolean;
  onClose: () => void;
  /** Cria a guilda no servidor e devolve o resumo. */
  onCreate: (name: string) => Promise<{ guildId: string; name: string }>;
  /** Callback pós-criação: recebe o resumo para adicionar ao store e selecionar. */
  onCreated: (guild: { guildId: string; name: string }) => void;
}

/**
 * Modal de criação de guilda: input de nome + botão criar.
 * Erro aparece inline (role="alert"); loading desativa o botão.
 */
export default function CreateGuildModal({ open, onClose, onCreate, onCreated }: CreateGuildModalProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a guilda.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const guild = await onCreate(trimmed);
      setName("");
      onCreated(guild);
      onClose();
    } catch {
      setError("Não foi possível criar a guilda. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Criar guilda"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[380px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-txt">Criar guilda</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

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
            if (e.key === "Enter" && !loading) void handleSubmit();
          }}
          placeholder="Ex: Minha comunidade"
          autoFocus
          className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm text-err">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={loading}
          className="cursor-pointer mt-5 w-full rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Criando…" : "Criar guilda"}
        </button>
      </div>
    </div>
  );
}