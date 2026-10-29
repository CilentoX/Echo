import { PROFILE_API_CONFIG } from "./config";

/**
 * Estrutura do perfil global (retornado pela Profile API).
 * Roles NÃO estão aqui — são por guilda (Matrix power levels).
 */
export interface GlobalProfile {
  user_id: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  links: Array<{ label: string; url: string }> | null;
  created_at: string;
  updated_at: string;
}

/** Input para criar/atualizar perfil */
export type GlobalProfileInput = {
  userId: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  links?: Array<{ label: string; url: string }>;
};

/**
 * Busca o perfil global de um usuário pelo MXID.
 * Retorna null se não existir (404).
 */
export async function getGlobalProfile(userId: string, accessToken?: string): Promise<GlobalProfile | null> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    const response = await fetch(
      `${PROFILE_API_CONFIG.baseUrl}/api/profiles/${encodeURIComponent(userId)}`,
      {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
      }
    );

    if (response.status === 404) return null;
    if (!response.ok) {
      console.error("[Profile API] Get falhou:", response.status);
      return null;
    }

    return (await response.json()) as GlobalProfile;
  } catch (err) {
    console.error("[Profile API] Erro ao buscar perfil:", err);
    return null; // Falha silenciosa — não bloqueia a UI
  }
}

/**
 * Cria ou atualiza o perfil global do usuário (upsert).
 * Usa o MXID como primary key.
 */
export async function upsertGlobalProfile(input: GlobalProfileInput, accessToken?: string): Promise<GlobalProfile> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(
    `${PROFILE_API_CONFIG.baseUrl}/api/profiles/${encodeURIComponent(input.userId)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        avatar_url: input.avatarUrl ?? null,
        banner_url: input.bannerUrl ?? null,
        bio: input.bio ?? null,
        links: input.links ?? null,
      }),
      signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Profile API] Upsert falhou:", response.status, errorText);
    throw new Error(`Profile API upsert failed: ${errorText}`);
  }

  return (await response.json()) as GlobalProfile;
}

/**
 * Atualiza parcialmente o perfil global (apenas campos fornecidos).
 */
export async function patchGlobalProfile(
  userId: string,
  patch: { avatarUrl?: string | null; bannerUrl?: string | null; bio?: string | null; links?: Array<{ label: string; url: string }> },
  accessToken?: string
): Promise<GlobalProfile> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  const response = await fetch(
    `${PROFILE_API_CONFIG.baseUrl}/api/profiles/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        avatar_url: patch.avatarUrl,
        banner_url: patch.bannerUrl,
        bio: patch.bio,
        links: patch.links,
      }),
      signal: AbortSignal.timeout(PROFILE_API_CONFIG.timeout),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Profile API] Patch falhou:", response.status, errorText);
    throw new Error(`Profile API patch failed: ${errorText}`);
  }

  return (await response.json()) as GlobalProfile;
}

/**
 * Remove o perfil global do usuário.
 */
export async function deleteGlobalProfile(userId: string): Promise<void> {
  try {
    await fetch(
      `${PROFILE_API_CONFIG.baseUrl}/api/profiles/${encodeURIComponent(userId)}`,
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

/**
 * Inicializa a conexão com a Profile API.
 */
export async function initProfileApi(): Promise<void> {
  await pingProfileApi();
}