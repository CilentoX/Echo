# Design — Echo Desktop (reconstrução do zero)

**Data:** 2026-10-24  
**Projeto:** Echo Desktop — cliente de chat tipo Discord/Element usando Matrix  
**Autor:** IA (assistente), com entradas do humano via formulário  
**Status:** Rascunho para aprovação do humano

---

## 1. Intenção e por que

O humano quer reconstruir o Echo Desktop do zero porque a interface está sempre quebrada, há erros de TypeScript constantes, testes falhando e funcionalidades faltando. A maior dor é: "interfaces sempre quebradas. não parece que a ia entendeu o que preciso. quero algo bonito e funcional."

O objetivo não é adicionar novas funcionalidades além do que já existe — é reescrever o que existe de forma que funcione, seja visualmente correto (verde água #0FB9A8 da logo, sem emojis como ícones, sem cores hardcoded), componentes pequenos e separados, `tsc --noEmit` com 0 erros e `vitest` 100% passando.

---

## 2. Goals (o que entra)

| # | Goal |
|---|------|
| G1 | `tsc --noEmit` → 0 erros |
| G2 | `vitest run` → 100% dos testes passando (baseline atual: 180/180) |
| G3 | Cor de destaque: verde água #0FB9A8 (--acc) e #0D9E8A (--acc-press), definidos em tokens.css |
| G4 | Sem emojis como ícones estruturais — usar Phosphor Icons consistentemente |
| G5 | Sem cores hardcoded — todas as cores via tokens CSS (--bg, --rail, --surf, --acc, etc.) |
| G6 | Componentes separados em arquivos pequenos e de responsabilidade única |
| G7 | Interface bonita e funcional: onboarding, home sem guildas, profile, settings, updater, shell, chat |
| G8 | Manter as funcionalidades que já existem (não criar novas) |

**Decisões do usuário (formulário + confirmações):**
- Abordagem: **refatoração incremental** dos arquivos existentes (não greenfield total)
- Fonte de verdade: documentos existentes + **UI do Discord como referência de comportamento/UX** (quer algo "bem identico porém com nossa identidade visual")
- Testes: **decide o builder** (reescrever contra comportamento pretendido, não congelar bugs atuais)
- Dados locais: **pode zerar tudo** (reset de sessão/settings aceitável)
- Updater: **deve ser real** (teste de atualização end-to-end, não apenas mock)
- Novas dependências: **permitidas caso necessário**

---

## 9. Referência visual e comportamental (Discord)

A UI deve espelhar o Discord em layout e fluxo, com identidade visual do Echo (verde água #0FB9A8 em vez de blurple, tema escuro OLED):

| Elemento Discord | Equivalente Echo |
|------------------|------------------|
| Sidebar esquerda (servidores/guildas) | CommunityRail + guild selector |
| Sidebar direita (membros) | MemberList + MemberDropdownContent |
| Área central (chat) | ChatPane + MessageBubble + Composer |
| Header (nome do canal + notificações) | AppShell header |
| Modal de criar servidor | CreateGuildModal (shadcn/ui Dialog) |
| Modal de editar servidor | EditGuildModal (shadcn/ui Dialog) |
| Perfil do usuário | Profile (view + edit via toggle) |
| Configurações de usuário | Settings (sidebar de abas) |
| Status online/idle/dnd/offline | Tokens --online/--idle/--dnd/--offline |
| Botões primários (cor da marca) | --acc #0FB9A8, hover --acc-press #0D9E8A |

---

## 3. Non-goals (o que fica de fora por ora)

| # | Non-goal |
|---|----------|
| NG1 | Novas funcionalidades além do que já existe no código atual |
| NG2 | (removido — novas dependências são permitidas caso necessário) |
| NG3 | Suporte a mobile/tablet (desktop only, Tauri) |
| NG4 | Mudar de framework (React + Tauri + Vite + Tailwind + Zustand se mantêm) |

---

## 4. Anti-goals (explícitos do formulário)

| # | Anti-goal |
|---|-----------|
| AG1 | Não adicionar novas funcionalidades além do que já existe |
| AG2 | (removido — novas dependências externas são permitidas caso necessário) |

---

## 5. Constraints (restrições)

| # | Restrição |
|---|-----------|
| C1 | Stack atual: React 19, TypeScript ~6, Vite 8, Tailwind 4, Zustand 5, Radix UI, Phosphor Icons, Lucide, Matrix JS SDK, Tauri 2 |
| C2 | Cor da logo confirmada via PIL: #0FB9A8 (verde água) |
| C3 | Todos os arquivos de componente devem ser pequenos e testáveis |
| C4 | Todos os componentes públicos precisam de teste Vitest correspondente |
| C5 | Commit em Conventional Commits (inglês) |

---

## 6. Arquitetura de pastas (proposta)

```
src/
├── lib/                 # lógica pura, sem React
│   ├── matrix/          # serviço Matrix, instância, tipos, SSO
│   ├── media/           # mxc, dispositivos, upload
│   ├── storage/         # keyring
│   ├── updater.ts       # sistema de atualização (Tauri updater)
│   ├── design-tokens.ts # tokens exportados para JS
│   └── utils.ts
├── stores/              # Zustand stores
│   ├── settingsStore.ts
│   ├── profileStore.ts
│   ├── onboardingStore.ts
│   ├── syncStore.ts
│   ├── uiStore.ts
│   └── updateStore.ts
├── components/ui/       # shadcn/ui primitives (button, dialog, checkbox, etc.)
├── components/media/    # MxcImage, ImageUploadWithCrop, ImageCropModal
├── components/onboarding/ # ProfileForm, AvatarUpload
├── features/
│   ├── auth/            # SessionGate, OnboardingScreen, GoogleLoginScreen, logout
│   ├── profile/         # Profile (view + edit em um só componente, toggle editing)
│   ├── settings/        # Settings (sidebar de configurações)
│   ├── guild/           # CreateGuildModal, EditGuildModal, CreateChannelModal
│   ├── shell/           # AppShell, ChannelSidebar, MemberList, MemberDropdownContent, CommunityRail, ChatPane, EmptyState, UpdateBanner, SyncStatusIndicator
│   └── chat/            # MessageBubble, MessageBody, Composer, TypingIndicator, etc.
├── styles/
│   └── tokens.css       # fonte única de verdade de cores/fonts
├── App.tsx              # raiz: TooltipProvider + SessionGate + shell
├── main.tsx             # entry React
└── vite-env.d.ts
```

---

## 7. Decisões de "how" já tomadas (pelas respostas + trabalho anterior)

| Decisão | Justificativa |
|---------|---------------|
| Manter React + Tauri + Vite | Stack atual, humano não pediu mudança |
| Manter Tailwind 4 com `@theme inline` em tokens.css | Já funciona, tokens são a fonte única de verdade |
| Cor --acc = #0FB9A8 | Confirmada via análise de pixels do logo.png |
| Ícones Phosphor (não emojis, não Lucide misturado sem motivo) | Consistência visual; já usado na maioria dos componentes |
| shadcn/ui primitives (Dialog, Button, Checkbox, Input, etc.) | Já criados e funcionando; acessíveis por padrão |
| Zustand para estado global | Já configurado e funcionando |
| Vitest + jsdom para testes | Baseline 180/180 já passando; manter |
| Conventional Commits em inglês | Exigido pelo humano |

---

## 8. O que fica para o builder (decisiones ainda abertas)

Essas são coisas que o documento deixa abertas e o construtor pode decidir, ou que precisam de confirmação do humano:

1. **Ordem exata de reconstrução**: o humano listou "sistema de updater, tela de onboarding, home sem guildas, perfil, configurações, basicamente tudo". Não há prioridade definida entre eles.
2. **Se Profile continua sendo um único componente (view + edit via toggle) ou se separa em ProfileView + ProfileEdit**: atualmente é um só; o humano pode querer separar.
3. **Se o OnboardingScreen precisa de etapas (welcome → servidor → perfil) ou é uma tela única**: existe OnboardingScreen + ProfileForm + AvatarUpload, mas o fluxo exato não está definido.
4. **Se o UpdateBanner/updater usa Tauri plugin-updater diretamente ou uma camada própria**: existe `lib/updater.ts` e `stores/updateStore.ts`, mas a integração com Tauri pode ser revisada.
5. **Se home sem guildas mostra um EmptyState específico ou reutiliza o existente**: existe `EmptyState.tsx` mas pode precisar de variante para "sem guildas".

---

## 9. Critérios de aceitação (Definition of Done)

Antes de considerar a reconstrução concluída, todas essas condições devem ser verdade:

- [ ] `npx tsc --noEmit` → 0 erros
- [ ] `npx vitest run` → 100% passando (não menos que o baseline atual)
- [ ] Nenhuma cor hardcoded (hex direto) em componentes — tudo via `var(--*)` ou classes Tailwind de token
- [ ] Nenhum emoji usado como ícone estrutural
- [ ] Cor de destaque visível: #0FB9A8 em botões primários, focos, badges ativos
- [ ] Cada componente em arquivo próprio, com responsabilidade única
- [ ] Todo componente novo/existente tem teste Vitest correspondente
- [ ] Interface funciona: onboarding abre, settings abre, profile abre e edita, guildas podem ser criadas/editadas

---

**Próximo passo:** aguardar aprovação deste documento pelo humano. Após aprovação, enviar para builder check (subagent) e, só então, escrever o plano de implementação com `writing-plans`.
