import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
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

export interface EditGuildModalProps {
  open: boolean;
  onClose: () => void;
  guild: { guildId: string; name: string; avatarUrl?: string | null };
  onSave: (
    updates: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => Promise<void>;
}

export default function EditGuildModal({ open, onClose, guild, onSave }: EditGuildModalProps) {
  const [name, setName] = useState(guild.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(guild.avatarUrl ?? null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    setName(guild.name);
    setIconFile(null);
    setIconPreview(guild.avatarUrl ?? null);
    setBannerFile(null);
    setBannerPreview(null);
  }, [guild.guildId, guild.name, guild.avatarUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setActiveGuild = useUiStore((state) => state.setActiveGuild);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const setGuilds = useSyncStore((state) => state.setGuilds);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a guilda.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let iconUrl: string | undefined;
      let bannerUrl: string | undefined;
      if (iconFile) {
        iconUrl = await matrixService.uploadMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await matrixService.uploadMedia(bannerFile);
      }
      await onSave({
        name: trimmed,
        iconUrl,
        bannerUrl,
        description: description || undefined,
      });
      onClose();
    } catch {
      setError("Não foi possível salvar. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await matrixService.deleteGuild(guild.guildId);
      const current = useSyncStore.getState().guilds;
      setGuilds(current.filter((g) => g.guildId !== guild.guildId));
      const ui = useUiStore.getState();
      if (ui.activeGuildId === guild.guildId) {
        setActiveGuild(null);
        setActiveChannel(null);
      }
      onClose();
    } catch {
      setError("Não foi possível excluir a guilda. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="w-[420px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
          <DialogHeader className="mb-4 flex items-center justify-between">
            <DialogTitle className="font-display text-lg font-semibold text-txt">Editar guilda</DialogTitle>
            <DialogDescription className="sr-only">Editar nome, ícone, banner e descrição da guilda.</DialogDescription>
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
              onClick={() => void handleSave()}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Salvando…" : "Salvar alterações"}
            </Button>
          </div>

          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
            className="mt-4 w-full"
          >
            {deleting ? (
              "Excluindo…"
            ) : (
              <>
                <X size={14} className="mr-2" />
                Excluir guilda
              </>
            )}
          </Button>
        </DialogContent>
      </Dialog>

      {confirmDeleteOpen && (
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent className="rounded-xl border border-bd bg-surf p-6 shadow-xl text-center">
            <DialogHeader>
              <DialogTitle className="font-display text-lg font-semibold text-txt">Excluir guilda</DialogTitle>
              <DialogDescription className="text-mut">
                Tem certeza que deseja excluir a guilda "{guild.name}"? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex gap-2 justify-center">
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1"
              >
                {deleting ? "Excluindo…" : "Excluir"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
