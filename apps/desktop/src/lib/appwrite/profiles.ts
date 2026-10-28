import { APPWRITE_CONFIG } from "./config";

/**
 * Estrutura do documento de perfil global no Appwrite Database.
 * Roles NÃO estão aqui — são por guilda (Matrix power levels).
 */
export interface GlobalProfile {
  /** ID do documento no Appwrite (usamos o MXID como documentId) */
  $id: string;
  /** MXID do usuário (ex: @user:echo.litteris.online) */
  userId: string;
  /** URL da imagem do avatar no Appwrite Storage */
  avatarUrl?: string | null;
  /** URL da imagem do banner no Appwrite Storage */
  bannerUrl?: string | null;
  /** Bio/descrição do usuário */
  bio?: string | null;
  /** Links sociais (GitHub, Twitter, etc.) */
  links?: Array<{ label: string; url: string }>;
  /** Timestamp de criação (ISO) */
  $createdAt: string;
  /** Timestamp de última atualização (ISO) */
  $updatedAt: string;
}

/** Input para criar/atualizar perfil (omit $id, $createdAt, $updatedAt) */
export type GlobalProfileInput = Omit<GlobalProfile, "$id" | "$createdAt" | "$updatedAt">;

/**
 * Busca o perfil global de um usuário pelo MXID.
 * Retorna null se não existir.
 */
export async function getGlobalProfile(userId: string): Promise<GlobalProfile | null> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.profilesCollectionId}/documents/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers: {
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
      }
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Appwrite profiles] Get falhou:", response.status, errorText);
      throw new Error(`Appwrite get profile failed: ${errorText}`);
    }

    return (await response.json()) as GlobalProfile;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    console.error("[Appwrite profiles] Erro ao buscar perfil:", err);
    return null; // Falha silenciosa — não bloqueia a UI
  }
}

/**
 * Cria ou atualiza o perfil global do usuário.
 * Usa o MXID como documentId (upsert).
 */
export async function upsertGlobalProfile(input: GlobalProfileInput): Promise<GlobalProfile> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.profilesCollectionId}/documents/${encodeURIComponent(input.userId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
        body: JSON.stringify({
          data: {
            userId: input.userId,
            avatarUrl: input.avatarUrl ?? null,
            bannerUrl: input.bannerUrl ?? null,
            bio: input.bio ?? null,
            links: input.links ?? [],
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Appwrite profiles] Upsert falhou:", response.status, errorText);
      throw new Error(`Appwrite upsert profile failed: ${errorText}`);
    }

    return (await response.json()) as GlobalProfile;
  } catch (err) {
    console.error("[Appwrite profiles] Erro ao salvar perfil:", err);
    throw err;
  }
}

/**
 * Atualiza parcialmente o perfil global (apenas campos fornecidos).
 */
export async function patchGlobalProfile(
  userId: string,
  patch: Partial<Omit<GlobalProfileInput, "userId">>
): Promise<GlobalProfile> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.profilesCollectionId}/documents/${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
        body: JSON.stringify({ data: patch }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Appwrite profiles] Patch falhou:", response.status, errorText);
      throw new Error(`Appwrite patch profile failed: ${errorText}`);
    }

    return (await response.json()) as GlobalProfile;
  } catch (err) {
    console.error("[Appwrite profiles] Erro ao atualizar perfil:", err);
    throw err;
  }
}

/**
 * Remove o perfil global do usuário.
 */
export async function deleteGlobalProfile(userId: string): Promise<void> {
  try {
    await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.profilesCollectionId}/documents/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: {
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
      }
    );
  } catch {
    // falha silenciosa
  }
}