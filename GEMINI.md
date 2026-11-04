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
