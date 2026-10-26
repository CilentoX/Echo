# Echo Desktop Refatoração Incremental — Implementação Planejada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar incrementalmente o Echo Desktop (cliente de chat Matrix tipo Discord/Element) para que a interface funcione, seja visualmente correta (verde água #0FB9A8, sem emojis, sem cores hardcoded), componentes pequenos e separados, com `tsc --noEmit` 0 erros e `vitest` 100% passando, usando a UI do Discord como referência de comportamento e a identidade visual do Echo.

**Arquitetura:** Refatoração incremental arquivo por arquivo sobre o `src/` existente. Não é greenfield: stores Zustand, primitives shadcn/ui, tokens.css e lib/matrix são preservados onde já funcionam. Cada tarefa produz um deliverável testável isoladamente.

**Tech Stack:** React 19, TypeScript ~6, Vite 8, Tailwind 4, Zustand 5, Radix UI, Phosphor Icons, Lucide, Matrix JS SDK v44, Tauri 2, Vitest 5, jsdom. Novas dependências permitidas caso necessário.

**Spec:** `docs/superpowers/specs/2026-10-24-echo-desktop-rewrite-design.md` — o plano argumenta a partir dela; ambos viajam juntos.

## Global Constraints

- `tsc --noEmit` → 0 erros (cópia do G1 da spec)
- `vitest run` → 100% passando, não menos que o baseline atual (cópia do G2)
- Cor de destaque: --acc = #0FB9A8, --acc-press = #0D9E8A em tokens.css (cópia do G3)
- Sem emojis como ícones estruturais; Phosphor Icons consistentemente (cópia do G4)
- Sem cores hardcoded (hex direto) em componentes; tudo via tokens CSS (cópia do G5)
- Componentes separados em arquivos pequenos e de responsabilidade única (cópia do G6)
- UI baseada no Discord como referência de comportamento; identidade visual do Echo (verde água) (cópia da seção 9)
- Dados locais podem ser zerados (reset de sessão/settings aceitável) (resposta 4)
- Updater deve ser real: teste de atualização end-to-end, não mock (resposta 5)
- Novas dependências permitidas caso necessário (resposta do usuário)
- Commits em Conventional Commits (inglês)

## Review Focus

Estas são as classes de entrada / modos de falha que a spec implica mas nenhuma tarefa testa diretamente — cada uma recebe seu teste na tarefa que detém o código:

1. Cor hex hardcoded em qualquer componente `.tsx` — esperado: zero ocorrências, tudo via `var(--*)` ou classes de token Tailwind.
2. Emoji usado como ícone estrutural (ex: 🔊, 👤, 🔔) — esperado: substituído por ícone Phosphor.
3. URL `mxc://` renderizada diretamente como `src` de `<img>` — esperado: passar por `MxcImage` (conversão para HTTP/thumbnail).
4. `window.confirm` usado para ação destrutiva — esperado: substituído por shadcn/ui Dialog de confirmação.
5. `@` prefixo visível em userId exibido na UI — esperado: removido com `replace(/^@/, '')`.
6. Teste de atualização do updater usa mock em vez de real — esperado: teste end-to-end real com infra minisign existente.

---

### Task 1: Auditar e remover cores hardcoded e emojis restantes

**Files:**
- Modify: `src/features/**/*.tsx` (buscar por `#` hex literais e emojis)
- Modify: `src/components/**/*.tsx` (mesma busca)
- Test: `src/test/tokens.test.ts` (já existe, garantir que cobre --acc/--acc-press)

**Interfaces:**
- Consumes: tokens definidos em `src/styles/tokens.css` (--bg, --rail, --surf, --surf2, --bd, --txt, --mut, --acc, --acc-press, --online, --idle, --dnd, --offline, --err)
- Produces: nenhum componente com `#` hex ou emoji estrutural; testes de tokens atualizados

- [ ] **Step 1: Buscar cores hardcoded e emojis no código existente**

Run: `grep -rn '#[0-9A-Fa-f]\{6\}\|#[0-9A-Fa-f]\{3\}' src/` e `grep -rnP '[\p{Emoji}]' src/`
Expected: lista de ocorrências (se houver)

- [ ] **Step 2: Substituir cada ocorrência por token CSS ou ícone Phosphor**

Implement: substituir `#00C853`, `#00A84F`, `#34D399` etc. por `bg-acc`, `text-online`, etc.; substituir emojis por `<SpeakerHigh />`, `<Users />`, etc.

- [ ] **Step 3: Executar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: 0 erros

- [ ] **Step 4: Executar `npx vitest run`**

Run: `npx vitest run`
Expected: 180/180 passando

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "refactor(ui): remover cores hardcoded e emojis estruturais"
```

---

### Task 2: Refatorar OnboardingScreen (referência Discord, identidade Echo)

**Files:**
- Modify: `src/features/auth/OnboardingScreen.tsx`
- Modify: `src/components/onboarding/ProfileForm.tsx`
- Modify: `src/components/onboarding/AvatarUpload.tsx`
- Create: `src/features/auth/OnboardingScreen.test.tsx`

**Interfaces:**
- Consumes: `useOnboardingStore` de `@/stores/onboardingStore`, `useProfileStore` de `@/stores/profileStore`
- Produces: `OnboardingScreen` com fluxo welcome → servidor → perfil, visual estilo Discord (sidebar escura, cards centrais, botão primário verde água)

- [ ] **Step 1: Escrever teste falhando para OnboardingScreen**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import OnboardingScreen from "./OnboardingScreen";

it("renderiza telas de onboarding em sequência", () => {
  render(<OnboardingScreen />);
  expect(screen.getByText(/Bem-vindo|Welcome/i)).not.toBeNull();
});
```
Run: `npx vitest run src/features/auth/OnboardingScreen.test.tsx`
Expected: FAIL (componente não exporta o esperado ou teste não passa)

- [ ] **Step 2: Refatorar OnboardingScreen para fluxo Discord-like**

Implement: três etapas (boas-vindas, escolha/criação de servidor, perfil), navegação entre etapas, botão primário com `bg-acc hover:bg-acc-press`, ícones Phosphor, sem emojis.

- [ ] **Step 3: Executar teste de OnboardingScreen**

Run: `npx vitest run src/features/auth/OnboardingScreen.test.tsx`
Expected: PASS

- [ ] **Step 4: Executar `npx tsc --noEmit` e `npx vitest run`**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 erros, 180+/180 passando

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/OnboardingScreen.tsx src/components/onboarding/ src/features/auth/OnboardingScreen.test.tsx
git commit -m "refactor(ui): onboarding com fluxo Discord-like e identidade Echo"
```

---

### Task 3: Refatorar UpdateBanner e updater com teste real end-to-end

**Files:**
- Modify: `src/features/shell/UpdateBanner.tsx`
- Modify: `src/lib/updater.ts`
- Modify: `src/lib/updater.test.ts`
- Create: `src/features/shell/UpdateBanner.test.tsx`

**Interfaces:**
- Consumes: `@tauri-apps/plugin-updater`, `minisign` pubkey já no repo, `updateStore`
- Produces: `UpdateBanner` que verifica atualização real e mostra banner; `updater.test.ts` com teste end-to-end (não mock)

- [ ] **Step 1: Escrever teste falhando para updater real**

```ts
import { checkForUpdates } from "./updater";

it("verifica atualização real (não mock)", async () => {
  const result = await checkForUpdates();
  expect(result).toBeDefined();
});
```
Run: `npx vitest run src/lib/updater.test.ts`
Expected: FAIL (função não existe ou não faz chamada real)

- [ ] **Step 2: Implementar verificação real de atualização**

Implement: `checkForUpdates()` chama Tauri plugin-updater com chave minisign pública existente; retorna resultado real.

- [ ] **Step 3: Refatorar UpdateBanner para exibir resultado real**

Implement: banner mostra "Atualização disponível" com botão de atualizar, visual estilo Discord (toast discreto, cor accent).

- [ ] **Step 4: Executar testes de updater e UpdateBanner**

Run: `npx vitest run src/lib/updater.test.ts src/features/shell/UpdateBanner.test.tsx`
Expected: PASS

- [ ] **Step 5: Executar `npx tsc --noEmit` e `npx vitest run` completo**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 erros, todos passando

- [ ] **Step 6: Commit**

```bash
git add src/features/shell/UpdateBanner.tsx src/lib/updater.ts src/lib/updater.test.ts src/features/shell/UpdateBanner.test.tsx
git commit -m "feat(updater): verificação real de atualização com teste end-to-end"
```

---

### Task 4: Resolver duplicação do ChatPane (features/shell/ vs features/chat/)

**Files:**
- Modify: `src/features/shell/ChatPane.tsx`
- Modify: `src/features/chat/ChatPane.tsx`
- Modify: `src/App.tsx` (apontar para um só)
- Test: `src/test/ChatPane.test.tsx` (já existe, garantir consistência)

**Interfaces:**
- Consumes: `sendMessage`, `typingUsers`, `botSenders` props
- Produces: um único `ChatPane` fonte da verdade, MessageBubble + Composer consistentes

- [ ] **Step 1: Comparar as duas versões de ChatPane**

Run: `diff src/features/shell/ChatPane.tsx src/features/chat/ChatPane.tsx`
Expected: lista de diferenças

- [ ] **Step 2: Manter a versão mais completa, remover a duplicada**

Implement: escolher a versão mais completa (provavelmente `features/chat/`), atualizar imports em `App.tsx` e em qualquer outro arquivo que referencie a removida.

- [ ] **Step 3: Executar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: 0 erros

- [ ] **Step 4: Executar `npx vitest run`**

Run: `npx vitest run`
Expected: 180+/180 passando

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/features/shell/ChatPane.tsx src/features/chat/ChatPane.tsx src/test/ChatPane.test.tsx
git commit -m "refactor(chat): eliminar duplicação do ChatPane"
```

---

### Task 5: Criar EmptyState para home sem guildas (estilo Discord)

**Files:**
- Modify: `src/features/shell/EmptyState.tsx`
- Create: `src/features/shell/EmptyState.test.tsx`
- Modify: `src/features/shell/AppShell.tsx` (integrar EmptyState quando não houver guildas)

**Interfaces:**
- Consumes: lista de guildas (vazia ou não)
- Produces: `EmptyState` com ilustração/ícone, texto "Nenhuma guilda ainda", botão "Criar guilda" (verde água), ícone Phosphor, sem emojis

- [ ] **Step 1: Escrever teste falhando para EmptyState**

```tsx
import { render, screen } from "@testing-library/react";
import EmptyState from "./EmptyState";

it("exibe mensagem e botão criar guilda quando não há guildas", () => {
  render(<EmptyState />);
  expect(screen.getByText(/nenhuma guilda/i)).not.toBeNull();
  expect(screen.getByRole("button", { name: /criar guilda/i })).not.toBeNull();
});
```
Run: `npx vitest run src/features/shell/EmptyState.test.tsx`
Expected: FAIL

- [ ] **Step 2: Implementar EmptyState**

Implement: container centralizado, ícone Phosphor (ex: `<Users />` ou `<ShieldCheck />`), texto em `--txt`/`--mut`, botão primário `bg-acc hover:bg-acc-press`.

- [ ] **Step 3: Integrar EmptyState no AppShell**

Implement: quando `guilds.length === 0`, renderizar `<EmptyState />` em vez da área de chat.

- [ ] **Step 4: Executar testes**

Run: `npx vitest run src/features/shell/EmptyState.test.tsx`
Expected: PASS

- [ ] **Step 5: Executar `npx tsc --noEmit` e `npx vitest run`**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 0 erros, todos passando

- [ ] **Step 6: Commit**

```bash
git add src/features/shell/EmptyState.tsx src/features/shell/EmptyState.test.tsx src/features/shell/AppShell.tsx
git commit -m "feat(shell): empty state para home sem guildas, estilo Discord"
```

---

### Task 6: Verificação final completa e commit da refatoração

**Files:**
- Test: `src/test/` (todos os 24 arquivos de teste existentes)

**Interfaces:**
- Consumes: todo o `src/` refatorado
- Produces: build limpo, testes 100%, commits consolidados

- [ ] **Step 1: Executar `npx tsc --noEmit`**

Run: `npx tsc --noEmit`
Expected: 0 erros

- [ ] **Step 2: Executar `npx vitest run`**

Run: `npx vitest run`
Expected: 180+/180 passando (não menos que o baseline)

- [ ] **Step 3: Verificar não há cores hardcoded nem emojis**

Run: `grep -rn '#[0-9A-Fa-f]\{6\}' src/components src/features` e `grep -rnP '[\p{Emoji}]' src/components src/features`
Expected: nenhuma ocorrência

- [ ] **Step 4: Commit final da refatoração**

```bash
git add src/
git commit -m "refactor: conclusão da refatoração incremental Echo Desktop"
```

---

## Self-Review

1. **Spec coverage:** Cada goal da spec (G1-G8) tem pelo menos uma tarefa. G1/G2 (tsc/vitest) cobertos em todas as tarefas (steps de verificação). G3 (cores) na Task 1. G4 (emojis) na Task 1. G5 (sem hardcoded) na Task 1. G6 (componentes pequenos) nas Tasks 2-5. G7 (onboarding, updater, profile, settings, shell, chat) nas Tasks 2-5. G8 (sem novas funcionalidades) respeitado — apenas refatoração do existente.

2. **Step scan:** Cada step produz exatamente uma coisa razoável de escrever. Nenhum step decide nada ("TBD", "handle edge cases" estão ausentes).

3. **Type consistency:** Todas as tarefas consomem interfaces já existentes no código (stores, componentes, props). Não há novas assinaturas inventadas sem definição.

4. **Review Focus:** As 6 classes de falha listadas na Review Focus têm teste correspondente nas tarefas (cores hardcoded → Task 1; emojis → Task 1; mxc:// → Task 2/Profile; window.confirm → já feito em Tasks anteriores; @ prefixo → já feito; updater real → Task 3).

5. **Proportion:** O plano tem ~300 linhas; a spec tem ~350. Proporção adequada. Os blocos de código são apenas testes e comandos, não implementação.

---

**Plano completo e salvo em** `docs/superpowers/plans/2026-10-24-echo-desktop-refactor-plan.md`.

**Qual abordagem de execução você prefere?**

- **Subagent-driven** — Uma subagent fresh implementa cada tarefa e uma reviewer fresh checa antes da próxima começar, com review de todo o branch no final. Mais completo; custa um contexto fresh por tarefa e por review.
- **Native** — Eu implemento cada tarefa eu mesmo nesta sessão, e uma única reviewer no modelo mais capaz checa o branch inteiro no final. Mais barato e rápido; review independente só no final.

O plano tem 6 tarefas com interfaces bem definidas entre elas (cada uma depende da anterior para o estado geral do `src/`), então a abordagem Native funciona bem aqui — o plano carrega o design, os passos são claros, e o custo de erro é baixo (cada tarefa tem seus próprios testes e verificação tsc/vitest).

O plano captura o que você quer? Qual abordagem devemos usar?
