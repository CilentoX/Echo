import { Toaster as SonnerToaster } from "sonner";

/**
 * Provedor de Toasts do Echo baseado no Sonner.
 * Implementa a estética Dark Glassmorphism proprietária do Echo:
 * Fundo #12161f com borda sutil, cantos arredondados rounded-2xl e acento #0FB9A8.
 */
export function EchoToaster() {
  return (
    <SonnerToaster
      position="top-right"
      expand={true}
      richColors={false}
      closeButton={true}
      toastOptions={{
        duration: 4000,
        style: {
          background: "#12161f",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          color: "#E9EDF2",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
          padding: "12px 16px",
          fontSize: "13px",
          backdropFilter: "blur(12px)",
        },
        classNames: {
          toast: "group select-none font-sans",
          title: "font-semibold text-txt text-[13px] leading-tight",
          description: "text-mut text-xs mt-0.5 leading-snug",
          closeButton: "border border-white/[0.08] bg-white/[0.04] text-mut hover:text-txt hover:bg-white/[0.08] transition-all rounded-lg",
          actionButton: "bg-acc text-bg font-semibold text-xs rounded-xl px-3 py-1.5 hover:bg-acc-press transition-all",
          cancelButton: "border border-white/[0.08] bg-white/[0.04] text-txt font-medium text-xs rounded-xl px-3 py-1.5",
        },
      }}
    />
  );
}
export { toast } from "sonner";
