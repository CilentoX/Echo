import { File, Image, X } from "@phosphor-icons/react";

export interface MediaPreviewProps {
  name: string;
  /** `image` mostra um thumbnail CSS-only; `file` mostra ícone genérico. */
  kind: "image" | "file";
  onRemove: () => void;
}

/**
 * Prévia de anexo antes do envio. Mock visual (CSS-only): o upload real
 * para o homeserver chega em fase posterior.
 */
export default function MediaPreview({ name, kind, onRemove }: MediaPreviewProps) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-lg border border-bd bg-surf p-2">
      {kind === "image" ? (
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-gradient-to-br from-surf2 to-rail text-mut"
        >
          <Image size={22} weight="duotone" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-surf2 text-mut"
        >
          <File size={22} weight="duotone" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-txt">{name}</p>
        <p className="text-xs text-mut">
          {kind === "image" ? "Imagem anexada" : "Arquivo anexado"}
        </p>
      </div>
      <button
        type="button"
        aria-label="Remover anexo"
        onClick={onRemove}
        className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
      >
        <X size={16} />
      </button>
    </div>
  );
}
