import { useState } from "react";
import { X, Plus } from "@phosphor-icons/react";
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit";
import { useEchoApi } from "@/lib/api/echoApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CreateGuildModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => Promise<{ guildId: string; name: string; avatarUrl?: string | null }>;
  onCreated: (guild: { guildId: string; name: string; avatarUrl?: string | null }) => void;
}

export default function CreateGuildModal({ open, onClose, onCreate, onCreated }: CreateGuildModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const echoApi = useEchoApi();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a guilda.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let iconUrl: string | null = null;
      let bannerUrl: string | null = null;

      if (iconFile) {
        iconUrl = await echoApi.uploadChatMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await echoApi.uploadChatMedia(bannerFile);
      }

      const guild = await onCreate({
        name: trimmed,
        iconUrl,
        bannerUrl,
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIconFile(null);
      setIconPreview(null);
      setBannerFile(null);
      setBannerPreview(null);
      onCreated(
        iconUrl || (guild as any).avatarUrl
          ? { ...guild, avatarUrl: (guild as any).avatarUrl ?? iconUrl }
          : guild,
      );
      onClose();
    } catch {
      setError("Não foi possível criar a guilda. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[460px] rounded-xl border border-bd bg-surf p-6 shadow-xl"
      >
        <DialogHeader className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-acc text-bg flex items-center justify-center font-display font-bold text-sm">
              <Plus size={18} />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">Criar guilda</DialogTitle>
              <DialogDescription className="text-xs text-mut">Criar uma nova comunidade com nome, ícone, banner e descrição.</DialogDescription>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                Ícone da guilda
              </Label>
              <span className="text-[11px] text-mut">Proporção 1:1</span>
            </div>
            <ImageUploadWithEdit
              label=""
              value={iconPreview}
              placeholder="Ícone da guilda (opcional)"
              onChange={(file) => {
                setIconFile(file);
                setIconPreview(URL.createObjectURL(file));
              }}
              onRemove={() => {
                setIconFile(null);
                setIconPreview(null);
              }}
              aspect={1}
              previewHeight="h-28"
              editTitle="Recortar ícone da guilda"
              editable={!loading}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                Nome da guilda
              </Label>
              <span className="text-[11px] text-mut">{name.length}/100</span>
            </div>
            <Input
              type="text"
              value={name}
              maxLength={100}
              disabled={loading}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void handleSubmit();
              }}
              placeholder="Ex: Minha comunidade"
              autoFocus
              className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc focus:ring-2 focus:ring-acc/30 hover:border-bd-glass transition-all duration-150"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                Descrição
              </Label>
              <span className="text-[11px] text-mut">{description.length}/280</span>
            </div>
            <Textarea
              value={description}
              maxLength={280}
              disabled={loading}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="Descreva o propósito da sua comunidade…"
              className="w-full border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/30 hover:border-bd-glass resize-none transition-all duration-150"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                Banner da guilda
              </Label>
              <span className="text-[11px] text-mut">Proporção 16:9</span>
            </div>
            <ImageUploadWithEdit
              label=""
              value={bannerPreview}
              placeholder="Banner da guilda (opcional)"
              onChange={(file) => {
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
              }}
              onRemove={() => {
                setBannerFile(null);
                setBannerPreview(null);
              }}
              aspect={16 / 9}
              previewHeight="h-24"
              editTitle="Recortar banner da guilda"
              editable={!loading}
              disabled={loading}
            />
          </div>

          {error && (
            <p role="alert" className="mt-2 text-sm text-err font-medium animate-in fade-in-50 duration-150">
              {error}
            </p>
          )}

          <div className="mt-8 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex-1 border border-bd bg-bg text-txt hover:bg-surf2 hover:border-bd-glass active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="flex-1 bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Criando…</span>
                </>
              ) : (
                "Criar guilda"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
