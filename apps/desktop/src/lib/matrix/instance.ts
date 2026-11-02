import { EchoApi } from "@/lib/api/echoApi";
import { loadSession } from "@/lib/storage/keyring";
import { ECHO_API_CONFIG } from "@/lib/api/config";

/**
 * Singleton EchoApi for the app: client factory padrão
 * (Echo API client) apontando para a Echo API.
 * SessionGate, stores e telas compartilham esta mesma instância,
 * para que o client credentialled criado no login seja o mesmo usado
 * na sincronização.
 */
export const echoApi = new EchoApi({
  baseUrl: ECHO_API_CONFIG.baseUrl,
  accessToken: "",
});

// Register on globalThis so useEchoApi() (in echoApi.ts) can find it
// without a circular import cycle.
if (typeof globalThis !== "undefined") {
  (globalThis as any).__echoApiInstance = echoApi;
}

/**
 * Alias para echoApi para compatibilidade gradual com imports de matrixService.
 * Isso permite que código antigo importe matrixService deste módulo enquanto
 * o novo código usa echoApi diretamente.
 */
export const matrixService = echoApi;

/**
 * Inicializa o echoApi com o token de sessão persistido.
 * Chamar após o login bem-sucedido.
 */
export async function initEchoApiFromSession(): Promise<void> {
  const session = await loadSession();
  if (session) {
    echoApi.setAccessToken(session.accessToken ?? "", session.userId ?? undefined);
    // apiKey is optional; if the middleware requires it, configure here.
  }
}