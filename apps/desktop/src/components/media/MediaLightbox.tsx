"use client";

import { useEffect, useState, useCallback } from "react";
import { useCachedMedia } from "@/lib/media/mediaDiskCache";
import {
  ArrowSquareOut,
  Copy,
  DownloadSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
  Check,
} from "@phosphor-icons/react";

export interface MediaLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onClose: () => void;
}

export default function MediaLightbox({
  src,
  alt = "Imagem",
  open,
  onClose,
}: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [copied, setCopied] = useState(false);
  const { src: cachedSrc } = useCachedMedia(src);
  const effectiveSrc = cachedSrc || src;

  useEffect(() => {
    if (open) {
      setZoom(1);
      setCopied(false);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))));
  const handleResetZoom = () => setZoom(1);

  const handleCopyImage = async () => {
    try {
      const response = await fetch(effectiveSrc);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copia a URL
      await navigator.clipboard.writeText(src);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = effectiveSrc;
    a.download = alt || "echo-imagem";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizador de imagem"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/85 backdrop-blur-xl p-4 select-none animate-in fade-in-0 duration-200"
      onClick={onClose}
    >
      {/* Barra Superior de Controles */}
      <div
        className="flex w-full max-w-5xl items-center justify-between gap-2 px-2 py-1 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate text-xs font-medium text-white/70 max-w-sm">
          {alt}
        </span>

        <div className="flex items-center gap-1.5 rounded-2xl bg-black/50 border border-white/10 px-2.5 py-1.5 backdrop-blur-md">
          {/* Zoom Out */}
          <button
            type="button"
            title="Reduzir zoom"
            aria-label="Reduzir zoom"
            onClick={handleZoomOut}
            className="cursor-pointer rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <MagnifyingGlassMinus size={18} />
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            title="Tamanho original"
            aria-label="Tamanho original"
            onClick={handleResetZoom}
            className="cursor-pointer px-2 py-1 text-xs font-mono font-medium text-white/90 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In */}
          <button
            type="button"
            title="Aumentar zoom"
            aria-label="Aumentar zoom"
            onClick={handleZoomIn}
            className="cursor-pointer rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <MagnifyingGlassPlus size={18} />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {/* Copiar Imagem */}
          <button
            type="button"
            title="Copiar imagem"
            aria-label="Copiar imagem"
            onClick={handleCopyImage}
            className="cursor-pointer flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            {copied ? <Check size={16} className="text-acc" weight="bold" /> : <Copy size={16} />}
            <span className="hidden sm:inline">{copied ? "Copiado!" : "Copiar"}</span>
          </button>

          {/* Baixar Imagem */}
          <button
            type="button"
            title="Baixar imagem"
            aria-label="Baixar imagem"
            onClick={handleDownload}
            className="cursor-pointer flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <DownloadSimple size={16} />
            <span className="hidden sm:inline">Salvar</span>
          </button>

          {/* Abrir original */}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir no navegador"
            aria-label="Abrir no navegador"
            className="cursor-pointer rounded-lg p-1.5 text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <ArrowSquareOut size={18} />
          </a>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {/* Fechar */}
          <button
            type="button"
            title="Fechar"
            aria-label="Fechar visualizador"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-white/80 hover:text-white hover:bg-white/20 active:scale-95 transition-all"
          >
            <X size={18} weight="bold" />
          </button>
        </div>
      </div>

      {/* Área Central da Imagem com Zoom */}
      <div
        className="flex flex-1 items-center justify-center w-full max-w-5xl overflow-hidden cursor-zoom-out p-4"
        onClick={onClose}
      >
        <img
          src={effectiveSrc}
          alt={alt}
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => {
            e.stopPropagation();
            if (zoom === 1) {
              setZoom(1.75);
            } else {
              setZoom(1);
            }
          }}
          className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-200 cursor-zoom-in ease-out"
        />
      </div>

      {/* Rodapé com Dica */}
      <div className="text-[11px] text-white/50 text-center pb-2 pointer-events-none">
        Clique na imagem para alternar zoom • Pressione <kbd className="px-1.5 py-0.5 rounded bg-white/10 font-mono text-white/80">Esc</kbd> para fechar
      </div>
    </div>
  );
}

