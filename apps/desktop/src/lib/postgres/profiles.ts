import { POSTGRES_CONFIG } from "./config";

/**
 * Estrutura do perfil global no PostgreSQL.
 * Roles NÃO estão aqui — são por guilda (Matrix power levels).
 */
export interface GlobalProfile {
  /** ID do documento (usamos o MXID como primary key) */
  user_id: string;
  /** URL do avatar no storage (Appwrite/CDN) */
  avatar_url: string | null;
  /** URL do banner no storage (Appwrite/CDN) */
  banner_url: string | null;
  /** Bio/descrição do usuário */
  bio: string | null;
  /** Links sociais (GitHub, Twitter, etc.) */
  links: Array<{ label: string; url: string }> | null;
  /** Timestamp de criação */
  created_at: string;
  /** Timestamp de última atualização */
  updated_at: string;
}

/** Input para criar/atualizar perfil */
export type GlobalProfileInput = Omit<GlobalProfile, "created_at" | "updated_at">;

/**
 * Pool de conexões PostgreSQL (lazy initialization).
 */
let pool: ReturnType<typeof import("pg").Pool> | null = null;

function getPool() {
  if (!pool) {
    const { Pool } = require("pg");
    pool = new Pool({
      connectionString: POSTGRES_CONFIG.connectionString,
      max: POSTGRES_CONFIG.max,
      idleTimeoutMillis: POSTGRES_CONFIG.idleTimeoutMillis,
      connectionTimeoutMillis: POSTGRES_CONFIG.connectionTimeoutMillis,
    });
  }
  return pool;
}

/**
 * Busca o perfil global de um usuário pelo MXID.
 * Retorna null se não existir.
 */
export async function getGlobalProfile(userId: string): Promise<GlobalProfile | null> {
  const pool = getPool();
  try {
    const result = await pool.query(
      "SELECT user_id, avatar_url, banner_url, bio, links, created_at, updated_at FROM user_profiles WHERE user_id = $1",
      [userId]
    );
    if (result.rows.length === 0) return null;
    return result.rows[0] as GlobalProfile;
  } catch (err) {
    console.error("[PostgreSQL profiles] Get falhou:", err);
    return null; // Falha silenciosa — não bloqueia a UI
  }
}

/**
 * Cria ou atualiza o perfil global do usuário (upsert).
 * Usa o MXID como primary key.
 */
export async function upsertGlobalProfile(input: GlobalProfileInput): Promise<GlobalProfile> {
  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO user_profiles (user_id, avatar_url, banner_url, bio, links, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         avatar_url = EXCLUDED.avatar_url,
         banner_url = EXCLUDED.banner_url,
         bio = EXCLUDED.bio,
         links = EXCLUDED.links,
         updated_at = NOW()
       RETURNING user_id, avatar_url, banner_url, bio, links, created_at, updated_at`,
      [input.userId, input.avatarUrl, input.bannerUrl, input.bio, JSON.stringify(input.links ?? [])]
    );
    return result.rows[0] as GlobalProfile;
  } catch (err) {
    console.error("[PostgreSQL profiles] Upsert falhou:", err);
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
  const pool = getPool();
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (patch.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(patch.avatarUrl);
  }
  if (patch.bannerUrl !== undefined) {
    fields.push(`banner_url = $${paramIndex++}`);
    values.push(patch.bannerUrl);
  }
  if (patch.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(patch.bio);
  }
  if (patch.links !== undefined) {
    fields.push(`links = $${paramIndex++}`);
    values.push(JSON.stringify(patch.links ?? []));
  }

  if (fields.length === 0) {
    // Nada para atualizar, busca o atual
    const current = await getGlobalProfile(userId);
    if (!current) throw new Error("Profile not found");
    return current;
  }

  fields.push(`updated_at = NOW()`);
  values.push(userId); // para o WHERE

  const pool_ = getPool();
  try {
    const result = await pool_.query(
      `UPDATE user_profiles SET ${fields.join(", ")} WHERE user_id = $${paramIndex} RETURNING user_id, avatar_url, banner_url, bio, links, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) throw new Error("Profile not found");
    return result.rows[0] as GlobalProfile;
  } catch (err) {
    console.error("[PostgreSQL profiles] Patch falhou:", err);
    throw err;
  }
}

/**
 * Remove o perfil global do usuário.
 */
export async function deleteGlobalProfile(userId: string): Promise<void> {
  const pool = getPool();
  try {
    await pool.query("DELETE FROM user_profiles WHERE user_id = $1", [userId]);
  } catch {
    // falha silenciosa
  }
}

/**
 * Inicializa a tabela user_profiles (executa uma vez na inicialização).
 */
export async function initUserProfilesTable(): Promise<void> {
  const pool = getPool();
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id VARCHAR(255) PRIMARY KEY,
        avatar_url TEXT,
        banner_url TEXT,
        bio TEXT,
        links JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
    `);
    console.log("[PostgreSQL] Tabela user_profiles verificada/criada");
  } catch (err) {
    console.error("[PostgreSQL] Erro ao criar tabela user_profiles:", err);
    throw err;
  }
}