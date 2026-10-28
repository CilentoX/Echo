/**
 * Logout da sessão atual (B2 do audit): o botão "Sair da conta" das
 * Configurações precisa voltar ao login — mas o SessionGate é quem decide
 * a view. Este módulo é a ponte: o Gate registra seu handler de rejeição
 * (stopSyncWiring + clearSession + view login) e qualquer tela chama
 * `performLogout()` sem conhecer o Gate.
 */

let logoutHandler: (() => Promise<void>) | null = null;

/** SessionGate registra/desregistra o handler real de logout. */
export function registerLogoutHandler(handler: (() => Promise<void>) | null): void {
  logoutHandler = handler;
}

/** True quando há um Gate ativo — usado para habilitar/desabilitar o botão. */
export function isLogoutAvailable(): boolean {
  return logoutHandler !== null;
}

/** Sai da conta: desliga o sync, limpa o keyring e volta para o login. */
export async function performLogout(): Promise<void> {
  await logoutHandler?.();
}
