# Pendências do Echo — Plano de Execução

Fonte: respostas dos formulários `respostas-echo.html` (1/2) e `respostas-echo-2.html` (2/2).

## Decisões consolidadas

### Execução
- **Ordem:** uma fase por vez, com validação entre cada fase
- **Commit:** apenas ao final de tudo (não commitar após cada fase)
- **Prioridade:** corrigir bugs do app primeiro, lançar versão depois
- **Build:** apenas gerar instalador localmente (não criar release GitHub automaticamente)

### Fase 1 — Sessão e boot (login automático)
- Login via Google (SSO) já funciona em `https://echo.litteris.online`: **Sim**
- Ao abrir o app instalado: **restaurar sessão automaticamente**
- Sessão expirada / token inválido: **tentar reconectar silenciosamente** (não deslogar)
- Teste `SessionGate.test.tsx`: **atualizar para `startSyncHandlers`** (não manter compatibilidade com ambos)

### Fase 2 — Guildas e canais de texto
- Quem pode criar guilda: **qualquer usuário logado**
- Canal `# geral` automático ao criar guilda: **Sim**
- Canal criado aparecer na sidebar imediatamente (sem reiniciar): **Sim**
- Botão "Deletar guilda": **excluir de verdade via API** (não só remover da interface)
- Histórico antigo (scrollback): **carregar ao abrir canal**

### Fase 3 — Chat e envio de mensagem (até enviar a primeira mensagem)
- Envio de mensagem: **esperar o servidor responder** (não otimista)
- Falha de envio: **mostrar erro e permitir tentar novamente**
- Mensagens carregar por vez no scrollback: **30**
- Rolar chat para cima carregar mais antigas: **Sim**
- Reações em mensagens: **reais via `m.reaction` no servidor** (não simplificação local)
- Indicador "está digitando": **em tempo real**
- Presença online/offline dos membros: **aparecer na lista**

### Fase 4 — Interface e UX
- Toggles alinhados: **prioridade alta**
- Dispositivos de microfone/câmera/fone: **listar dispositivos reais do PC**
- Permissão de dispositivos: **pedir ao abrir Configurações** (não só ao clicar no select)
- Ícone de volume quebrado: **substituir por ícone Phosphor** (não corrigir SVG existente)
- "✕" texto substituído por ícone X do Phosphor: **Sim**
- Modais fecham com Esc: **Sim**

### Não escopo desta execução
- Release GitHub automático após build (apenas instalador local)
- Otimização de envio (manter comportamento de esperar servidor)

## Próxima ação

Iniciar **Fase 1 — Sessão e boot**. Primeiro passo: inspecionar `src/features/auth/SessionGate.tsx` para confirmar o estado atual de `startSync` vs `startSyncHandlers`, `restoreSession` e o fluxo de boot.
