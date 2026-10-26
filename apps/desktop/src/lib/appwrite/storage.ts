import { APPWRITE_CONFIG } from "./config";

/**
 * Faz upload de uma imagem para o Appwrite Storage via API REST.
 * Devolve a URL pública da imagem.
 */
export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files`,
    {
      method: "POST",
      headers: {
        "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
        "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Appwrite upload failed: ${errorText}`);
  }

  const data = await response.json();

  // URL pública da imagem (bucket deve ter permissão de leitura pública)
  return `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${data.$id}/view?project=${APPWRITE_CONFIG.projectId}`;
}

/**
 * Remove uma imagem do Appwrite Storage pelo fileId extraído da URL.
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  try {
    const fileId = extractFileId(imageUrl);
    if (!fileId) return;

    await fetch(
      `${APPWRITE_CONFIG.endpoint}/storage/buckets/${APPWRITE_CONFIG.bucketId}/files/${fileId}`,
      {
        method: "DELETE",
        headers: {
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
      }
    );
  } catch {
    // falha silenciosa na remoção
  }
}

/** Extrai o fileId de uma URL de visualização do Appwrite. */
function extractFileId(imageUrl: string): string | null {
  try {
    const match = imageUrl.match(/\/files\/([^/?]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
