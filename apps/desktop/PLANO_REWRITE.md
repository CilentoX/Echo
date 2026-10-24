# Plano de Reescrita — Echo Desktop

## Objetivos
1. Componentes mais modulares (padrão shadcn/ui) — reutilizáveis e consistentes.
2. Tela forçada de check de atualizações antes de iniciar (estilo Discord) — splash checa e baixa antes de liberar o shell.
3. Onboarding na primeira vez — editar perfil (nick, foto) antes de entrar no shell.

## Fluxo de boot novo

```
booting (splash forçada: checando update)
  │
  ├─ update pronto → reiniciar / botão "Reiniciar agora"
  ├─ sem sessão → login (Google SSO)
  │     │
  │     └─ login OK → primeiro acesso? → Onboarding (nick + foto) → shell
  │                           └─ já fez onboarding? → shell
  └─ tem sessão → shell direto
```

## Arquivos

### Novos
- `src/stores/onboardingStore.ts` — Zustand: `hasCompletedOnboarding`, `setCompleted`, `pendingProfile`
- `src/lib/onboarding.ts` — util: `isFirstLaunch()`, `saveOnboardingDone()`
- `src/features/auth/OnboardingScreen.tsx` — tela de onboarding (container)
- `src/components/onboarding/ProfileForm.tsx` — formulário nick + avatar (shadcn/ui modular)
- `src/components/onboarding/AvatarUpload.tsx` — upload/corte de avatar

### Modificados
- `src/features/auth/SessionGate.tsx` — adicionar view "onboarding", tela de update forçada
- `src/App.tsx` — passar shell com onboarding guard

## Regras
- Não adicionar dependências novas sem pedir (shadcn/ui já está via components.json + radix-ui + clsx + cva já instalados).
- Manter matrix-js-sdk v44, Zustand v5, Tailwind v4.
- Commit apenas ao final de cada fase.
- Build apenas local.
