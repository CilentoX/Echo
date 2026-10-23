import { check as checkPluginUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import { useUpdateStore } from "@/stores/updateStore";

/**
 * Auto-atualização (Task 12) — caminho único via tauri-plugin-updater.
 *
 * O plugin consulta o endpoint configurado em `src-tauri/tauri.conf.json`
 * (`plugins.updater.endpoints` → latest.json), compara com a versão do app e
 * baixa/instala em background; a atualização entra em vigor no próximo
 * restart. O progresso é anunciado ao `updateStore` para o banner visual
 * (UpdateBanner) — o boot nunca quebra, falhas são silenciosas.
 */

/** Baixa e instala a atualização, anunciando o progresso ao store.
 * Retorna true se instalou, false se não havia update ou falhou — nunca lança. */
export async function downloadAndInstall(): Promise<boolean> {
  try {
    const update = await checkPluginUpdate();
    if (!update) {
      // Sem atualização disponível: o banner de "verificando" some.
      useUpdateStore.getState().reset();
      return false;
    }
    useUpdateStore.getState().beginDownload(update.version);
    await update.downloadAndInstall();
    useUpdateStore.getState().markReady();
    return true;
  } catch {
    // Falha de rede/endpoint: aborta silenciosamente, sem banner eterno.
    console.warn("[updater] download da atualização falhou");
    useUpdateStore.getState().reset();
    return false;
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Hook de boot do App: checa e instala silenciosamente, sem jamais quebrar o boot.
 * Anuncia o estado "checking" no store para o UpdateBanner mostrar o banner.
 *
 * `timeoutMs` evita a splash infinita: se o endpoint demorar (rede lenta,
 * Cloudflare fora), o boot segue e o download continua em background —
 * quando terminar, o banner assume ("Reiniciar agora"). */
export async function runStartupUpdateCheck(timeoutMs = 10_000): Promise<void> {
  if (!isTauri()) return;
  useUpdateStore.getState().beginCheck();
  await Promise.race([
    downloadAndInstall(), // nunca lança
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Reinicia o app já atualizado (botão "Reiniciar agora" do banner).
 * Fora do runtime Tauri é um no-op silencioso. */
export async function restartApp(): Promise<void> {
  if (!isTauri()) return;
  await relaunch();
}
