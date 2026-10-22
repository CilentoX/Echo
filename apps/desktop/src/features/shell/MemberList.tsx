import { X } from "@phosphor-icons/react";

export interface MemberListProps {
  /** `overlay` floats above the chat below 1150px; `static` is the docked column. */
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/**
 * Member list: the rightmost 224px column.
 * Fase 1: vazia até o sync carregar os membros reais (presença/directory
 * chegam na Fase 2) — sem membros falsos hardcodados.
 */
export default function MemberList({
  variant = "static",
  onClose,
}: MemberListProps) {
  const overlay = variant === "overlay";

  return (
    <aside
      data-column="members"
      aria-label="Membros"
      className={`flex w-[224px] shrink-0 flex-col border-l border-bd bg-rail ${
        overlay
          ? "fixed inset-y-0 right-0 z-20 shadow-lg shadow-black/60"
          : "h-full"
      }`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-bd px-4">
        <h2 className="font-display text-sm font-semibold text-txt">Membros</h2>
        {overlay && (
          <button
            type="button"
            aria-label="Fechar membros"
            onClick={onClose}
            className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <ul className="flex-1 overflow-y-auto px-2 py-3">
        <li className="px-2 py-1.5 text-xs text-mut">
          Os membros aparecem aqui quando o canal carrega.
        </li>
      </ul>
    </aside>
  );
}
