import { ECHO_API_CONFIG } from "./config";

/**
 * Faz upload de uma imagem para a Echo API Storage.
 * Devolve a URL pública da imagem.
 */
export async function uploadImage(file: File): Promise<string> {
  console.log("[Echo API storage] Iniciando upload:", file.name, file.size, "bytes", file.type);

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${ECHO_API_CONFIG.baseUrl}/api/upload`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(ECHO_API_CONFIG.timeout),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Echo API storage] Upload falhou:", response.status, errorText);
    throw new Error(`Echo API upload failed: ${errorText}`);
  }

  const data = await response.json();
  console.log("[Echo API storage] Upload concluído:", data.fileId, "url:", data.url);

  return data.url;
}

/**
 * Remove uma imagem da Echo API Storage pelo fileId extraído da URL.
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    // Extrai o nome do arquivo da URL (ex: https://api.echo.litteris.online/uploads/abc-123.png)
    const match = imageUrl.match(/\/uploads\/([^/?]+)(\?|$)/);
    if (!match) return;

    const fileName = match[1];
    // Extrai o fileId (remove a extensão)
    const fileId = fileName.replace(/\.[^/.]+$/, "");

    await fetch(`${ECHO_API_CONFIG.baseUrl}/api/upload/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(ECHO_API_CONFIG.timeout),
    });
  } catch {
    // falha silenciosa na remoção
  }
}
