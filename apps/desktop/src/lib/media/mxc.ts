/**
 * Utilitário para converter URLs mxc:// do Matrix em URLs HTTP acessíveis pelo navegador.
 * 
 * O navegador não entende o esquema mxc://. É necessário usar o endpoint de download
 * do Synapse: /_matrix/media/v3/download/<serverName>/<mediaId>
 * 
 * Também suporta thumbnails via /_matrix/media/v3/thumbnail/<serverName>/<mediaId>
 * com parâmetros width/height/method.
 * 
 * Para URLs autenticadas (necessário para servidores que bloqueiam federation),
 * use as funções que usam o matrixService com useAuthentication=true.
 */

export const MATRIX_MEDIA_BASE = "https://echo.litteris.online/_matrix/media";

/**
 * Converte uma URI mxc://serverName/mediaId para uma URL HTTP completa.
 * VERSÃO SIMPLES (sem auth) - pode falhar com M_FORBIDDEN em servidores com federation bloqueada.
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
    
    // Use v3 API
    const url = `${MATRIX_MEDIA_BASE}/v3/download/${serverName}/${mediaId}`;
    console.debug("[mxcToHttp] mxcUrl:", mxcUrl, "-> httpUrl:", url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Converte mxc:// para HTTP usando o matrixService com access token (autenticado).
 * Necessário para servidores que bloqueiam federation (M_FORBIDDEN).
 * 
 * @param mxcUrl - URI no formato mxc://serverName/mediaId
 * @param _width - largura opcional (não usada no download direto)
 * @param _height - altura opcional (não usada no download direto)
 * @param _resizeMethod - método de resize (não usado no download direto)
 * @returns URL HTTP autenticada ou null se inválida
 */
export function mxcToHttpWithAuth(
  mxcUrl: string | null | undefined,
  _width?: number,
  _height?: number,
  _resizeMethod: "crop" | "scale" = "crop",
): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;

  try {
    // Import dinamico para evitar dependência circular
    const { matrixService } = require("@/lib/matrix/instance");
    const url = matrixService.mxcUrlToHttp(mxcUrl);
    console.debug("[mxcToHttpWithAuth] mxcUrl:", mxcUrl, "-> httpUrl:", url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Converte uma URI mxc:// para uma URL de thumbnail com dimensões específicas.
 * VERSÃO SIMPLES (sem auth).
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
    const url = `${MATRIX_MEDIA_BASE}/v3/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=${method}`;
    console.debug("[mxcToThumbnail] mxcUrl:", mxcUrl, "-> thumbUrl:", url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Converte mxc:// para thumbnail autenticado usando o matrixService.
 * 
 * @param mxcUrl - URI no formato mxc://serverName/mediaId
 * @param width - largura desejada
 * @param height - altura desejada
 * @param _method - método de thumbnail (ignorado, sempre usa "crop" no SDK)
 * @returns URL HTTP do thumbnail autenticado ou null se inválida
 */
export function mxcToThumbnailWithAuth(
  mxcUrl: string | null | undefined,
  width: number,
  height: number,
  _method: "crop" | "scale" = "crop",
): string | null {
  if (!mxcUrl || !mxcUrl.startsWith("mxc://")) return null;

  try {
    const { matrixService } = require("@/lib/matrix/instance");
    const url = matrixService.mxcUrlToHttp(mxcUrl, width, height, "crop");
    console.debug("[mxcToThumbnailWithAuth] mxcUrl:", mxcUrl, "-> thumbUrl:", url);
    return url;
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