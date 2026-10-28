import { useState } from "react";
import { X, Plus } from "@phosphor-icons/react";
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit";
import { uploadImage } from "@/lib/appwrite/storage";
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
  ) => Promise<{ guildId: string; name: string }>;
  onCreated: (guild: { guildId: string; name: string }) => void;
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
        iconUrl = await uploadImage(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile);
      }

      const guild = await onCreate({
        name: trimmed,
        iconUrl,
        bannerUrl,
        description: description || undefined,
      });
      setName("");
      setDescription("");
      setIconFile(null);
      setIconPreview(null);
      setBannerFile(null);
      setBannerPreview(null);
      onCreated(guild);
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
            <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
              Ícone da guilda
            </Label>
            <ImageUploadWithEdit
              label=""
              value={iconPreview}
              placeholder="Ícone da guilda (opcional)"
              onChange={(file) => {
                setIconFile(file);
                setIconPreview(URL.createObjectURL(file));
              }}
              aspect={1}
              previewHeight="h-32"
              editTitle="Recortar ícone da guilda"
            />
          </div>

          <div className="space-y-2">
            <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
              Nome da guilda
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) void handleSubmit();
              }}
              placeholder="Ex: Minha comunidade"
              autoFocus
              className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc focus:ring-2 focus:ring-acc/40"
            />
          </div>

          <div className="space-y-2">
            <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
              Descrição
            </Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              rows={3}
              placeholder="Descreva sua guilda…"
              className="w-full border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/40 resize-none transition-colors"
            />
          </div>

          <div className="space-y-2">
            <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
              Banner da guilda
            </Label>
            <ImageUploadWithEdit
              label=""
              value={bannerPreview}
              placeholder="Banner da guilda (opcional)"
              onChange={(file) => {
                setBannerFile(file);
                setBannerPreview(URL.createObjectURL(file));
              }}
              aspect={16 / 9}
              previewHeight="h-24"
              editTitle="Recortar banner da guilda"
            />
          </div>

          {error && (
            <p role="alert" className="mt-2 text-sm text-err">
              {error}
            </p>
          )}

          <div className="mt-8 flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border border-bd bg-bg text-txt hover:bg-surf2 hover:border-acc active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={loading}
              className="flex-1 bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? "Criando…" : "Criar guilda"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
