import { useState } from "react";
import { mxcToHttp, mxcToThumbnail } from "@/lib/media/mxc";

export interface MxcImageProps {
  /** URI mxc://serverName/mediaId */
  mxcUrl: string | null | undefined;
  /** Largura desejada (px) */
  width?: number;
  /** Altura desejada (px) */
  height?: number;
  /** Método de thumbnail: "crop" ou "scale" */
  method?: "crop" | "scale";
  /** Texto alternativo */
  alt?: string;
  /** Classe CSS */
  className?: string;
  /** Estilo inline */
  style?: React.CSSProperties;
  /** Callback quando a imagem carrega */
  onLoad?: () => void;
  /** Callback quando há erro ao carregar */
  onError?: () => void;
}

/**
 * Componente de imagem que converte automaticamente URLs mxc:// do Matrix
 * em URLs HTTP acessíveis pelo navegador via endpoint de media do Synapse.
 *
 * Usa thumbnails quando width/height são fornecidos, caso contrário usa
 * o endpoint de download direto.
 */
export default function MxcImage({
  mxcUrl,
  width,
  height,
  method = "crop",
  alt = "",
  className,
  style,
  onLoad,
  onError,
}: MxcImageProps) {
  const [error, setError] = useState(false);

  const httpUrl = !mxcUrl
    ? null
    : mxcUrl.startsWith("data:") || mxcUrl.startsWith("blob:")
      ? mxcUrl
      : width && height
        ? mxcToThumbnail(mxcUrl, width, height, method)
        : mxcToHttp(mxcUrl);

  const handleError = () => {
    setError(true);
    onError?.();
  };

  if (!httpUrl || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-surf2 text-mut ${className ?? ""}`}
        style={style}
        role="img"
        aria-label={alt || "Imagem não disponível"}
      >
        {/* Fallback: inicial em maiúsculo */}
        {mxcUrl ? mxcUrl.split("/").pop()?.charAt(0).toUpperCase() || "?" : "?"}
      </div>
    );
  }

  return (
    <img
      src={httpUrl}
      alt={alt}
      className={className}
      style={style}
      onLoad={onLoad}
      onError={handleError}
      decoding="async"
      loading="lazy"
    />
  );
}
