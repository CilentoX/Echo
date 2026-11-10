import { useState } from "react";
import { Check, X } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";

interface PresenceQuickPopoverProps {
  onClose: () => void;
}

const PRESENCE_OPTIONS: Array<{
  id: "online" | "idle" | "dnd" | "offline";
  label: string;
  description: string;
  color: string;
}> = [
  {
    id: "online",
    label: "Disponível",
    description: "Você aparecerá ativo para todos",
    color: "bg-online",
  },
  {
    id: "idle",
    label: "Ausente",
    description: "Você está temporariamente afastado",
    color: "bg-idle",
  },
  {
    id: "dnd",
    label: "Não Perturbe",
    description: "Silencia notificações sonoras",
    color: "bg-dnd",
  },
  {
    id: "offline",
    label: "Invisível",
    description: "Você parecerá desconectado",
    color: "bg-offline",
  },
];

export default function PresenceQuickPopover({ onClose }: PresenceQuickPopoverProps) {
  const presence = useProfileStore((s) => s.presence ?? "online");
  const setPresence = useProfileStore((s) => s.setPresence);
  const customStatus = useProfileStore((s) => s.customStatus);
  const setCustomStatus = useProfileStore((s) => s.setCustomStatus);

  const [statusText, setStatusText] = useState(customStatus?.text ?? "");
  const [statusEmoji, setStatusEmoji] = useState(customStatus?.emoji ?? "");

  const handleSaveStatus = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = statusText.trim();
    if (trimmed) {
      setCustomStatus({ text: trimmed, emoji: statusEmoji || undefined });
    } else {
      setCustomStatus(null);
    }
    onClose();
  };

  const handleClearStatus = () => {
    setStatusText("");
    setStatusEmoji("");
    setCustomStatus(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Opções de Presença e Status"
      className="w-64 p-2 rounded-2xl border border-white/[0.08] bg-[#12161f]/95 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 z-50 text-txt select-none"
    >
      {/* Opções de Presença */}
      <div className="space-y-0.5 pb-2 border-b border-white/[0.06]">
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-mut/80">
          Status de Presença
        </div>

        {PRESENCE_OPTIONS.map((opt) => {
          const isSelected = presence === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setPresence?.(opt.id);
                onClose();
              }}
              className={`cursor-pointer w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-all ${
                isSelected
                  ? "bg-white/[0.08] text-txt font-semibold"
                  : "text-mut hover:bg-white/[0.04] hover:text-txt"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${opt.color}`} />
                <div className="flex flex-col min-w-0 leading-tight">
                  <span className="text-xs text-txt">{opt.label}</span>
                  <span className="text-[10px] text-mut/70 truncate">{opt.description}</span>
                </div>
              </div>
              {isSelected && <Check size={14} weight="bold" className="text-acc shrink-0 ml-1" />}
            </button>
          );
        })}
      </div>

      {/* Status Personalizado */}
      <form onSubmit={handleSaveStatus} className="pt-2 px-1 space-y-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-mut/80 px-1">
          Status Personalizado
        </div>

        <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs focus-within:border-acc/40 transition-all">
          <input
            type="text"
            placeholder="Emoji"
            value={statusEmoji}
            onChange={(e) => setStatusEmoji(e.target.value.slice(0, 2))}
            className="w-7 bg-transparent text-center text-xs outline-none placeholder:text-mut/40 shrink-0"
            title="Emoji de status"
          />
          <div className="h-3 w-[1px] bg-white/[0.08]" />
          <input
            type="text"
            placeholder="O que está acontecendo?"
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            className="flex-1 bg-transparent text-xs text-txt outline-none placeholder:text-mut/40"
          />
          {statusText && (
            <button
              type="button"
              onClick={handleClearStatus}
              title="Limpar status"
              className="cursor-pointer text-mut hover:text-txt p-0.5 rounded"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-1 text-xs text-mut hover:text-txt hover:bg-white/[0.06] transition-all"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="cursor-pointer flex-1 rounded-xl bg-acc py-1 text-xs font-semibold text-bg shadow-sm shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
