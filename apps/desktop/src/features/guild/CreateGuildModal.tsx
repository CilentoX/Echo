import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { ImageUploadWithCrop } from "@/components/media/ImageUploadWithCrop";

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
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label="Criar guilda"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[460px] rounded-xl border border-bd bg-surf p-6 shadow-xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-txt">Criar guilda</h2>
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) void handleSubmit();
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
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="cursor-pointer flex-1 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Criando…" : "Criar guilda"}
          </button>
        </div>
      </div>
    </div>
  );
}
