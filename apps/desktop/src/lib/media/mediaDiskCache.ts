/**
 * Gerenciador de cache local em disco para imagens e mídias do Echo.
 *
 * Arquitetura de Cache Local em Disco:
 * 1. Memory Pool (Nível 1 - 0ms): Map em memória de URL original -> blobUrl
 * 2. CacheStorage / IndexedDB (Nível 2 - Disco Local do Usuário):
 *    Persiste a resposta binária (Blob) diretamente no disco do PC do usuário
 *    (%LOCALAPPDATA%\...\EBWebView\Default\Cache ou IndexedDB local).
 * 3. Network Fetch com Deduplicação:
 *    Se múltiplos componentes solicitarem a mesma foto simultaneamente,
 *    apenas 1 requisição HTTP é feita; todas as chamadas aguardam a mesma Promise.
 * 4. Offline Resilience:
 *    Se a internet cair ou a API falhar, carrega a imagem salva no disco local.
 */

import { useEffect, useState } from "react";
import { mxcToHttp, mxcToThumbnail, mxcToHttpWithAuth, mxcToThumbnailWithAuth } from "./mxc";

const CACHE_NAME = "echo-media-cache-v1";
const IDB_NAME = "echo_media_cache";
const IDB_STORE = "blobs";
const IDB_VERSION = 1;

// Pool em memória para resposta instantânea síncrona
const memoryBlobMap = new Map<string, string>();

// Fila de deduplicação de requisições em voo
const inFlightRequests = new Map<string, Promise<string | null>>();

/** Abre o banco IndexedDB de mídia local de forma segura e defensiva */
function openIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Lê um Blob salvo no disco via IndexedDB */
async function readFromIdb(key: string): Promise<Blob | null> {
  const db = await openIndexedDb();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(key);
      req.onsuccess = () => {
        const result = req.result;
        if (result && result instanceof Blob) {
          resolve(result);
        } else if (result?.blob instanceof Blob) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Salva um Blob no disco local via IndexedDB */
async function saveToIdb(key: string, blob: Blob): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      const store = tx.objectStore(IDB_STORE);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Converte qualquer URL de mídia (mxc:// ou http://) em uma URL HTTP canônica
 */
export function resolveCanonicalMediaUrl(
  inputUrl: string,
  options?: { width?: number; height?: number; useAuth?: boolean },
): string | null {
  if (!inputUrl) return null;

  if (inputUrl.startsWith("data:") || inputUrl.startsWith("blob:")) {
    return inputUrl;
  }

  if (inputUrl.startsWith("mxc://")) {
    const { width, height, useAuth = true } = options ?? {};
    if (width && height) {
      const authThumb = useAuth ? mxcToThumbnailWithAuth(inputUrl, width, height, "crop") : null;
      return authThumb || mxcToThumbnail(inputUrl, width, height, "crop");
    }
    const authHttp = useAuth ? mxcToHttpWithAuth(inputUrl) : null;
    return authHttp || mxcToHttp(inputUrl);
  }

  return inputUrl;
}

/**
 * Obtém a imagem do cache local em disco (CacheStorage / IndexedDB).
 * Se não existir no disco, baixa uma única vez, grava no disco do PC e retorna a URL blob local.
 */
export async function getCachedMediaUrl(
  rawUrl: string | null | undefined,
  options?: { width?: number; height?: number; useAuth?: boolean },
): Promise<string | null> {
  if (!rawUrl) return null;

  const canonicalUrl = resolveCanonicalMediaUrl(rawUrl, options);
  if (!canonicalUrl) return null;

  // data: e blob: já são dados locais em memória
  if (canonicalUrl.startsWith("data:") || canonicalUrl.startsWith("blob:")) {
    return canonicalUrl;
  }

  // 1. Memória rápida (0ms)
  const inMemory = memoryBlobMap.get(canonicalUrl);
  if (inMemory) {
    return inMemory;
  }

  // 2. Deduplicação de requisições em voo
  const pending = inFlightRequests.get(canonicalUrl);
  if (pending) {
    return pending;
  }

  const fetchPromise = (async () => {
    try {
      // 3. Verifica CacheStorage nativo (disco do navegador/Tauri Webview)
      if (typeof window !== "undefined" && "caches" in window && window.caches) {
        try {
          const cache = await window.caches.open(CACHE_NAME);
          const cachedResponse = await cache.match(canonicalUrl);
          if (cachedResponse && cachedResponse.ok) {
            const blob = await cachedResponse.blob();
            const blobUrl = URL.createObjectURL(blob);
            memoryBlobMap.set(canonicalUrl, blobUrl);
            return blobUrl;
          }
        } catch {
          // Ignora falha de CacheStorage
        }
      }

      // 4. Verifica IndexedDB persistente em disco
      const idbBlob = await readFromIdb(canonicalUrl);
      if (idbBlob) {
        const blobUrl = URL.createObjectURL(idbBlob);
        memoryBlobMap.set(canonicalUrl, blobUrl);
        return blobUrl;
      }

      // 5. Busca na rede (apenas se não estiver no disco local)
      const res = await fetch(canonicalUrl);
      if (!res.ok) {
        // Se a rede falhar, retorna a URL original como fallback
        return canonicalUrl;
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      memoryBlobMap.set(canonicalUrl, blobUrl);

      // Grava no CacheStorage do disco em segundo plano
      if (typeof window !== "undefined" && "caches" in window && window.caches) {
        try {
          const cache = await window.caches.open(CACHE_NAME);
          // Cria uma resposta clone com headers adequados
          const cacheResponse = new Response(blob, {
            headers: {
              "Content-Type": blob.type || "image/png",
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
          void cache.put(canonicalUrl, cacheResponse);
        } catch {}
      }

      // Grava no IndexedDB do disco em segundo plano
      void saveToIdb(canonicalUrl, blob);

      return blobUrl;
    } catch {
      // Em caso de falha de conexão ou rede indisponível, devolve a URL original
      return canonicalUrl;
    } finally {
      inFlightRequests.delete(canonicalUrl);
    }
  })();

  inFlightRequests.set(canonicalUrl, fetchPromise);
  return fetchPromise;
}

/**
 * Pré-carrega uma lista de URLs para o disco local em segundo plano
 */
export async function prefetchMedia(urls: (string | null | undefined)[]): Promise<void> {
  const valid = urls.filter((u): u is string => Boolean(u));
  await Promise.allSettled(valid.map((u) => getCachedMediaUrl(u)));
}

/**
 * Limpa todo o cache de mídia em disco e em memória
 */
export async function clearMediaDiskCache(): Promise<void> {
  // Revoga URLs blob da memória
  for (const blobUrl of memoryBlobMap.values()) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {}
  }
  memoryBlobMap.clear();
  inFlightRequests.clear();

  // Limpa CacheStorage
  if (typeof window !== "undefined" && "caches" in window && window.caches) {
    try {
      await window.caches.delete(CACHE_NAME);
    } catch {}
  }

  // Limpa IndexedDB
  const db = await openIndexedDb();
  if (db) {
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).clear();
    } catch {}
  }
}

/**
 * Hook React para obter a URL em cache local com estado de carregamento
 */
export function useCachedMedia(
  url: string | null | undefined,
  options?: { width?: number; height?: number; useAuth?: boolean },
): { src: string | null; loading: boolean } {
  const [cachedSrc, setCachedSrc] = useState<string | null>(() => {
    if (!url) return null;
    const canonical = resolveCanonicalMediaUrl(url, options);
    return canonical ? memoryBlobMap.get(canonical) ?? null : null;
  });
  const [loading, setLoading] = useState<boolean>(!cachedSrc && Boolean(url));

  useEffect(() => {
    if (!url) {
      setCachedSrc(null);
      setLoading(false);
      return;
    }

    const canonical = resolveCanonicalMediaUrl(url, options);
    if (!canonical) {
      setCachedSrc(null);
      setLoading(false);
      return;
    }

    const immediate = memoryBlobMap.get(canonical);
    if (immediate) {
      setCachedSrc(immediate);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    void getCachedMediaUrl(url, options).then((res) => {
      if (!isMounted) return;
      setCachedSrc(res);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [url, options?.width, options?.height, options?.useAuth]);

  return { src: cachedSrc, loading };
}
