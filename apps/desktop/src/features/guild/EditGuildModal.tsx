import { useState } from "react";
import { X, Trash } from "@phosphor-icons/react";
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
  guild: { guildId: string; name: string; avatarUrl?: string | null; description?: string | null };
  onSave: (
    updates: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => Promise<void>;
}

export default function EditGuildModal({ open, onClose, guild, onSave }: EditGuildModalProps) {
  const initialName = guild.name.trim().charAt(0).toUpperCase() || "G";

  const [name, setName] = useState(guild.name);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(guild.avatarUrl ?? null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [description, setDescription] = useState(guild.description ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

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
        <DialogContent
          showCloseButton={false}
          className="w-full max-w-[420px] rounded-xl border border-bd bg-surf p-6 shadow-xl"
        >
          <DialogHeader className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-acc text-bg flex items-center justify-center font-display font-bold text-sm">
                {initialName}
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-semibold text-txt">Editar guilda</DialogTitle>
                <DialogDescription className="text-xs text-mut">Editar nome, ícone, banner e descrição da guilda.</DialogDescription>
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

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                Ícone da guilda
              </Label>
              <div className="relative w-full h-32 rounded-xl bg-surf2 border border-bd overflow-hidden">
                <ImageUploadWithCrop
                  label=""
                  value={iconPreview}
                  placeholder="Ícone da guilda (opcional)"
                  onChange={(file) => {
                    setIconFile(file);
                    setIconPreview(URL.createObjectURL(file));
                  }}
                  aspect={1}
                  cropTitle="Recortar ícone da guilda"
                />
              </div>
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
              <div className="relative w-full h-24 rounded-xl bg-surf2 border border-bd overflow-hidden">
                <ImageUploadWithCrop
                  label=""
                  value={bannerPreview}
                  placeholder="Banner da guilda (opcional)"
                  onChange={(file) => {
                    setBannerFile(file);
                    setBannerPreview(URL.createObjectURL(file));
                  }}
                  aspect={16 / 9}
                  cropTitle="Recortar banner da guilda"
                />
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-2 text-sm text-err">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1 border border-bd bg-bg text-txt hover:bg-surf2 hover:border-acc active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={loading}
                className="flex-1 bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? "Salvando…" : "Salvar alterações"}
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
              className="mt-4 w-full border border-bd/50 text-err hover:bg-err/10 hover:border-err/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              {deleting ? (
                "Excluindo…"
              ) : (
                <>
                  <Trash size={14} className="mr-2" />
                  Excluir guilda
                </>
              )}
            </Button>
          </div>
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
              <Button type="button" variant="outline" onClick={() => setConfirmDeleteOpen(false)} className="flex-1 border border-bd bg-bg text-txt hover:bg-surf2 hover:border-acc active:scale-95">
                Cancelar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 border border-bd text-err hover:bg-err/10 hover:border-err/30 transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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
