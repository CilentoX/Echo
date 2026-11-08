"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { X, Crop, ArrowsClockwise, ArrowCounterClockwise, ArrowsLeftRight, ArrowsDownUp, ArrowsOutSimple, Camera, Check } from "@phosphor-icons/react";
import { mxcToHttp } from "@/lib/media/mxc";
import { getCroppedImg } from "@/lib/media/cropHelper";
import "react-easy-crop/react-easy-crop.css";

export interface ImageEditorProps {
  open: boolean;
  imageSrc: string | null;
  title?: string;
  aspect?: number;
  outputWidth?: number;
  outputHeight?: number;
  onConfirm: (croppedFile: File) => void;
  onClose: () => void;
  userId?: string;
  onSelectNewImage?: (file: File) => void;
}

// Error Boundary defensivo para evitar que falhas de imagem crashem o app
interface ErrorBoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class CropErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ImageEditor] Erro capturado pelo ErrorBoundary:", error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}

/**
 * Editor profissional de recorte de imagens do Echo:
 * - Baseado no react-easy-crop (suave, sem crash de zoom/resize, sem perda de resolução).
 * - Suporta avatares (máscara circular 1:1) e banners (16:9, 4:1 panorâmico).
 * - Recorte realizado diretamente sobre a resolução nativa da imagem, garantindo 100% de nitidez.
 * - Design alinhado às diretrizes do Echo (Dark Glassmorphism, regra de ouro GEMINI.md).
 */
const ImageEditorContent = memo(function ImageEditorContent({
  open,
  imageSrc,
  title = "Recortar imagem",
  aspect = 1,
  outputWidth,
  outputHeight,
  onConfirm,
  onClose,
  userId,
  onSelectNewImage,
}: ImageEditorProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAspect, setCurrentAspect] = useState<number>(aspect);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Converte mxc:// para HTTP se necessário
  const effectiveSrc = useMemo(() => {
    if (!imageSrc) return null;
    if (imageSrc.startsWith("mxc://")) {
      return mxcToHttp(imageSrc) ?? imageSrc;
    }
    return imageSrc;
  }, [imageSrc]);

  const isAvatar = currentAspect === 1;

  // Sincroniza aspect inicial quando a propriedade muda
  useEffect(() => {
    setCurrentAspect(aspect || 1);
  }, [aspect]);

  const resetTransform = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (open) {
      resetTransform();
    }
  }, [open, imageSrc, resetTransform]);

  const onCropComplete = useCallback((_croppedArea: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Atalhos de teclado (Esc, R, H, Enter)
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "r" || e.key === "R") {
        setRotation((prev) => (e.shiftKey ? (prev - 90 + 360) % 360 : (prev + 90) % 360));
      } else if (e.key === "h" || e.key === "H") {
        setFlipH((prev) => !prev);
      } else if (e.key === "Enter" && !isLoading) {
        void handleConfirmCrop();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, isLoading, onClose]);

  const handleConfirmCrop = async () => {
    if (!effectiveSrc || !croppedAreaPixels) return;

    setIsLoading(true);
    setError(null);

    try {
      const croppedFile = await getCroppedImg(
        effectiveSrc,
        croppedAreaPixels,
        rotation,
        { horizontal: flipH, vertical: flipV },
        outputWidth || 1920,
        outputHeight || 1080
      );

      // Preserva identificador opcional para desambiguação de cache
      const finalName = userId ? `edited-${userId.replace(/[@:]/g, "")}.webp` : croppedFile.name;
      const fileWithProperName = new File([croppedFile], finalName, { type: croppedFile.type });

      onConfirm(fileWithProperName);
      onClose();
    } catch (err: any) {
      console.error("[ImageEditor] Erro ao recortar imagem:", err);
      setError(err?.message || "Ocorreu um erro ao processar a imagem. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!open || !effectiveSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl border border-white/[0.08] bg-[#12161f] shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 text-txt"
      >
        {/* Cabeçalho Superior Fixo (Padrão Guild Modal - Rule 4) */}
        <header className="flex items-center justify-between p-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg shadow-md shadow-acc/20 flex items-center justify-center font-bold">
              <Crop size={20} weight="bold" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-txt">{title}</h2>
              <p className="text-xs text-mut/80">
                {isAvatar ? "Enquadramento para perfil ou ícone (1:1)" : "Enquadramento para banner panorâmico (16:9)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onSelectNewImage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onSelectNewImage(file);
                    }
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-medium text-txt hover:bg-white/[0.08] hover:border-acc/40 transition-all active:scale-95"
                  title="Selecionar outro arquivo"
                >
                  <Camera size={13} weight="bold" />
                  <span className="hidden sm:inline">Trocar</span>
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              disabled={isLoading}
              className="cursor-pointer rounded-xl p-2 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Viewport Interativa do react-easy-crop */}
        <div className="relative w-full h-[360px] sm:h-[420px] bg-[#0b0e14] overflow-hidden flex items-center justify-center echo-cropper">
          <Cropper
            image={effectiveSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={currentAspect}
            cropShape={isAvatar ? "round" : "rect"}
            showGrid={true}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
            minZoom={1}
            maxZoom={4}
            zoomSpeed={0.8}
            style={{
              containerStyle: {
                backgroundColor: "#0b0e14",
              },
              cropAreaStyle: {
                borderColor: "#0FB9A8",
                borderWidth: 2,
                boxShadow: "0 0 0 9999px rgba(11, 14, 20, 0.75)",
              },
            }}
          />

          {/* Seletor Rápido de Proporção para Banners */}
          {!isAvatar && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#12161f]/80 backdrop-blur-md p-1 rounded-xl border border-white/[0.08] shadow-lg">
              <button
                type="button"
                onClick={() => setCurrentAspect(16 / 9)}
                className={`cursor-pointer px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                  Math.abs(currentAspect - 16 / 9) < 0.05
                    ? "bg-acc text-bg shadow-sm"
                    : "text-mut hover:text-txt"
                }`}
                title="Proporção padrão 16:9"
              >
                16:9
              </button>
              <button
                type="button"
                onClick={() => setCurrentAspect(4 / 1)}
                className={`cursor-pointer px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                  Math.abs(currentAspect - 4 / 1) < 0.05
                    ? "bg-acc text-bg shadow-sm"
                    : "text-mut hover:text-txt"
                }`}
                title="Panorâmico estilo Discord (4:1)"
              >
                4:1
              </button>
              <button
                type="button"
                onClick={() => setCurrentAspect(21 / 9)}
                className={`cursor-pointer px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                  Math.abs(currentAspect - 21 / 9) < 0.05
                    ? "bg-acc text-bg shadow-sm"
                    : "text-mut hover:text-txt"
                }`}
                title="Ultrawide 21:9"
              >
                21:9
              </button>
            </div>
          )}

          {/* Dica de arraste */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] text-mut/80 border border-white/[0.05]">
            Arraste para mover • Scroll para zoom
          </div>
        </div>

        {/* Controles de Transformação e Zoom */}
        <div className="p-4 border-t border-white/[0.08] bg-white/[0.01] flex flex-col gap-3 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Controle de Zoom */}
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] px-2.5 py-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(1))))}
                disabled={zoom <= 1}
                className="cursor-pointer text-mut hover:text-txt disabled:opacity-30 disabled:pointer-events-none p-1 rounded-lg transition-colors"
                title="Diminuir zoom"
              >
                −
              </button>
              <input
                type="range"
                value={zoom}
                min={1}
                max={4}
                step={0.05}
                aria-label="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-24 sm:w-32 h-1.5 bg-white/[0.1] rounded-lg appearance-none cursor-pointer accent-[#0FB9A8]"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(4, Number((z + 0.2).toFixed(1))))}
                disabled={zoom >= 4}
                className="cursor-pointer text-mut hover:text-txt disabled:opacity-30 disabled:pointer-events-none p-1 rounded-lg transition-colors"
                title="Aumentar zoom"
              >
                +
              </button>
              <span className="font-mono text-[11px] text-mut w-10 text-right">
                {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Ações de Rotação e Flip */}
            <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.06] transition-all"
                title="Girar 90° à esquerda (Shift+R)"
              >
                <ArrowCounterClockwise size={15} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="cursor-pointer p-1.5 rounded-lg text-mut hover:text-txt hover:bg-white/[0.06] transition-all"
                title="Girar 90° à direita (R)"
              >
                <ArrowsClockwise size={15} />
              </button>
              <div className="w-px h-3.5 bg-white/[0.08] mx-0.5" />
              <button
                type="button"
                onClick={() => setFlipH((f) => !f)}
                className={`cursor-pointer p-1.5 rounded-lg transition-all ${
                  flipH ? "bg-acc/20 text-acc font-bold" : "text-mut hover:text-txt hover:bg-white/[0.06]"
                }`}
                title="Espelhar horizontal (H)"
              >
                <ArrowsLeftRight size={15} />
              </button>
              <button
                type="button"
                onClick={() => setFlipV((f) => !f)}
                className={`cursor-pointer p-1.5 rounded-lg transition-all ${
                  flipV ? "bg-acc/20 text-acc font-bold" : "text-mut hover:text-txt hover:bg-white/[0.06]"
                }`}
                title="Espelhar vertical"
              >
                <ArrowsDownUp size={15} />
              </button>
            </div>

            {/* Redefinir */}
            <button
              type="button"
              onClick={resetTransform}
              className="cursor-pointer px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-[11px] font-medium text-mut hover:text-txt hover:bg-white/[0.06] transition-all"
              title="Redefinir enquadramento"
            >
              <ArrowsOutSimple size={13} className="inline mr-1" />
              Redefinir
            </button>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-xl bg-err/15 border border-err/30 text-err text-xs font-medium animate-in fade-in-0 duration-150">
              {error}
            </div>
          )}
        </div>

        {/* Rodapé de Ações (Padrão Guild Modal - Rule 4) */}
        <footer className="p-4 border-t border-white/[0.08] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-semibold text-txt hover:bg-white/[0.08] active:scale-95 transition-all text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={isLoading}
            className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-xs font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="animate-pulse">Processando imagem…</span>
            ) : (
              <>
                <Check size={15} weight="bold" />
                <span>Confirmar recorte</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
});

/**
 * ImageEditor com ErrorBoundary embutido para total resiliência contra crashes.
 */
const ImageEditor = memo(function ImageEditor(props: ImageEditorProps) {
  if (!props.open || !props.imageSrc) return null;

  const modalNode = (
    <CropErrorBoundary
      fallback={(error, reset) => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] bg-[#12161f] p-5 shadow-2xl text-center space-y-4">
            <h3 className="text-sm font-semibold text-err">Falha ao carregar imagem para recorte</h3>
            <p className="text-xs text-mut/80 break-words">{error.message || "Formato de arquivo incompatível ou corrompido."}</p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={props.onClose}
                className="px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs font-semibold text-txt hover:bg-white/[0.08]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 rounded-xl bg-acc text-bg text-xs font-semibold hover:bg-acc-press"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <ImageEditorContent {...props} />
    </CropErrorBoundary>
  );

  if (typeof document !== "undefined") {
    return createPortal(modalNode, document.body);
  }

  return modalNode;
});

export default ImageEditor;
