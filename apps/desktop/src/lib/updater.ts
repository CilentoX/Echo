import { check as checkPluginUpdate } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke, isTauri as coreIsTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { useUpdateStore } from "@/stores/updateStore";

/**
 * Auto-atualização (Task 12) — caminho único via tauri-plugin-updater.
 *
 * O plugin consulta o endpoint configurado em `src-tauri/tauri.conf.json`
 * (`plugins.updater.endpoints` → latest.json), compara com a versão do app e
 * baixa/instala em background; a atualização entra em vigor no próximo
 * restart. O progresso é anunciado ao `updateStore` para a splash
 * e banner visual — o boot nunca quebra, falhas são silenciosas.
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return coreIsTauri() || ("__TAURI_INTERNALS__" in window);
  } catch {
    return false;
  }
}

/** Verifica se há atualização disponível via plugin-updater.
 * Retorna o objeto de update ou null/undefined se não houver.
 * Fora do runtime Tauri, retorna null (sem rede/plugin). */
export async function checkForUpdates(): Promise<{
  version: string;
  downloadAndInstall: (onEvent?: (event: { event: string; data?: any }) => void) => Promise<void>;
} | null> {
  if (!isTauri()) return null;
  try {
    console.log("[updater] Verificando endpoint de releases...");
    const res = await checkPluginUpdate();
    return res as any;
  } catch (err) {
    console.warn("[updater] Falha ao consultar endpoint de atualização:", err);
    return null;
  }
}

/** Baixa e instala a atualização, anunciando o progresso ao store.
 * Retorna true se instalou, false se não havia update ou falhou — nunca lança. */
export async function downloadAndInstall(): Promise<boolean> {
  try {
    const update = await checkForUpdates();
    if (!update) {
      console.log("[updater] Nenhuma atualização pendente (versão mais recente ou ambiente local).");
      useUpdateStore.getState().reset();
      useUpdateStore.getState().setStatusText("SISTEMA ATUALIZADO");
      return false;
    }
    console.log(`[updater] Atualização encontrada: versão ${update.version}. Baixando...`);
    useUpdateStore.getState().beginDownload(update.version);

    let downloaded = 0;
    let contentLength = 0;

    await update.downloadAndInstall((event) => {
      if (!event) return;
      if (event.event === "Started") {
        contentLength = event.data?.contentLength ?? 0;
        console.log(`[updater] Download iniciado: ${contentLength} bytes.`);
      } else if (event.event === "Progress") {
        downloaded += event.data?.chunkLength ?? 0;
        if (contentLength > 0) {
          const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
          useUpdateStore.getState().setProgress(pct);
        }
      } else if (event.event === "Finished") {
        console.log("[updater] Download e instalação concluídos.");
        useUpdateStore.getState().setProgress(100);
      }
    });

    console.log("[updater] Atualização pronta. Marcando para reinicialização.");
    useUpdateStore.getState().markReady();
    return true;
  } catch (error: unknown) {
    console.warn("[updater] Download da atualização falhou (seguindo boot normal):", error);
    useUpdateStore.getState().reset();
    return false;
  }
}

/** Hook de boot do App: checa e instala silenciosamente, sem jamais quebrar o boot.
 * Anuncia o estado "checking" no store para a splash do updater.
 *
 * `timeoutMs` evita a splash infinita: se o endpoint demorar (rede lenta,
 * Cloudflare fora), o boot segue e o download continua em background —
 * quando terminar, o banner assume ("Reiniciar agora"). */
export async function runStartupUpdateCheck(timeoutMs = 10_000): Promise<void> {
  if (!isTauri()) {
    console.log("[updater] Fora do runtime Tauri. Pulando verificação de atualizações.");
    return;
  }
  console.log("[updater] Iniciando checagem de atualizações no startup...");
  useUpdateStore.getState().beginCheck();
  await Promise.race([
    downloadAndInstall(), // nunca lança
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  console.log("[updater] Checagem de startup finalizada.");
}

/** Reinicia o app já atualizado (botão "Reiniciar agora" do banner).
 * Fora do runtime Tauri é um no-op silencioso. */
export async function restartApp(): Promise<void> {
  if (!isTauri()) return;
  console.log("[updater] Relaunching Echo...");
  await relaunch();
}

/** Ajusta a janela nativa para o modo splash do updater (312x380, centralizado, sem bordas). */
export async function setSplashWindowMode(): Promise<void> {
  if (!isTauri()) return;
  try {
    await invoke("set_splash_mode");
  } catch (err) {
    console.warn("[updater] set_splash_mode falhou:", err);
  }
}

/** Ajusta a janela nativa para o tamanho do aplicativo principal (1200x800, redimensionável, centralizado). */
export async function setMainWindowMode(): Promise<void> {
  if (!isTauri()) return;
  try {
    console.log("[updater] Redimensionando para janela principal (1200x800)...");
    await invoke("set_main_mode");
  } catch (err) {
    console.warn("[updater] set_main_mode falhou:", err);
  }
}

/** Fecha a janela atual (botão vermelho da janela splash). */
export async function closeAppWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().close();
  } catch (err) {
    console.warn("[updater] closeAppWindow falhou:", err);
  }
}

/** Minimiza a janela atual (botão amarelo da janela splash). */
export async function minimizeAppWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().minimize();
  } catch (err) {
    console.warn("[updater] minimizeAppWindow falhou:", err);
  }
}

/** Inicia o arrasto da janela quando o usuário clica e arrasta a barra superior da splash. */
export async function startDraggingAppWindow(): Promise<void> {
  if (!isTauri()) return;
  try {
    await getCurrentWindow().startDragging();
  } catch {
    // Ignora se não for suportado
  }
}
