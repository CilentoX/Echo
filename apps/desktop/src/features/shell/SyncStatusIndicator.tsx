import type { SyncStatus } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";

const LABELS: Record<SyncStatus, string> = {
  connecting: "Conectando…",
  syncing: "Online",
  error: "Reconectando…",
};

/** Pílula de estado do sync loop (oculta visualmente para não poluir a tela, preservada para acessibilidade e testes). */
export default function SyncStatusIndicator() {
  const status = useSyncStore((s) => s.status);

  return (
    <div
      role="status"
      aria-live="polite"
      data-status={status}
      className="sr-only"
    >
      {LABELS[status]}
    </div>
  );
}
