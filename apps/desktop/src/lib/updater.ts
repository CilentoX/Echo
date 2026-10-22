import { check as checkPluginUpdate } from "@tauri-apps/plugin-updater";

/**
 * Auto-atualização silenciosa (Task 12) — caminho único.
 *
 * Todo o fluxo passa pelo tauri-plugin-updater: o plugin consulta o endpoint
 * configurado em `src-tauri/tauri.conf.json` (`plugins.updater.endpoints`),
 * compara com a versão do app e baixa/instala em background; a atualização
 * entra em vigor no próximo restart. Não há fetch manual do `latest.json`
 * no frontend (o plugin já faz a checagem — um segundo fetch era código
 * morto e foi removido na revisão da Fase 1).
 */

/** Baixa e instala a atualização silenciosamente (sem diálogo/progresso);
 *  aplica no próximo restart. Retorna true se instalou, false se não havia
 *  update ou falhou — nunca lança. */
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
  await downloadAndInstall(); // downloadAndInstall nunca lança
}
