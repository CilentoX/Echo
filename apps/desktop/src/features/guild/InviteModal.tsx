import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { matrixService } from "@/lib/matrix/instance";
import { Check, Copy, Link as LinkIcon, Users, Clock } from "@phosphor-icons/react";

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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md bg-surf border border-bd text-txt p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-display font-bold text-txt flex items-center gap-2">
            <LinkIcon size={20} className="text-acc" />
            Convidar amigos para {guildName}
          </DialogTitle>
          <DialogDescription className="text-xs text-mut">
            Envie este link para permitir que outras pessoas entrem na sua guilda no Echo.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {/* Link Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-mut uppercase tracking-wider">
              Link de Convite
            </label>
            <div className="flex items-center gap-2 rounded-xl bg-surf2 border border-bd p-2">
              <input
                type="text"
                readOnly
                value={loading ? "Gerando convite..." : inviteUrl || inviteCode}
                className="w-full bg-transparent text-sm text-txt outline-none px-1 select-all"
                placeholder="Gerando link..."
              />
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                disabled={loading || (!inviteUrl && !inviteCode)}
                className={`shrink-0 transition-all ${
                  copied
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                    : "bg-acc hover:bg-acc-press text-bg"
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} className="mr-1" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
            {error && <p className="text-xs text-err">{error}</p>}
          </div>

          {/* Opções de Expiração e Usos */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-bd/60">
            <div className="space-y-1">
              <label className="text-xs text-mut flex items-center gap-1">
                <Clock size={12} />
                Expira em
              </label>
              <select
                value={expiresInHours ?? "never"}
                onChange={(e) =>
                  setExpiresInHours(
                    e.target.value === "never" ? undefined : Number(e.target.value)
                  )
                }
                className="w-full text-xs bg-surf2 border border-bd rounded-lg p-2 text-txt outline-none focus:border-acc"
              >
                <option value={24}>24 horas</option>
                <option value={168}>7 dias</option>
                <option value={720}>30 dias</option>
                <option value="never">Nunca expira</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-mut flex items-center gap-1">
                <Users size={12} />
                Limite de usos
              </label>
              <select
                value={maxUses ?? "none"}
                onChange={(e) =>
                  setMaxUses(
                    e.target.value === "none" ? undefined : Number(e.target.value)
                  )
                }
                className="w-full text-xs bg-surf2 border border-bd rounded-lg p-2 text-txt outline-none focus:border-acc"
              >
                <option value="none">Ilimitado</option>
                <option value={1}>1 uso</option>
                <option value={5}>5 usos</option>
                <option value={10}>10 usos</option>
                <option value={25}>25 usos</option>
                <option value={50}>50 usos</option>
              </select>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

