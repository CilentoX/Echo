# 📘 Echo — Documentação de Arquitetura, Alterações Recentes e Guia de Transição

> **Data de Atualização:** 26 de Novembro de 2026  
> **Status:** Repositórios 100% sincronizados no GitHub (`site`, `api`, `tauri`).  
> **Objetivo:** Fornecer o panorama completo das últimas implementações, auditorias e guia para continuidade do projeto em outra máquina de desenvolvimento.

---

## 1. 🌐 Status dos Repositórios Git

Todos os repositórios oficiais do ecossistema **Echo** foram commitados e enviados para os remotos do GitHub:

| Repositório | Descrição | Branch Ativa | Último Commit | Status Remoto |
| :--- | :--- | :--- | :--- | :--- |
| [**`CilentoX/Echo`**](https://github.com/CilentoX/Echo) | Cliente Desktop Tauri v2 + React 19 (`tauri`) | `master` | `feat(chat): implement in-channel message search (Ctrl+F) and mount global shortcuts` | ✅ Up-to-date |
| [**`CilentoX/echo-api`**](https://github.com/CilentoX/echo-api) | API Node.js/Prisma/Matrix/LiveKit SFU (`api`) | `master` | `fix(health): use official Matrix /_matrix/client/versions endpoint for Synapse` | ✅ Up-to-date |
| [**`CilentoX/Echo-site`**](https://github.com/CilentoX/Echo-site) | Site institucional, landing page e manifests (`site`) | `main` | `chore: update latest.json to v0.1.25` | ✅ Up-to-date |

---

## 2. 🚀 Resumo Detalhado das Últimas Alterações

### A. Correção da Transmissão de Tela (Display 2 / Multi-Monitor)
* **Causa Raiz:** O WebView2 no Tauri estava recebendo as flags de inicialização `--use-fake-ui-for-media-stream` e `--auto-select-desktop-capture-source="Tela"`, o que interceptava a caixa de diálogo nativa do Windows e forçava compulsoriamente a primeira tela.
* **Solução:**
  * Removidas as flags restritivas em `apps/desktop/src-tauri/src/lib.rs`.
  * Ajustadas as restrições W3C em `VoiceStage.tsx` para `displaySurface: "monitor" | "window" | "browser"`, permitindo selecionar livremente o Display 1, Display 2, janelas individuais de jogos/programas ou abas do navegador.

### B. Atalhos Globais de Sistema Operacional (Tauri Global Shortcuts)
* **Implementação:** Hook `useGlobalVoiceShortcuts` montado no topo da árvore de execução autenticada em `App.tsx` (`Shell()`).
* **Atalhos Mapeados:**
  * `Ctrl+Shift+M` (ou `Cmd+Shift+M` no macOS): Alterna mudo do microfone globalmente, mesmo com o aplicativo minimizado ou rodando em segundo plano durante jogos em tela cheia.
  * `Ctrl+Shift+D` (ou `Cmd+Shift+D`): Alterna estado ensurdecido (deafen) globalmente.
* **Segurança e Permissões:** Permissão `global-shortcut:default` adicionada a `apps/desktop/src-tauri/capabilities/default.json` e plugin inicializado no backend Rust.

### C. Pré-Visualização e Player de Mensagens de Voz (`VoiceRecorder`)
* **Fluxo Aprimorado:** O usuário agora pode gravar o áudio e clicar no botão **"Parar e Ouvir"** antes de enviar.
* **Interface:** Exibe player de áudio com reprodução em tempo real, barra de progresso temporal e botões rápidos para descartar ou enviar.
* **Resiliência de Hardware:** Substituição de restrições rígidas `{ exact: deviceId }` por `{ ideal: deviceId }`, prevenindo crash da Web Audio API caso um microfone USB/fone Bluetooth seja desconectado durante a gravação.

### D. Volumes Individuais Persistidos e Separação de Áudio de Transmissão
* **Volume por Participante:** Slider individual de volume (0% a 200%) com ganho via Web Audio API e persistência no `localStorage` por `userId`.
* **Áudio de Compartilhamento de Tela Separado:** Controle de volume dedicado para a transmissão de tela, permitindo que os participantes ouçam o streamer e o som do jogo/vídeo em volumes completamente independentes.

### E. Popover de Diagnóstico de Chamada em Tempo Real
* **Localização:** Clicável diretamente no badge de status de conexão no canto superior do `VoiceStage.tsx`.
* **Métricas Exibidas:**
  * **Transporte Ativo:** LiveKit SFU (modo de alta performance e baixa latência) ou WebRTC Mesh (fallback ponto a ponto).
  * **Latência (Ping):** Medição em milissegundos com código de cores (verde < 60ms, amarelo < 120ms, vermelho > 120ms).
  * **DSP de Áudio:** Status ativo de Cancelamento de Eco, Supressão de Ruído e Ganho Automático (AGC).
  * **Codec:** Opus 48kHz em estéreo/mono.
  * **Modo de Captura:** Ativação por Voz (VAD) ou Push-to-Talk (PTT).

### F. Busca Rápida de Mensagens no Canal (`Ctrl+F`)
* **Acesso:** Tecla de atalho `Ctrl+F` (ou `Cmd+F`) e botão de lupa no `ChatHeader.tsx`.
* **Funcionalidade:**
  * Barra de busca com glassmorphism posicionada logo abaixo do cabeçalho.
  * Filtragem instantânea das mensagens virtuais na timeline por texto ou autor.
  * Indicador de resultados encontrados (`X resultados`).
  * Estado vazio elegante caso nenhum resultado corresponda à pesquisa.
  * Fechamento rápido via tecla `Escape` ou botão de fechar.

### G. Correção do Healthcheck do Synapse e Sincronização da VPS
* **Problema:** O endpoint `/health` da API retornava `"synapse": "degraded"` porque tentava consultar `/_matrix/client/v3/versions`, que no Synapse moderno retorna HTTP 404 (`M_UNRECOGNIZED`).
* **Correção:** Atualizado para o endpoint oficial da especificação Matrix `/_matrix/client/versions` (HTTP 200).
* **Deploy VPS:** Container da API reconstruído e atualizado no Dokploy na VPS (`152.67.46.168`). O endpoint de produção `https://echo-api.litteris.online/health` agora retorna 100% estável:
  ```json
  {
    "status": "ok",
    "services": {
      "database": "connected",
      "synapse": "connected"
    },
    "version": "1.0.0",
    "service": "echo-api"
  }
  ```

### H. Identidade Visual e Perfis
* **Avatar & Banners:** Corrigida a exclusão de avatares e banners em `ProfileTab.tsx`, `GuildProfileTab.tsx` e `EditGuildModal.tsx`, enviando explicitamente `null` sem que o operador `??` forçasse a imagem padrão antiga.
* **Sincronização:** Os dados do perfil da guilda refletem imediatamente na lista de guildas do `useSyncStore`.

---

## 3. 🖥️ Infraestrutura em Nuvem (VPS Oracle Cloud)

* **IP do Servidor:** `152.67.46.168` (Ubuntu 22.04 LTS / ARM64)
* **Gerenciador de Containers:** Dokploy (`dokploy:v0.31.4`) + Docker Swarm
* **Proxy Reverso:** Traefik com TLS automático Let's Encrypt
* **Serviços Ativos na VPS:**
  * `echo-api` (Dokploy app `app-copy-back-end-microchip-tjvbj9`): porta interna 3000 -> `https://echo-api.litteris.online`
  * `eco-synapse` (`matrixdotorg/synapse:v1.163.0`): porta interna 8008 -> `https://echo.litteris.online`
  * `echo-livekit` (`livekit/livekit-server:latest`): portas 7880 (HTTP), 7881 (TCP), 7882 (UDP) -> `wss://echo.litteris.online/livekit`
  * `postgres` (bancos de dados isolados para API e Synapse)
  * `wg-easy` (gerenciador WireGuard)

---

## 4. 💻 Guia para Continuar em Outra Máquina

### 1. Pré-Requisitos na Nova Máquina
* **Git:** `git --version`
* **Node.js:** Versão 22 LTS recomendada (`node --version`)
* **pnpm:** Versão 10 recomendada (`npm install -g pnpm`)
* **Rust & Cargo:** Ferramental necessário para compilar o Tauri v2 ([rustup.rs](https://rustup.rs/))
* **Dependências C++ do Windows:** Visual Studio Build Tools com "Desktop development with C++" instalado.

### 2. Clonando os Repositórios
```bash
# 1. Cliente Desktop (Tauri + React)
git clone https://github.com/CilentoX/Echo.git echo
cd echo
pnpm install

# 2. Backend / API
cd ..
git clone https://github.com/CilentoX/echo-api.git echo-api
cd echo-api
pnpm install

# 3. Site & Updater Manifests
cd ..
git clone https://github.com/CilentoX/Echo-site.git echo-site
cd echo-site
pnpm install
```

### 3. Configurando os Arquivos `.env`
No repositório `echo` (`apps/desktop/.env`):
```env
VITE_ECHO_API_URL=https://echo-api.litteris.online
VITE_MATRIX_HOMESERVER=https://echo.litteris.online
VITE_LIVEKIT_URL=wss://echo.litteris.online/livekit
```

No repositório `echo-api` (`.env`):
Copie o `.env.example` e ajuste com a string de conexão do PostgreSQL e chaves de API caso deseje rodar o backend localmente:
```env
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/echo
SYNAPSE_URL=https://echo.litteris.online
LIVEKIT_URL=https://echo.litteris.online/livekit
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=secret
```

### 4. Executando e Testando
```bash
# Rodar o cliente Echo no modo Desktop Tauri:
cd echo
pnpm --dir apps/desktop tauri dev

# Rodar apenas o frontend web no navegador (Vite):
pnpm --dir apps/desktop dev

# Executar a suíte de testes completa (100% passando):
pnpm --dir apps/desktop test
```

---

## 5. 🎯 Próximos Passos Recomendados (Roadmap Fase 2 e 3)

1. **Atalhos do Teclado para Mudança de Canal:**
   - Adicionar navegação rápida `Alt+Up` / `Alt+Down` para percorrer canais dentro da guilda ativa.
2. **Pacote de Sons Personalizado:**
   - Adicionar chave seletora em Configurações de Voz para escolher entre os beeps sintetizados do Web Audio e efeitos sonoros customizados.
3. **Build de Release e Publicação do Auto-Updater:**
   - Executar `pnpm --dir apps/desktop build:release` para gerar o `.msi` / `.exe` assinado e atualizar o `latest.json` no repositório `echo-site`.
