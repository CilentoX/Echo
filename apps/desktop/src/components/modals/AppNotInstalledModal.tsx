"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppLauncherStore } from "@/stores/appLauncherStore";
import {
  Warning,
  Copy,
  Check,
  ArrowSquareOut,
  X,
  Globe,
} from "@phosphor-icons/react";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function AppNotInstalledModal() {
  const isOpen = useAppLauncherStore((s) => s.isOpen);
  const appName = useAppLauncherStore((s) => s.appName);
  const webUrl = useAppLauncherStore((s) => s.webUrl);
  const closeAlert = useAppLauncherStore((s) => s.closeAlert);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!webUrl) return;
    try {
      await navigator.clipboard.writeText(webUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleOpenBrowser = async () => {
    if (!webUrl) return;
    try {
      await openUrl(webUrl);
    } catch {
      window.open(webUrl, "_blank", "noopener,noreferrer");
    }
    closeAlert();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAlert()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-500/10">
              <Warning size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-base font-semibold text-txt">
                Aplicativo não instalado
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80">
                Não foi possível iniciar o {appName || "aplicativo"} localmente
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAlert}
            className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all"
            title="Fechar"
            aria-label="Fechar"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-mut leading-relaxed">
            Parece que você não possui o aplicativo{" "}
            <span className="font-semibold text-txt">{appName || "necessário"}</span>{" "}
            instalado no seu computador. Você pode acessar o conteúdo diretamente pelo navegador através do link oficial:
          </p>

          {/* Caixa da URL */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Globe size={16} className="text-acc shrink-0" />
              <span className="font-mono text-xs text-txt truncate select-all">
                {webUrl}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer shrink-0 rounded-lg p-1.5 text-mut hover:bg-white/[0.08] hover:text-txt active:scale-95 transition-all flex items-center gap-1 text-[11px]"
              title="Copiar link"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-acc" weight="bold" />
                  <span className="text-acc font-semibold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Rodapé com botões de ação */}
        <div className="flex items-center gap-2.5 border-t border-white/[0.06] bg-white/[0.01] px-5 py-3.5">
          <button
            type="button"
            onClick={closeAlert}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-medium text-txt hover:bg-white/[0.08] active:scale-95 transition-all"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={handleOpenBrowser}
            className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-xs font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center justify-center gap-1.5"
          >
            <ArrowSquareOut size={14} weight="bold" />
            <span>Acessar pelo Navegador</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

