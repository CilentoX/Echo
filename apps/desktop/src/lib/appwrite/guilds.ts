import { APPWRITE_CONFIG } from "./config";

/**
 * Estrutura do documento de perfil de guilda no Appwrite Database.
 * Separado da coleção user_profiles — cada guilda tem seu próprio documento.
 */
export interface GuildProfile {
  /** ID do documento no Appwrite (usamos o guildId da Matrix como documentId) */
  $id: string;
  /** ID da guilda na Matrix (roomId do Space, ex: !guildid:echo.litteris.online) */
  guildId: string;
  /** Nome da guilda */
  name: string;
  /** Descrição da guilda */
  description?: string | null;
  /** URL da imagem principal (ícone/avatar) no Appwrite Storage */
  avatarUrl?: string | null;
  /** URL do banner da guilda no Appwrite Storage */
  bannerUrl?: string | null;
  /** ID do criador (MXID) */
  createdBy: string;
  /** Timestamp de criação (ISO) */
  $createdAt: string;
  /** Timestamp de última atualização (ISO) */
  $updatedAt: string;
}

/** Input para criar/atualizar perfil de guilda (omit $id, $createdAt, $updatedAt) */
export type GuildProfileInput = Omit<GuildProfile, "$id" | "$createdAt" | "$updatedAt">;

/**
 * Busca o perfil de uma guilda pelo guildId.
 * Retorna null se não existir.
 */
export async function getGuildProfile(guildId: string): Promise<GuildProfile | null> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.guildsCollectionId}/documents/${encodeURIComponent(guildId)}`,
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
      console.error("[Appwrite guilds] Get falhou:", response.status, errorText);
      throw new Error(`Appwrite get guild profile failed: ${errorText}`);
    }

    return (await response.json()) as GuildProfile;
  } catch (err) {
    if (err instanceof Error && err.message.includes("404")) return null;
    console.error("[Appwrite guilds] Erro ao buscar perfil da guilda:", err);
    return null;
  }
}

/**
 * Cria ou atualiza o perfil de uma guilda.
 * Usa o guildId como documentId (upsert).
 */
export async function upsertGuildProfile(input: GuildProfileInput): Promise<GuildProfile> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.guildsCollectionId}/documents/${encodeURIComponent(input.guildId)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Appwrite-Project": APPWRITE_CONFIG.projectId,
          "X-Appwrite-Key": APPWRITE_CONFIG.apiKey,
        },
        body: JSON.stringify({
          data: {
            guildId: input.guildId,
            name: input.name,
            description: input.description ?? null,
            avatarUrl: input.avatarUrl ?? null,
            bannerUrl: input.bannerUrl ?? null,
            createdBy: input.createdBy,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Appwrite guilds] Upsert falhou:", response.status, errorText);
      throw new Error(`Appwrite upsert guild profile failed: ${errorText}`);
    }

    return (await response.json()) as GuildProfile;
  } catch (err) {
    console.error("[Appwrite guilds] Erro ao salvar perfil da guilda:", err);
    throw err;
  }
}

/**
 * Atualiza parcialmente o perfil de uma guilda (apenas campos fornecidos).
 */
export async function patchGuildProfile(
  guildId: string,
  patch: Partial<Omit<GuildProfileInput, "guildId">>
): Promise<GuildProfile> {
  try {
    const response = await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.guildsCollectionId}/documents/${encodeURIComponent(guildId)}`,
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
      console.error("[Appwrite guilds] Patch falhou:", response.status, errorText);
      throw new Error(`Appwrite patch guild profile failed: ${errorText}`);
    }

    return (await response.json()) as GuildProfile;
  } catch (err) {
    console.error("[Appwrite guilds] Erro ao atualizar perfil da guilda:", err);
    throw err;
  }
}

/**
 * Remove o perfil de uma guilda.
 */
export async function deleteGuildProfile(guildId: string): Promise<void> {
  try {
    await fetch(
      `${APPWRITE_CONFIG.endpoint}/databases/${APPWRITE_CONFIG.databaseId}/collections/${APPWRITE_CONFIG.guildsCollectionId}/documents/${encodeURIComponent(guildId)}`,
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
