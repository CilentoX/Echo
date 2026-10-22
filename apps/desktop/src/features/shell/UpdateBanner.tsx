import { restartApp } from "@/lib/updater";
import { useUpdateStore } from "@/stores/updateStore";

/**
 * Banner global de atualização (estilo Discord): aparece no topo em qualquer
 * tela enquanto o update baixa e depois oferece o botão "Reiniciar agora".
 * Some sozinho no idle.
 */
export default function UpdateBanner() {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);

  if (status === "idle") return null;

  const label =
    status === "downloading"
      ? `Baixando atualização${version ? ` v${version}` : ""}…`
      : `Atualização pronta${version ? ` (v${version})` : ""} — reinicie para aplicar`;

  return (
    <div
      data-update-banner
      role="status"
      className="flex items-center justify-between gap-3 border-b border-acc bg-acc/10 px-4 py-2 font-ui text-sm text-acc"
    >
      <span className="truncate">{label}</span>
      {status === "ready" && (
        <button
          type="button"
          onClick={() => void restartApp()}
          className="shrink-0 rounded bg-acc px-3 py-1 font-ui text-xs font-semibold text-bg transition-colors duration-200 hover:bg-acc-press"
        >
          Reiniciar agora
        </button>
      )}
    </div>
  );
}
