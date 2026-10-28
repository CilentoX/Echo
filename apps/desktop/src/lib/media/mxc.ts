/**
 * Utilitário para converter URLs mxc:// do Matrix em URLs HTTP acessíveis pelo navegador.
 * 
 * O navegador não entende o esquema mxc://. É necessário usar o endpoint de download
 * do Synapse: /_matrix/media/r0/download/<serverName>/<mediaId>
 * 
 * Também suporta thumbnails via /_matrix/media/r0/thumbnail/<serverName>/<mediaId>
 * com parâmetros width/height/method.
 */

export const MATRIX_MEDIA_BASE = "https://echo.litteris.online/_matrix/media";

/**
 * Converte uma URI mxc://serverName/mediaId para uma URL HTTP completa.
 * 
 * @param mxcUrl - URI no formato mxc://serverName/mediaId
 * @returns URL HTTP completa ou null se inválida
 */
export function mxcToHttp(mxcUrl: string | null | undefined): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;

  try {
    // Remove o prefixo mxc:// e divide em servidor e mediaId
    const withoutPrefix = mxcUrl.replace("mxc://", "");
    const [serverName, mediaId] = withoutPrefix.split("/");
    if (!serverName || !mediaId) return null;
    
    // Use v3 API which has better CORS support
    return `${MATRIX_MEDIA_BASE}/v3/download/${serverName}/${mediaId}`;
  } catch {
    return null;
  }
}

/**
 * Converte uma URI mxc:// para uma URL de thumbnail com dimensões específicas.
 * 
 * @param mxcUrl - URI no formato mxc://serverName/mediaId
 * @param width - largura desejada
 * @param height - altura desejada
 * @param method - método de thumbnail: "crop" ou "scale"
 * @returns URL HTTP do thumbnail ou null se inválida
 */
export function mxcToThumbnail(
  mxcUrl: string | null | undefined,
  width: number,
  height: number,
  method: "crop" | "scale" = "crop",
): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;

  try {
    const withoutPrefix = mxcUrl.replace("mxc://", "");
    const [serverName, mediaId] = withoutPrefix.split("/");
    if (!serverName || !mediaId) return null;
    return `${MATRIX_MEDIA_BASE}/v3/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=${method}`;
  } catch {
    return null;
  }
}

/**
 * Extract media ID from mxc:// URL
 */
export function getMxcMediaId(mxcUrl: string | null | undefined): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;
  
  try {
    const withoutPrefix = mxcUrl.replace("mxc://", "");
    const parts = withoutPrefix.split("/");
    return parts.length >= 2 ? parts[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get server name from mxc:// URL
 */
export function getMxcServerName(mxcUrl: string | null | undefined): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;
  
  try {
    const withoutPrefix = mxcUrl.replace("mxc://", "");
    const [serverName] = withoutPrefix.split("/");
    return serverName || null;
  } catch {
    return null;
  }
}