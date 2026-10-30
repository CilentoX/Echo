import { PROFILE_API_CONFIG } from "./config";

/**
 * Estrutura do perfil de guilda (retornado pela Profile API).
 */
export interface GuildProfile {
  guild_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Input para criar/atualizar perfil de guilda */
export type GuildProfileInput = {
  guildId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  createdBy: string;
};

/**
 * Busca o perfil de uma guilda pelo guildId.
 * Retorna null se não existir (404).
 */
export async function getGuildProfile(guildId: string, accessToken?: string): Promise<GuildProfile | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    const response = await fetch(
      `${PROFILE_API_CONFIG.baseUrl}/api/guilds/${encodeURIComponent(guildId)}/profile`,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
      }
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      console.error("[Profile API] Get guild profile falhou:", response.status);
      return null;
    }

    return (await response.json()) as GuildProfile;
  } catch (err) {
    console.error("[Profile API] Erro ao buscar perfil de guilda:", err);
    return null; // Falha silenciosa — não bloqueia a UI
  }
}

/**
 * Cria ou atualiza o perfil de uma guilda (upsert).
 * Usa o guildId como primary key.
 */
export async function upsertGuildProfile(input: GuildProfileInput, accessToken?: string): Promise<GuildProfile> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(
    `${PROFILE_API_CONFIG.baseUrl}/api/guilds/${encodeURIComponent(input.guildId)}/profile`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? null,
        avatar_url: input.avatarUrl ?? null,
        banner_url: input.bannerUrl ?? null,
        created_by: input.createdBy,
      }),
      signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Profile API] Upsert guild profile falhou:", response.status, errorText);
    throw new Error(`Profile API upsert guild profile failed: ${errorText}`);
  }

  return (await response.json()) as GuildProfile;
}

/**
 * Atualiza parcialmente o perfil de uma guilda (apenas campos fornecidos).
 */
export async function patchGuildProfile(
  guildId: string,
  patch: { name?: string; description?: string | null; avatarUrl?: string | null; bannerUrl?: string | null },
  accessToken?: string
): Promise<GuildProfile> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(
    `${PROFILE_API_CONFIG.baseUrl}/api/guilds/${encodeURIComponent(guildId)}/profile`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        name: patch.name,
        description: patch.description,
        avatar_url: patch.avatarUrl,
        banner_url: patch.bannerUrl,
      }),
      signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Profile API] Patch guild profile falhou:", response.status, errorText);
    throw new Error(`Profile API patch guild profile failed: ${errorText}`);
  }

  return (await response.json()) as GuildProfile;
}

/**
 * Remove o perfil de uma guilda.
 */
export async function deleteGuildProfile(guildId: string): Promise<void> {
  try {
    await fetch(
      `${PROFILE_API_CONFIG.baseUrl}/api/guilds/${encodeURIComponent(guildId)}/profile`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
      }
    );
  } catch {
    // falha silenciosa
  }
}
