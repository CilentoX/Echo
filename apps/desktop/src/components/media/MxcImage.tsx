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
  /** Fallback personalizado */
  fallback?: React.ReactNode;
  /** Tentar fallback automático para thumbnail se download falhar */
  fallbackToThumbnail?: boolean;
  /** Mostrar indicador de carregamento */
  showLoading?: boolean;
}

/**
 * Componente de imagem que converte automaticamente URLs mxc:// do Matrix
 * em URLs HTTP acessíveis via endpoint de media do Synapse.
 *
 * Usa thumbnails quando width/height são fornecidos, caso contrário usa
 * o endpoint de download direto.
 *
 * Inclui fallback automático e tratamento de erros CORS/404.
 */
export default function MxcImage({
  mxcUrl,
  width,
  height,
  alt = "",
  className,
  style,
  onLoad,
  onError,
  fallback,
  fallbackToThumbnail = true,
  showLoading = true,
}: {
  mxcUrl: string | null | undefined;
  width?: number;
  height?: number;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: () => void;
  fallback?: React.ReactNode;
  fallbackToThumbnail?: boolean;
  showLoading?: boolean;
}) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [useThumbnail, setUseThumbnail] = useState(false);

  const httpUrl = !mxcUrl
    ? null
    : mxcUrl.startsWith("data:") || mxcUrl.startsWith("blob:") || mxcUrl.startsWith("http")
      ? mxcUrl
      : width && height
        ? mxcToThumbnail(mxcUrl, width, height, "crop")
        : mxcToHttp(mxcUrl);

  // If no URL provided, don't show loading spinner - show fallback immediately
  if (!mxcUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-surf2 text-mut ${className ?? ""}`}
        style={style}
        role="img"
        aria-label={alt || "Imagem não disponível"}
      >
        {fallback || (
          <span className="text-xl font-medium text-mut/50">?</span>
        )}
      </div>
    );
  }

  const handleError = () => {
    setLoading(false);
    // If already tried thumbnail or no width/height, don't retry
    if (fallbackToThumbnail && !useThumbnail && width && height && retryCount < 2) {
      // Try thumbnail as fallback
      setUseThumbnail(true);
      setRetryCount(c => c + 1);
      return;
    }
    // Max retries reached or not using thumbnail - show error
    setError(true);
    onError?.();
  };

  const handleLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  // Show loading state
  if (showLoading && loading && !error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-surf2/50 ${className ?? ""}`}
        style={style}
        role="img"
        aria-label={alt || "Carregando..."}
      >
        <div className="w-6 h-6 border-2 border-acc border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show error fallback
  if (!mxcUrl || error) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-surf2 text-mut ${className ?? ""}`}
        style={style}
        role="img"
        aria-label={alt || "Imagem não disponível"}
      >
        {fallback || (
          <span className="text-xl font-medium text-mut/50">
            {mxcUrl ? mxcUrl.split("/").pop()?.charAt(0).toUpperCase() || "?" : "?"}
          </span>
        )}
      </div>
    );
  }

  // Success - render the actual image
  return (
    <img
      src={httpUrl ?? undefined}
      alt={alt}
      className={className}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}
