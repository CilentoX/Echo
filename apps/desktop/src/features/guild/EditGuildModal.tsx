import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { ImageUploadWithCrop } from "@/components/media/ImageUploadWithCrop";

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
    if (!window.confirm(`Tem certeza que deseja excluir a guilda "${guild.name}"?`)) return;
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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Editar guilda"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[420px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-txt">Editar guilda</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

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

        <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Nome da guilda
        </label>
        <input
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

        <label className="mt-4 mb-2 block text-xs font-semibold uppercase tracking-wide text-mut">
          Descrição
        </label>
        <textarea
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
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex-1 rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-mut hover:bg-surf2 transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading}
            className="cursor-pointer flex-1 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Salvando…" : "Salvar alterações"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="cursor-pointer mt-4 w-full rounded-lg bg-transparent border border-bd py-2.5 font-display font-semibold text-err hover:bg-err/10 transition-colors active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting ? "Excluindo…" : <X size={14} className="mr-2" />} Excluir guilda
        </button>
      </div>
    </div>
  );
}
