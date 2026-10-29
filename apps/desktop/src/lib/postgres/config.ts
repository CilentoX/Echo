/**
 * PostgreSQL configuration for global profiles.
 * Connection string should be set via DATABASE_URL environment variable.
 * Format: postgresql://user:password@host:5432/database?sslmode=require
 */

export const POSTGRES_CONFIG = {
  connectionString: import.meta.env.VITE_DATABASE_URL ?? import.meta.env.DATABASE_URL,
  // Pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

/**
 * Verifies the PostgreSQL connection.
 * Should be called once during app initialization.
 */
export async function pingPostgres(): Promise<void> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: POSTGRES_CONFIG.connectionString,
    max: 1,
  });

  try {
    const result = await pool.query("SELECT NOW()");
    console.log("[PostgreSQL] Conexão OK:", result.rows[0]);
  } catch (err) {
    console.error("[PostgreSQL] Falha na conexão:", err);
    throw err;
  } finally {
    await pool.end();
  }
}