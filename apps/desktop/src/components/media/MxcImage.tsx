import { useEffect, useState } from "react";
import { mxcToHttp, mxcToThumbnail, mxcToHttpWithAuth, mxcToThumbnailWithAuth } from "@/lib/media/mxc";

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
  /** Usar URL autenticada (com access token) para evitar M_FORBIDDEN */
  useAuth?: boolean;
}

/**
 * Componente de imagem que converte automaticamente URLs mxc:// do Matrix
 * em URLs HTTP acessíveis via endpoint de media do Synapse.
 *
 * Usa thumbnails quando width/height são fornecidos, caso contrário usa
 * o endpoint de download direto.
 *
 * Inclui fallback automático e tratamento de erros CORS/404.
 * Suporta URLs autenticadas (com access token) para evitar M_FORBIDDEN.
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
  useAuth = true,
}: MxcImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [useThumbnail, setUseThumbnail] = useState(false);
  const [httpUrl, setHttpUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!mxcUrl) {
      setHttpUrl(null);
      setLoading(false);
      return;
    }

    // URLs data:, blob:, http(s) passam direto
    if (mxcUrl.startsWith("data:") || mxcUrl.startsWith("blob:") || mxcUrl.startsWith("http")) {
      setHttpUrl(mxcUrl);
      setLoading(false);
      return;
    }

    // mxc:// URL - converte para HTTP
    const buildUrl = async () => {
      try {
        let url: string | null = null;

        if (width && height) {
          // Thumbnail
          if (useAuth) {
            url = mxcToThumbnailWithAuth(mxcUrl, width, height, "crop");
          } else {
            url = mxcToThumbnail(mxcUrl, width, height, "crop");
          }
        } else {
          // Download direto
          if (useAuth) {
            url = mxcToHttpWithAuth(mxcUrl);
          } else {
            url = mxcToHttp(mxcUrl);
          }
        }
        setHttpUrl(url);
      } catch {
        setHttpUrl(null);
      } finally {
        setLoading(false);
      }
    };

    buildUrl();
  }, [mxcUrl, width, height]);

  console.debug("[MxcImage] httpUrl:", httpUrl, { mxcUrl, width, height });

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
    console.error("[MxcImage] Failed to load image:", { mxcUrl, httpUrl, width, height });
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
    console.debug("[MxcImage] Image loaded successfully:", { mxcUrl, httpUrl });
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
  if (!httpUrl || error) {
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
      src={httpUrl}
      alt={alt}
      className={className}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );
}