import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Hash, SpeakerHigh, X, WarningCircle } from "@phosphor-icons/react";

export interface CreateChannelModalProps {
  open: boolean;
  onClose: () => void;
  guildId: string;
  onCreate: (
    data: { name: string; type: string; topic?: string; category?: string }
  ) => Promise<{ channelId: string; name: string }>;
  onCreated: (channel: { channelId: string; name: string }) => void;
}

const CHANNEL_TYPES = [
  {
    value: "text",
    label: "Texto",
    description: "Poste mensagens, imagens, arquivos e links.",
    icon: Hash,
  },
  {
    value: "voice",
    label: "Voz & Vídeo",
    description: "Converse em tempo real por voz, vídeo e compartilhamento.",
    icon: SpeakerHigh,
  },
];

export default function CreateChannelModal({
  open,
  onClose,
  guildId: _guildId,
  onCreate,
  onCreated,
}: CreateChannelModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("text");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleClose = () => {
    setName("");
    setTopic("");
    setCategory("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-bd-glass bg-card-bg p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
      >
        {/* Header Superior Padrão Guild Modal */}
        <div className="relative p-6 pb-4 border-b border-bd-subtle flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
              <Hash size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">
                Criar canal
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Crie um novo espaço de comunicação na sua guilda.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
            className="cursor-pointer rounded-xl p-1.5 text-mut dark:hover:bg-white/[0.06] hover:bg-black/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Tipo de Canal */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-mut">
              Tipo de canal
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {CHANNEL_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setType(t.value)}
                    className={`cursor-pointer rounded-xl border p-3 text-left transition-all active:scale-[0.98] flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "border-acc/60 bg-acc/10 text-txt shadow-sm shadow-acc/10"
                        : "border-bd-subtle dark:bg-white/[0.02] bg-surf/40 text-mut hover:border-bd hover:bg-surf hover:text-txt"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 font-display font-semibold text-sm">
                        <Icon size={18} weight="bold" className={isSelected ? "text-acc" : "text-mut"} />
                        <span className={isSelected ? "text-txt" : "text-mut"}>{t.label}</span>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? "border-acc bg-acc" : "border-bd dark:border-white/[0.2] border-black/[0.2]"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-bg" />}
                      </div>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-80">
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nome do Canal */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-mut">
                Nome do canal
              </label>
              <span className="font-mono text-[11px] text-mut">
                {name.length}/100
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-mut font-semibold select-none">
                #
              </span>
              <input
                type="text"
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleSubmit();
                }}
                placeholder="novo-canal"
                autoFocus
                className="w-full rounded-xl border border-bd-subtle dark:bg-white/[0.03] bg-card-bg pl-8 pr-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-card-bg focus:ring-1 focus:ring-acc/30 hover:border-bd transition-all"
              />
            </div>
            {error && (
              <p role="alert" className="text-xs text-err flex items-center gap-1.5 mt-2">
                <WarningCircle size={14} weight="bold" />
                {error}
              </p>
            )}
          </div>

          {/* Categoria Opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-mut">
              Categoria <span className="normal-case font-normal text-mut/60">(opcional)</span>
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Ex: Geral, Voz, Projetos"
              className="w-full rounded-xl border border-bd-subtle dark:bg-white/[0.03] bg-card-bg px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-card-bg focus:ring-1 focus:ring-acc/30 hover:border-bd transition-all"
            />
          </div>

          {/* Tópico Opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-mut">
              Tópico / Descrição <span className="normal-case font-normal text-mut/60">(opcional)</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (error) setError(null);
              }}
              placeholder="O que se discute neste canal"
              className="w-full rounded-xl border border-bd-subtle dark:bg-white/[0.03] bg-card-bg px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-card-bg focus:ring-1 focus:ring-acc/30 hover:border-bd transition-all"
            />
          </div>
        </div>

        {/* Rodapé Padrão */}
        <div className="p-6 pt-2 border-t border-bd-subtle flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer flex-1 rounded-xl border border-bd-subtle dark:bg-white/[0.03] bg-surf/50 py-2.5 text-sm font-medium text-txt hover:bg-surf hover:border-bd active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading || !name.trim()}
            className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-sm font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Criando…" : "Criar canal"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
