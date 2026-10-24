import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import Crop from "react-easy-crop";

export interface ImageCropModalProps {
  open: boolean;
  onClose: () => void;
  /** Imagem original (pode ser mxc://, file ou data URL) */
  image: string | File | null;
  /** Título do modal */
  title?: string;
  /** Aspect ratio fixo (ex: 1:1 para avatar, 16:9 para banner) */
  aspect?: number;
  /** Callback quando o crop é concluído e imagem confirmada */
  onConfirm: (croppedFile: File) => void;
}

/**
 * Modal de crop de imagem baseado no react-easy-crop (2.7k stars, ativamente mantido).
 *
 * Referências aplicadas:
 * - react-easy-crop: hook-based crop com drag, zoom, rotation, touch
 * - Element Web: componentes de upload de mídia
 * - matrix-react-sdk: padrões de upload via matrix-js-sdk
 *
 * O modal permite selecionar, cortar e confirmar uma imagem antes de fazer upload
 * para o Synapse via matrixService.uploadMedia().
 */
export default function ImageCropModal({
  open,
  onClose,
  image,
  title = "Recortar imagem",
  aspect = 1,
  onConfirm,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPercent, setCroppedAreaPercent] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  // Converte File para data URL para exibição no Cropper
  useEffect(() => {
    if (image instanceof File) {
      const reader = new FileReader();
      reader.onload = () => setImageSrc(reader.result as string);
      reader.readAsDataURL(image);
    } else if (typeof image === "string") {
      setImageSrc(image);
    } else {
      setImageSrc(null);
    }
  }, [image]);

  const onCropComplete = useCallback(
    (croppedArea: { width: number; height: number; x: number; y: number }) => {
      setCroppedAreaPercent(croppedArea);
    },
    [],
  );

  const onCropChange = useCallback(
    (newCrop: { x: number; y: number }) => {
      setCrop(newCrop);
    },
    [],
  );

  const onZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const confirmCrop = async () => {
    if (!imageSrc || !croppedAreaPercent) return;

    setIsLoading(true);
    setError(null);

    try {
      const croppedImg = await getCroppedImg(imageSrc, croppedAreaPercent, rotation);
      const blob = await (await fetch(croppedImg)).blob();
      const file = new File([blob], "cropped-image.png", { type: "image/png" });
      onConfirm(file);
      onClose();
    } catch {
      setError("Não foi possível processar a imagem. Tente de novo.");
    } finally {
      setIsLoading(false);
    }
  };

  const aspectRatio = useMemo(() => (aspect > 0 ? aspect : 1), [aspect]);

  if (!open || !imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-2xl rounded-xl border border-bd bg-surf p-6 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-txt">{title}</h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="cursor-pointer rounded p-1 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
          >
            <X size={18} />
          </button>
        </header>

        {/* Área de crop */}
        <div className="flex-1 flex items-center justify-center bg-bg rounded-xl border border-bd relative overflow-hidden">
          <div className="w-full max-w-[500px] max-h-[500px] flex items-center justify-center bg-bg rounded-xl border border-bd relative overflow-hidden">
            <Crop
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspectRatio}
              cropShape="rect"
              showGrid={false}
              minZoom={1}
              maxZoom={3}
              onCropChange={onCropChange}
              onCropComplete={onCropComplete}
              onZoomChange={onZoomChange}
              onRotationChange={setRotation}
            />
          </div>
        </div>

        {/* Controles de zoom e rotação */}
        <div className="mt-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
            className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
          >
            -
          </button>
          <span className="text-xs text-txt">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
            className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setRotation((r) => r + 90)}
            className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
          >
            ↻
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-3 py-2 rounded-lg bg-transparent border border-bd text-mut hover:bg-surf2 transition-colors active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmCrop}
            disabled={!croppedAreaPercent || isLoading}
            className="cursor-pointer px-3 py-2 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Processando…" : "Confirmar corte"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-2 text-sm text-err">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Utilitário do react-easy-crop para gerar a imagem recortada.
 * Baseado na documentação oficial da biblioteca.
 */
async function getCroppedImg(
  imageSrc: string,
  croppedArea: { width: number; height: number; x: number; y: number },
  rotation: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = croppedArea.width * scaleX;
      canvas.height = croppedArea.height * scaleY;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Não foi possível criar contexto do canvas"));
        return;
      }

      // Aplica rotação se houver
      if (rotation !== 0) {
        const rad = (rotation * Math.PI) / 180;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      ctx.drawImage(
        image,
        croppedArea.x * scaleX,
        croppedArea.y * scaleY,
        croppedArea.width * scaleX,
        croppedArea.height * scaleY,
        0,
        0,
        croppedArea.width * scaleX,
        croppedArea.height * scaleY,
      );

      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => {
      reject(new Error("Falha ao carregar imagem para corte"));
    };
  });
}
