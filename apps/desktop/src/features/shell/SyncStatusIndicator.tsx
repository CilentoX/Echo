import type { SyncStatus } from "@/lib/matrix/types";
import { useSyncStore } from "@/stores/syncStore";

const LABELS: Record<SyncStatus, string> = {
  connecting: "Conectando…",
  syncing: "Online",
  error: "Reconectando…",
};

const CLASSES: Record<SyncStatus, string> = {
  connecting: "text-mut",
  syncing: "text-acc",
  error: "text-err",
};

/** Pílula fixa com o estado do sync loop (Conectando… / Online / Reconectando…). */
export default function SyncStatusIndicator() {
  const status = useSyncStore((s) => s.status);

  return (
    <div
      role="status"
      aria-live="polite"
      data-status={status}
      className={`fixed bottom-3 right-3 z-40 rounded-full border border-bd bg-surf px-3 py-1 text-xs font-medium shadow-lg shadow-black/40 ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </div>
  );
}
