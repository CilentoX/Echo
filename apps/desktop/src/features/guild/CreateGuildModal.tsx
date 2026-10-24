import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { ImageUploadWithCrop } from "@/components/media/ImageUploadWithCrop";
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
        iconUrl = await matrixService.uploadMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await matrixService.uploadMedia(bannerFile);
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
      <DialogContent className="w-[460px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <DialogHeader className="mb-4 flex items-center justify-between">
          <DialogTitle className="font-display text-lg font-semibold text-txt">Criar guilda</DialogTitle>
          <DialogDescription className="sr-only">Criar uma nova comunidade com nome, ícone, banner e descrição.</DialogDescription>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </DialogHeader>

        <ImageUploadWithCrop
          label="Ícone da guilda"
          value={iconPreview}
          placeholder="Ícone da guilda (opcional)"
          onChange={(file) => {
            setIconFile(file);
            const reader = new FileReader();
            reader.onload = () => setIconPreview(reader.result as string);
            reader.readAsDataURL(file);
          }}
          aspect={1}
          cropTitle="Recortar ícone da guilda"
        />

        <Label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
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
          className="w-full rounded-lg border border-bd bg-bg px-3 py-2.5 text-sm text-txt outline-none placeholder:text-mut focus:border-acc"
        />

        <Label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
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
          className="w-full border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none resize-none transition-colors"
        />

        <ImageUploadWithCrop
          label="Banner da guilda"
          value={bannerPreview}
          placeholder="Banner da guilda (opcional)"
          onChange={(file) => {
            setBannerFile(file);
            const reader = new FileReader();
            reader.onload = () => setBannerPreview(reader.result as string);
            reader.readAsDataURL(file);
          }}
          aspect={16 / 9}
          cropTitle="Recortar banner da guilda"
        />

        {error && (
          <p role="alert" className="mt-2 text-sm text-err">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="flex-1"
          >
            {loading ? "Criando…" : "Criar guilda"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
