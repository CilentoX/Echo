import { getVersion } from "@tauri-apps/api/app";
import { check as checkPluginUpdate } from "@tauri-apps/plugin-updater";

/**
 * Auto-atualização silenciosa (Task 12).
 *
 * - `checkForUpdate()` consulta o manifest publicado em
 *   https://ecoapp.litteris.online/latest.json e compara com a versão do app
 *   (tauri.conf.json). Testável com fetch e versão injetados.
 * - `downloadAndInstall()` usa o tauri-plugin-updater (mesmo endpoint do
 *   tauri.conf.json) para baixar e instalar silenciosamente em background;
 *   a atualização entra em vigor no próximo restart do app.
 * - `runStartupUpdateCheck()` é o hook de boot do App: best-effort, nunca
 *   quebra a inicialização e não roda fora do Tauri (evita fetch em testes/web).
 */

export const UPDATER_ENDPOINT = "https://ecoapp.litteris.online/latest.json";

export interface LatestManifest {
  /** Versão mais recente publicada (semver, ex.: "0.2.0"). */
  version: string;
  notes?: string;
  pub_date?: string;
  platforms?: Record<string, { signature: string; url: string }>;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
}

export interface CheckForUpdateOptions {
  /** Injetável para testes; padrão: versão do binário via getVersion(). */
  currentVersion?: string;
  /** Injetável para testes; padrão: fetch global. */
  fetchImpl?: typeof fetch;
}

/**
 * Compara duas versões numéricas separadas por ponto ("1.2.10" > "1.2.9").
 * Partes ausentes contam como 0; igualdade → false (sem downgrade/ping).
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(".")
      .map((part) => {
        const n = Number.parseInt(part, 10);
        return Number.isNaN(n) ? 0 : n;
      });
  const a = parse(candidate);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai !== bi) return ai > bi;
  }
  return false;
}

/** Baixa o manifest de atualização; null se indisponível ou resposta inválida. */
export async function fetchLatest(
  fetchImpl: typeof fetch = fetch,
): Promise<LatestManifest | null> {
  const res = await fetchImpl(UPDATER_ENDPOINT, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as LatestManifest;
  if (!data || typeof data.version !== "string") return null;
  return data;
}

/**
 * Verifica se há atualização. Nunca lança: qualquer falha de rede/parse
 * resulta em `updateAvailable: false` com `latestVersion: null`.
 */
export async function checkForUpdate(
  opts: CheckForUpdateOptions = {},
): Promise<UpdateCheckResult> {
  let currentVersion = opts.currentVersion ?? "0.0.0";
  if (opts.currentVersion === undefined) {
    try {
      currentVersion = await getVersion();
    } catch {
      // Fora do runtime Tauri: mantém o fallback.
    }
  }

  let latestVersion: string | null = null;
  try {
    const manifest = await fetchLatest(opts.fetchImpl);
    latestVersion = manifest?.version ?? null;
  } catch {
    // Endpoint indisponível: sem update.
  }

  return {
    updateAvailable:
      latestVersion !== null && isNewerVersion(latestVersion, currentVersion),
    currentVersion,
    latestVersion,
  };
}

/**
 * Baixa e instala a atualização silenciosamente (sem diálogo/progresso);
 * aplica no próximo restart. Retorna true se instalou, false se não havia
 * update ou falhou — o chamador decide se loga.
 */
export async function downloadAndInstall(): Promise<boolean> {
  try {
    const update = await checkPluginUpdate();
    if (!update) return false;
    await update.downloadAndInstall();
    return true;
  } catch {
    return false;
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Hook de boot do App: checa e instala silenciosamente, sem jamais quebrar o boot. */
export async function runStartupUpdateCheck(): Promise<void> {
  if (!isTauri()) return;
  try {
    const result = await checkForUpdate();
    if (result.updateAvailable) {
      await downloadAndInstall();
    }
  } catch {
    // Best-effort: falha de update não pode impedir o app de abrir.
  }
}
