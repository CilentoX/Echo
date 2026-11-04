import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { matrixService } from "@/lib/matrix/instance";
import { Check, Copy, Link as LinkIcon, Users, Clock, X, WarningCircle } from "@phosphor-icons/react";

export interface InviteModalProps {
  open: boolean;
  guildId: string;
  guildName: string;
  onClose: () => void;
}

export default function InviteModal({
  open,
  guildId,
  guildName,
  onClose,
}: InviteModalProps) {
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState<number | undefined>(168); // 7 dias
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const generateInvite = async () => {
    if (!guildId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await matrixService.createGuildInvite(guildId, {
        expiresInHours: expiresInHours || undefined,
        maxUses: maxUses || undefined,
      });
      setInviteUrl(res.url);
      setInviteCode(res.code);
    } catch (err: any) {
      setError(err?.message || "Não foi possível gerar o convite");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && guildId) {
      generateInvite();
    } else {
      setInviteUrl("");
      setInviteCode("");
      setCopied(false);
      setError(null);
    }
  }, [open, guildId, expiresInHours, maxUses]);

  const handleCopy = async () => {
    if (!inviteUrl && !inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteUrl || inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Falha ao copiar
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
      >
        {/* Header Superior Padrão Guild Modal */}
        <div className="relative p-6 pb-4 border-b border-white/[0.04] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
              <LinkIcon size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">
                Convidar amigos para {guildName}
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Compartilhe o link de convite para permitir que outras pessoas entrem na guilda.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Link Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-mut">
              Link de Convite
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1.5 pl-3 transition-all focus-within:border-acc/50 focus-within:ring-1 focus-within:ring-acc/30 hover:border-white/[0.15]">
              <input
                type="text"
                readOnly
                value={loading ? "Gerando link de convite..." : inviteUrl || inviteCode}
                className="w-full bg-transparent text-sm text-txt outline-none select-all placeholder:text-mut/50"
                placeholder="Gerando link..."
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={loading || (!inviteUrl && !inviteCode)}
                className={`cursor-pointer shrink-0 rounded-xl px-4 py-2 text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                  copied
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                    : "bg-acc text-bg shadow-md shadow-acc/20 hover:bg-acc-press"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {copied ? (
                  <>
                    <Check size={14} weight="bold" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} weight="bold" />
                    Copiar
                  </>
                )}
              </button>
            </div>
            {error && (
              <p className="text-xs text-err flex items-center gap-1.5 mt-2">
                <WarningCircle size={14} weight="bold" />
                {error}
              </p>
            )}
          </div>

          {/* Opções de Expiração e Usos */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/[0.04]">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-mut flex items-center gap-1.5">
                <Clock size={14} weight="bold" className="text-acc" />
                Expira em
              </label>
              <select
                value={expiresInHours ?? "never"}
                onChange={(e) =>
                  setExpiresInHours(
                    e.target.value === "never" ? undefined : Number(e.target.value)
                  )
                }
                className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-txt outline-none hover:border-white/[0.15] focus:border-acc/50 focus:ring-1 focus:ring-acc/30 transition-all"
              >
                <option value={24} className="bg-[#12161f] text-txt">24 horas</option>
                <option value={168} className="bg-[#12161f] text-txt">7 dias</option>
                <option value={720} className="bg-[#12161f] text-txt">30 dias</option>
                <option value="never" className="bg-[#12161f] text-txt">Nunca expira</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-mut flex items-center gap-1.5">
                <Users size={14} weight="bold" className="text-acc" />
                Limite de usos
              </label>
              <select
                value={maxUses ?? "none"}
                onChange={(e) =>
                  setMaxUses(
                    e.target.value === "none" ? undefined : Number(e.target.value)
                  )
                }
                className="w-full cursor-pointer rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-txt outline-none hover:border-white/[0.15] focus:border-acc/50 focus:ring-1 focus:ring-acc/30 transition-all"
              >
                <option value="none" className="bg-[#12161f] text-txt">Ilimitado</option>
                <option value={1} className="bg-[#12161f] text-txt">1 uso</option>
                <option value={5} className="bg-[#12161f] text-txt">5 usos</option>
                <option value={10} className="bg-[#12161f] text-txt">10 usos</option>
                <option value={25} className="bg-[#12161f] text-txt">25 usos</option>
                <option value={50} className="bg-[#12161f] text-txt">50 usos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Rodapé Padrão */}
        <div className="p-6 pt-2 border-t border-white/[0.04] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer w-full rounded-xl bg-acc py-2.5 text-sm font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all text-center"
          >
            Concluir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
