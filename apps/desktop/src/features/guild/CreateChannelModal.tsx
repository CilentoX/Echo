import { useEffect, useState } from "react";
import { Hash, X } from "@phosphor-icons/react";

export interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  guildId: string;
  onCreate: (
    data: { name: string; type: string; topic?: string; category?: string }
  ) => Promise<{ channelId: string; name: string }>;
  onCreated: (channel: { channelId: string; name: string }) => void;
}

const CHANNEL_TYPES: Array<{ value: string; label: string }> = [
  { value: "text", label: "Canal de texto" },
  { value: "voice", label: "Canal de voz" },
];

export default function CreateChannelModal({
  open,
  onClose,
  guildId,
  onCreate,
  onCreated,
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, "-");
    if (!trimmed) {
      setError("Dê um nome para o canal.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const channel = await onCreate({
        name: trimmed,
        type,
        topic: topic.trim() || undefined,
        category: category.trim() || undefined,
      });
      setName("");
      setTopic("");
      setCategory("");
      onCreated(channel);
      onClose();
    } catch {
      setError("Não foi possível criar o canal. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Criar canal"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[420px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between gap-2">
          <span className="flex items-center rounded bg-acc/10 px-2 py-1 text-xs text-acc">
            <Hash size={14} aria-hidden /> #{guildId.slice(0, 8)}
          </span>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <X size={18} />
          </button>
        </header>

        <h3 className="font-display text-lg font-semibold text-txt mb-1">
          Criar canal
        </h3>
        <p className="text-xs text-mut mb-4">
          O canal será visível para todos os membros desta guilda.
        </p>

        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Nome do canal
        </label>
        <div className="relative mb-4">
          <span className="absolute left-3 top-3 text-mut">#</span>
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
            placeholder="geral"
            autoFocus
            className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
          />
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-err">
            {error}
          </p>
        )}

        <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Tipo
        </label>
        <div className="flex gap-2 mb-4">
          {CHANNEL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={type === t.value}
              onClick={() => setType(t.value)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                type === t.value
                  ? "border-acc bg-acc/10 text-acc"
                  : "border-bd text-mut hover:border-acc hover:text-txt"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Tópico / descrição
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (error) setError(null);
          }}
          placeholder="O que se discute neste canal"
          className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
        />

        <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Categoria
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Ex: Geral, Voz, Projetos"
          className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
        />

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
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="flex-1 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press disabled:cursor-not-allowed disabled:opacity-60 active:scale-95"
          >
            {loading ? "Criando…" : "Criar canal"}
          </button>
        </div>
      </div>
    </div>
  );
}
