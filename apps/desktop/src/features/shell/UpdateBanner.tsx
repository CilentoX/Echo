import { CircleNotch, Download } from "@phosphor-icons/react";
import { restartApp } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";

/**
 * Banner global de atualização (estilo Discord): aparece no topo em qualquer
 * tela enquanto o update baixa e depois oferece o botão "Reiniciar agora".
 * Também mostra um indicador sutil enquanto verifica no boot.
 */
export default function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);

  if (status === "idle") return null;

  const isChecking = status === "checking";
  const isDownloading = status === "downloading";
  const isReady = status === "ready";

  const label = isChecking
    ? "Verificando atualizações…"
    : isDownloading
      ? `Baixando atualização${version ? ` v${version}` : ""}…`
      : `Atualização pronta${version ? ` (v${version})` : ""} — reinicie para aplicar`;

  return (
    <div
      data-update-banner
      role="status"
      aria-live="polite"
      className={`flex items-center justify-between gap-3 px-4 py-2 font-ui text-sm transition-all duration-300 ${isReady
          ? "border-b border-acc bg-acc/10 text-acc"
          : "border-b border-mut bg-mut/30 text-mut"
        }`}
    >
      <div className="flex items-center gap-2">
        {isChecking || isDownloading ? (
          <CircleNotch className="animate-spin text-acc" size={16} />
        ) : (
          <Download size={16} />
        )}
        <span className="truncate">{label}</span>
      </div>
      {isReady && (
        <button
          type="button"
          onClick={() => void restartApp()}
          className="shrink-0 rounded bg-acc px-3 py-1 font-ui text-xs font-semibold text-bg transition-colors duration-200 hover:bg-acc-press active:scale-95"
        >
          Reiniciar agora
        </button>
      )}
    </div>
  );
}
