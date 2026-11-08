# Diretrizes de Design, UI/UX e Arquitetura do Echo

Este documento define as regras permanentes de arquitetura e design de interface do **Echo**. Qualquer nova funcionalidade, tela ou refatoração deve obedecer rigorosamente a estas diretrizes.

---

## 1. Regra de Ouro da Interface: Ergonomia Discord com Identidade Visual Única do Echo

O Echo adota a ergonomia funcional comprovada do Discord, mas possui uma **identidade visual proprietária, moderna e sofisticada**. Não é uma cópia genérica ou cinza opaca:

### A. Hierarquia de Colunas (Ergonomia Discord)
* **Coluna 1 — Rail de Navegação (72px):** `CommunityRail` fixo à esquerda com o botão Home no topo, separador sutil, guildas do usuário e o botão `+` para criar guilda.
* **Coluna 2 — Sidebar Contextual (232px):**
  * Na Home: `HomeSidebar` dividida com clareza entre navegação pessoal (**Amigos**, **Descobrir**) e a seção **Mensagens Diretas** com lista de DMs.
  * Nas Guildas: `ChannelSidebar` com canais de texto, voz e categorias.
* **Coluna 3 — Área Principal de Conteúdo:** `ChatPane`, `FriendsDashboard` ou visualizações de canal, com rolagem independente e composer no rodapé.
* **Coluna 4 — Painel Lateral Vivo (320px–340px):**
  * Nas Guildas: `MemberList` com membros agrupados por cargo e status.
  * Na Home / Amigos: **Painel Lateral "Ativo Agora & Comunidade"**, exibindo amigos online, status de presença e sugestões de conexão, evitando qualquer sensação de tela vazia.
* **Dock Inferior Persistente (72px):** `UserBar` ancorada no canto inferior esquerdo com Avatar, Nome/Handle, controles de áudio (microfone/fone com indicadores de mudo), indicador de sincronização Matrix e atalhos rápidos para Perfil e Configurações.

### B. Identidade Visual Própria do Echo
* **Dark Glassmorphism Sutil:** Fundos profundos e equilibrados (`#0b0e14`, `#10141d`, `#141923`), bordas finas com transparência (`border-white/[0.04]` a `border-white/[0.08]`) e sombras refinadas.
* **Acento Echo (Teal Glow):** Cor primária `#0FB9A8` com estados de foco suave, glows táteis e badges de destaque.
* **Micro-interações Táteis:** Efeito de compressão ao clique (`active:scale-[0.98]`), transições fluidas `transition-all duration-150` e `cursor-pointer` obrigatório em todo elemento interativo.
* **Sem Vazios Estéreis:** Nenhuma tela deve parecer um bloco preto vazio e deserto. Layouts em duas colunas (como no painel de Amigos com "Ativo Agora") garantem acolhimento, densidade balanceada e informações úteis mesmo quando a lista estiver vazia.

---

## 2. Divisão e Estrutura da Home

A Home é o hub de comunicação pessoal do usuário e deve manter divisões transparentes:
1. **Amigos:** Gerenciamento de contatos (Disponível, Todos, Pendente, Bloqueados, Adicionar) em layout harmonioso com a coluna lateral direita "Ativo Agora".
2. **Descobrir:** Descoberta de novos membros cadastrados na rede descentralizada e sugestões da comunidade.
3. **Mensagens Diretas (DMs):** Lista rápida de conversas 1-a-1 com fotos, badges de presença e última mensagem.

---

## 3. Padrões Técnicos e Qualidade
* **Tipagem Estrita:** TypeScript com verificação estrita (`tsc --noEmit` sempre com 0 erros).
* **Testes Automatizados:** 100% dos testes devem passar (Vitest). Qualquer alteração de componente deve acompanhar testes unitários atualizados.
* **Resiliência de Rede:** Verificações defensivas de sessão e compatibilidade total com o protocolo descentralizado Matrix.

---

## 4. Novo Padrão de Design para Modais, Formulários e Diálogos (Padrão Guild Modal)

Todo modal, sheet ou diálogo de configuração/criação deve seguir a arquitetura visual consagrada no `CreateGuildModal`:

### A. Estrutura do Container
* **Fundo e Borda:** `bg-[#12161f]` profundo, borda fina `border-white/[0.08]`, cantos `rounded-2xl` e sombra profunda `shadow-2xl`.
* **Animação de Entrada:** `animate-in fade-in-0 zoom-in-95 duration-150`.
* **Rolagem Defensiva:** `max-h-[90vh] overflow-y-auto scrollbar-thin p-0 gap-0`.

### B. Cabeçalho Superior Fixo
* **Ícone em Destaque:** Quadrado arredondado `w-10 h-10 rounded-2xl bg-acc text-bg shadow-md shadow-acc/20` com ícone temático em negrito.
* **Tipografia:** Título `font-display text-lg font-semibold text-txt` e descrição `text-xs text-mut/80`.
* **Botão de Fechar (`X`):** Posicionado no canto superior direito (`cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95`).

### C. Hero Preview Interativo (Quando houver Mídia/Identidade)
* **Banner Panorâmico (16:9):** Fundo gradiente moderno (`from-indigo-950/60 via-purple-950/40 to-slate-950`), hover com botão translúcido com `backdrop-blur-md` e botão discreto de exclusão.
* **Avatar Sobreposto (-mt-9):** `h-20 w-20 rounded-2xl border-4 border-[#12161f] shadow-xl` com **iniciais dinâmicas em tempo real** refletindo imediatamente o texto digitado pelo usuário.

### D. Campos de Formulário
* **Labels:** Textos em maiúsculas sutis (`text-xs font-semibold uppercase tracking-wider text-mut`) com contador de caracteres monospaçado à direita (`font-mono text-[11px]`).
* **Inputs & Textareas:** Fundo translúcido `bg-white/[0.03] border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-txt focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all`.

### E. Rodapé de Ações
* **Cancelar:** `cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] text-txt hover:bg-white/[0.08] active:scale-95 transition-all`.
* **Ação Primária:** `cursor-pointer flex-1 rounded-xl bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center justify-center gap-2`.

---

## 5. Princípio da Autossuficiência e Foco 100% Gratuito (Open-Source / Self-Hosted)

* **Zero Custos Recorrentes:** Todas as ferramentas, bibliotecas, plugins e soluções de engenharia adotadas devem ser **100% gratuitas, open-source ou auto-hospedadas**.
* **Sem Paywalls de Terceiros:** Nenhuma funcionalidade ou fluxo de trabalho deve depender de assinaturas pagas (SaaS) ou APIs pagas de terceiros.
* **Stack Autossuficiente e Aberta:**
  * **Frontend:** React 19, Tailwind CSS v4, Tauri v2, Zustand 5, Web Audio API nativa e Lucide/Phosphor Icons (MIT / Apache).
  * **Mídia & Voz:** SFU LiveKit open-source, WebRTC nativo e coturn STUN/TURN self-hosted.
  * **Comunicação Descentralizada:** Servidor Matrix Synapse e Echo API com PostgreSQL/SQLite auto-hospedados.
  * **Ferramental de IA & Documentação:** Context7 (gratuito), Chrome DevTools nativo e skills internas de código.


