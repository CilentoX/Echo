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
    if (!update) return false;
    useUpdateStore.getState().beginDownload(update.version);
    await update.downloadAndInstall();
    useUpdateStore.getState().markReady();
    return true;
  } catch {
    useUpdateStore.getState().reset();
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

/** Reinicia o app já atualizado (botão "Reiniciar agora" do banner).
 * Fora do runtime Tauri é um no-op silencioso. */
export async function restartApp(): Promise<void> {
  if (!isTauri()) return;
  await relaunch();
}
