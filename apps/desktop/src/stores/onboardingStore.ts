import { create } from "zustand";

/**
 * Estado do onboarding de primeiro acesso.
 *
 * `completed` — true quando o usuário já terminou o onboarding (perfil definido).
 * É persistido no keyring (via lib/onboarding) para não reapresentar a tela.
 */
interface OnboardingState {
  completed: boolean | null; // null = não verificado ainda
  setCompleted: (done: boolean) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: null,
  setCompleted: (done) => set({ completed: done }),
  reset: () => set({ completed: null }),
}));
