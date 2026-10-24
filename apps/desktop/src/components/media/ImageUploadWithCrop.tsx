import { useState } from "react";
import { Plus, Pencil, Trash } from "@phosphor-icons/react";
import MxcImage from "./MxcImage";
import ImageCropModal from "./ImageCropModal";

export interface ImageUploadWithCropProps {
  /** Valor atual (pode ser mxc://, data URL ou null) */
  value: string | null;
  /** Label do campo */
  label: string;
  /** Placeholder quando não há imagem */
  placeholder?: string;
  /** Callback quando uma imagem é selecionada e recortada */
  onChange: (file: File) => void;
  /** Aspect ratio do crop (1:1 para avatar, 16:9 para banner) */
  aspect?: number;
  /** Título do modal de crop */
  cropTitle?: string;
}

/**
 * Componente de upload de imagem com crop integrado.
 *
 * Fluxo:
 * 1. Usuário clica no campo → abre input de arquivo
 * 2. Seleciona arquivo → abre ImageCropModal para recortar
 * 3. Confirma o crop → chama onChange com o File recortado
 * 4. Preview mostra a imagem (mxc:// convertido via MxcImage)
 *
 * Referências aplicadas:
 * - react-easy-crop (2.7k stars): componente de crop padrão
 * - Element Web: interface de upload de avatar/banner
 * - matrix-react-sdk: padrões de upload via matrix-js-sdk
 */
export function ImageUploadWithCrop({
  value,
  label,
  placeholder,
  onChange,
  aspect = 1,
  cropTitle,
}: ImageUploadWithCropProps) {
  const [cropOpen, setCropOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    setCurrentImage(file);
    setCropOpen(true);
  };

  const handleCropConfirm = (croppedFile: File) => {
    onChange(croppedFile);
    setCropOpen(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mut">
        {label}
      </label>

      {/* Preview da imagem atual */}
      <div className="relative w-full h-24 rounded-xl border border-bd bg-surf2 flex items-center justify-center cursor-pointer group overflow-hidden">
        {value ? (
          <MxcImage
            mxcUrl={value}
            className="absolute inset-0 w-full h-full object-cover"
            alt={label}
          />
        ) : null}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100">
          {value ? (
            <>
              <Pencil size={16} className="text-white mb-2" />
              <span className="text-xs text-white font-medium">Alterar imagem</span>
            </>
          ) : (
            <>
              <Plus size={20} className="text-white mb-2" />
              <span className="text-xs text-white font-medium">{placeholder || "Adicionar imagem"}</span>
            </>
          )}
        </div>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFileSelect(e);
            // Permite reselecionar o mesmo arquivo
            e.target.value = "";
          }}
        />
        {/* Overlay clicável: abre o file picker tanto para adicionar quanto para alterar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            const input = e.currentTarget
              .closest("div")
              ?.querySelector('input[type="file"]') as HTMLInputElement | null;
            input?.click();
          }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          aria-label={value ? "Alterar imagem" : "Adicionar imagem"}
        />
        {value && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(new File([""], "", { type: "image/png" }));
            }}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-err/90 flex items-center justify-center text-xs text-bg hover:bg-err transition-colors z-20"
            aria-label="Remover imagem"
          >
            <Trash size={10} />
          </button>
        )}
      </div>

      <ImageCropModal
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        image={currentImage}
        title={cropTitle || `Recortar ${label}`}
        aspect={aspect}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
