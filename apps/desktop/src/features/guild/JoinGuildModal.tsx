import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { matrixService } from "@/lib/matrix/instance";
import { Users, Compass, ArrowRight, WarningCircle, X, MagnifyingGlass } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";

export interface JoinGuildModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: (guild: { guildId: string; name: string }) => void;
  onOpenCreate?: () => void;
}

export default function JoinGuildModal({
  open,
  onClose,
  onJoined,
  onOpenCreate,
}: JoinGuildModalProps) {
  const [code, setCode] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    code: string;
    guildId: string;
    name: string;
    description: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    channelsCount: number;
  } | null>(null);

  const handleLookup = async (inputCode?: string) => {
    const raw = (inputCode ?? code).trim();
    if (!raw) return;
    setError(null);
    setLoadingPreview(true);
    setPreview(null);
    try {
      const data = await matrixService.getInvitePreview(raw);
      setPreview(data);
    } catch (err: any) {
      setError(err?.message || "Convite inválido ou expirado");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleJoin = async () => {
    const targetCode = preview?.code || code.trim();
    if (!targetCode) return;
    setError(null);
    setJoining(true);
    try {
      const res = await matrixService.joinGuildViaInvite(targetCode);
      onJoined({
        guildId: res.guildId,
        name: res.name || preview?.name || "Guilda",
      });
      handleClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao entrar na guilda");
    } finally {
      setJoining(false);
    }
  };

  const handleClose = () => {
    setCode("");
    setPreview(null);
    setError(null);
    onClose();
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
      >
        {/* Header Superior Padrão Guild Modal */}
        <div className="relative p-6 pb-4 border-b border-white/[0.04] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
              <Users size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">
                Entrar em uma guilda
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Insira um link ou código de convite para participar.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
            className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-mut">
              Código ou Link de Convite
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Ex: echo.litteris.online/invite/abc123"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLookup();
                }}
                autoFocus
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
              />
              <button
                type="button"
                onClick={() => handleLookup()}
                disabled={loadingPreview || !code.trim()}
                className="cursor-pointer shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-txt hover:bg-white/[0.1] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <MagnifyingGlass size={16} />
                {loadingPreview ? "Buscando..." : "Buscar"}
              </button>
            </div>
            {error && (
              <p className="text-xs text-err flex items-center gap-1.5 mt-2">
                <WarningCircle size={14} weight="bold" />
                {error}
              </p>
            )}
          </div>

          {/* Preview Card */}
          {preview && (
            <div className="p-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] flex items-center gap-4 transition-all shadow-inner">
              <div className="relative shrink-0">
                {preview.avatarUrl ? (
                  <MxcImage
                    mxcUrl={preview.avatarUrl}
                    alt={preview.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-white/[0.08] shadow-md"
                    width={56}
                    height={56}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-base bg-acc text-bg shadow-md shadow-acc/20">
                    <Compass size={24} weight="bold" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-base text-txt truncate">
                  {preview.name}
                </h3>
                {preview.description && (
                  <p className="text-xs text-mut line-clamp-2 mt-0.5">
                    {preview.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-mut">
                  <span className="flex items-center gap-1">
                    <Users size={12} weight="bold" className="text-acc" />
                    {preview.channelsCount} {preview.channelsCount === 1 ? "canal" : "canais"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Padrão */}
        <div className="p-6 pt-2 border-t border-white/[0.04] flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-txt hover:bg-white/[0.08] active:scale-95 transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={preview ? handleJoin : () => handleLookup()}
            disabled={joining || loadingPreview || !code.trim()}
            className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-sm font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {joining ? (
              "Entrando..."
            ) : preview ? (
              <>
                Entrar na guilda
                <ArrowRight size={16} weight="bold" />
              </>
            ) : (
              "Continuar"
            )}
          </button>
        </div>

        {onOpenCreate && (
          <div className="p-4 pt-0 pb-5 text-center border-t border-white/[0.04]">
            <button
              type="button"
              onClick={() => {
                handleClose();
                onOpenCreate();
              }}
              className="cursor-pointer text-xs text-mut hover:text-acc font-medium transition-colors"
            >
              Quer criar seu próprio servidor? <span className="underline font-semibold text-acc">Criar uma guilda</span>
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
