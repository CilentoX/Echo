const ONBOARDING_KEY = "echo:onboarding:completed";

/**
 * Verifica se o onboarding já foi concluído para esta conta.
 * Chaveado por userId para não pular o onboarding de outra conta
 * na mesma máquina.
 */
export function isOnboardingCompleted(userId?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (userId && localStorage.getItem(`${ONBOARDING_KEY}:${userId}`) === "1") {
      return true;
    }
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Marca o onboarding como concluído para esta conta.
 */
export function markOnboardingCompleted(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.setItem(`${ONBOARDING_KEY}:${userId}`, "1");
    }
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // falha silenciosa — onboarding reapresentará no próximo boot
  }
}

/**
 * Limpa a flag de onboarding (útil para testes / reset de conta).
 */
export function resetOnboarding(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(`${ONBOARDING_KEY}:${userId}`);
    }
    localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // no-op
  }
}

/**
 * Verifica se a conta é nova (sem perfil preenchido no servidor Matrix).
 * Chama getDisplayName() e getAvatarUrl() do próprio usuário; se ambos
 * retornarem null, considera-se uma conta recém-criada que precisa de
 * onboarding (nick + foto).
 */
export async function isNewAccount(matrixService: {
  getDisplayName?: (userId?: string) => Promise<string | null>;
  getAvatarUrl?: (userId?: string) => Promise<string | null>;
}): Promise<boolean> {
  const [displayName, avatarUrl] = await Promise.all([
    matrixService.getDisplayName?.(),
    matrixService.getAvatarUrl?.(),
  ]);
  return displayName == null && avatarUrl == null;
}

/**
 * Executa a limpeza completa da conta e do onboarding:
 * - Exclui o perfil no echo-api (PostgreSQL) se autenticado
 * - Limpa as flags de onboarding no localStorage
 * - Limpa a sessão no keyring e localStorage
 * - Limpa o storage da aplicação
 * - Recarrega a aplicação para reiniciar limpo no login
 */
export async function triggerFullAccountReset(echoApiInstance?: {
  deleteMyProfile?: () => Promise<void>;
}): Promise<void> {
  try {
    if (echoApiInstance?.deleteMyProfile) {
      await echoApiInstance.deleteMyProfile().catch(() => {});
    }
  } catch {}

  try {
    const { clearSession } = await import("@/lib/storage/keyring");
    await clearSession();
  } catch {}

  try {
    resetOnboarding();
    if (typeof window !== "undefined") {
      localStorage.clear();
      sessionStorage.clear();
    }
  } catch {}

  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

// Expõe gatilhos globais no console do desenvolvedor (F12)
if (typeof window !== "undefined") {
  const win = window as unknown as Record<string, unknown>;
  win.__resetEchoAccount = () => triggerFullAccountReset();
  win.__resetOnboarding = () => {
    resetOnboarding();
    window.location.reload();
  };
}
