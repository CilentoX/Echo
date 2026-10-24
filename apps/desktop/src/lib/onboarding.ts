
const ONBOARDING_KEY = "echo:onboarding:completed";

/**
 * Verifica se o onboarding já foi concluído para esta conta.
 * Chaveado por userId para não pular o onboarding de outra conta
 * na mesma máquina.
 */
export function isOnboardingCompleted(userId?: string): boolean {
  if (typeof window === "undefined") return false;
  if (!userId) return false;
  try {
    const raw = localStorage.getItem(`${ONBOARDING_KEY}:${userId}`);
    return raw === "1";
  } catch {
    return false;
  }
}

/**
 * Marca o onboarding como concluído para esta conta.
 */
export function markOnboardingCompleted(userId?: string): void {
  if (typeof window === "undefined") return;
  if (!userId) return;
  try {
    localStorage.setItem(`${ONBOARDING_KEY}:${userId}`, "1");
  } catch {
    // falha silenciosa — onboarding reapresentará no próximo boot
  }
}

/**
 * Limpa a flag de onboarding (útil para testes / reset de conta).
 */
export function resetOnboarding(userId?: string): void {
  if (typeof window === "undefined") return;
  if (!userId) return;
  try {
    localStorage.removeItem(`${ONBOARDING_KEY}:${userId}`);
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
export async function isNewAccount(matrixService: { getDisplayName?: (userId?: string) => Promise<string | null>; getAvatarUrl?: (userId?: string) => Promise<string | null> }): Promise<boolean> {
  const [displayName, avatarUrl] = await Promise.all([
    matrixService.getDisplayName?.(),
    matrixService.getAvatarUrl?.(),
  ]);
  return displayName == null && avatarUrl == null;
}
