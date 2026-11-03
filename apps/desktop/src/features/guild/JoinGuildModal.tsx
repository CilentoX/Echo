import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { matrixService } from "@/lib/matrix/instance";
import { Users, Compass, ArrowRight, WarningCircle } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";

export interface JoinGuildModalProps {
  open: boolean;
  onClose: () => void;
  onJoined: (guild: { guildId: string; name: string }) => void;
}

export default function JoinGuildModal({
  open,
  onClose,
  onJoined,
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md bg-surf border border-bd text-txt p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-1.5 text-left">
          <DialogTitle className="text-lg font-display font-bold text-txt flex items-center gap-2">
            <Users size={20} className="text-acc" />
            Entrar em uma guilda
          </DialogTitle>
          <DialogDescription className="text-xs text-mut">
            Insira um código de convite ou link para fazer parte de uma comunidade.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-mut uppercase tracking-wider">
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
                className="w-full bg-surf2 border border-bd rounded-xl px-3 py-2 text-sm text-txt outline-none focus:border-acc focus:ring-1 focus:ring-acc"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleLookup()}
                disabled={loadingPreview || !code.trim()}
                className="shrink-0"
              >
                {loadingPreview ? "Buscando..." : "Buscar"}
              </Button>
            </div>
            {error && (
              <p className="text-xs text-err flex items-center gap-1 mt-1">
                <WarningCircle size={14} />
                {error}
              </p>
            )}
          </div>

          {/* Preview Card */}
          {preview && (
            <div className="p-4 rounded-xl border border-bd bg-surf2/60 flex items-center gap-4 transition-all">
              <div className="relative shrink-0">
                {preview.avatarUrl ? (
                  <MxcImage
                    mxcUrl={preview.avatarUrl}
                    alt={preview.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-bd shadow-md"
                    width={56}
                    height={56}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-bold text-base bg-acc text-bg shadow-md">
                    <Compass size={24} />
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
                <div className="flex items-center gap-2 mt-1 text-[11px] text-mut">
                  <span className="flex items-center gap-1">
                    <Users size={12} className="text-acc" />
                    {preview.channelsCount} {preview.channelsCount === 1 ? "canal" : "canais"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-6 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={preview ? handleJoin : () => handleLookup()}
            disabled={joining || loadingPreview || !code.trim()}
            className="bg-acc hover:bg-acc-press text-bg"
          >
            {joining ? (
              "Entrando..."
            ) : preview ? (
              <>
                Entrar na guilda
                <ArrowRight size={16} className="ml-1" />
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

