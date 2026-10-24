# Echo — Mensageria para Comunidades

# Echo — Mensageria para Comunidades

App desktop baseado em **Matrix**, construído com **Tauri 2**, **React**, **Vite**, **Tailwind v4** e **matrix-js-sdk v44**. Cada guilda é um **Space** do Matrix — um servidor independente dentro da rede federada.

---

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Stack de Tecnologia](#stack-de-tecnologia)
- [Funcionalidades](#funcionalidades)
- [Arquitetura de Dados](#arquitetura-de-dados)
- [Autenticação e Segurança](#autenticação-e-segurança)
- **Instalação e Desenvolvimento**
- [Build e Release](#build-e-release)
- [Auto-updater](#auto-updater)
- **Infraestrutura (Homeserver Synapse)**
- [Deploy e Implantação](#deploy-e-implantação)
- [Roadmap](#roadmap)
- **Licença**

---

## 1. Visão Geral

O **Echo** é um cliente de mensageria de código aberto construído sobre o protocolo **Matrix**. É uma alternativa independente a plataformas como Discord e Element, focada em ser simples, rápida e privada.

Cada guilda no Echo é um **Space** do Matrix — um servidor independente dentro da rede federada. Isso significa que cada comunidade tem seu próprio espaço, seus próprios canais, membros e configurações, mantendo total autonomia dentro da rede Matrix.

O app roda como um cliente desktop Tauri 2 (Windows, com suporte futuro a macOS e Linux) e se conecta a um homeserver Synapse self-hosted.

---

## 2. Arquitetura

### 2.1 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE ECHO (Tauri 2)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   React     │  │  Zustand    │  │   matrix-js-sdk v44     │ │
│  │   + Vite    │  │   (stores)  │  │   (Matrix client SDK)   │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│                           │                                      │
│                           │ matrix-js-sdk API                    │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
        │                   matrix-js-sdk                      │ │
        ▼                                                            │
┌─────────────────────────────────────────────────────────────────┐ │
│                      SYNAPSE HOMESERVER                          │ │
│  (Docker Compose: Synapse v1.163.0 + Postgres 16)               │ │
└─────────────────────────────────────────────────────────────────┘ │
```

### 2.2 Componentes Principais

| Componente | Responsabilidade |
|------------|------------------|
| **Tauri 2** | Runtime desktop (Rust + WebView2 no Windows) |
| **React + Vite** | Interface do usuário e renderização |
| **Tailwind v4** | Estilização utilitária com design tokens |
| **matrix-js-sdk v44** | Comunicação com o homeserver Matrix |
| **Zustand** | Gerenciamento de estado sincronizado com o sync loop do Matrix |
| **Synapse v1.163.0** | Homeserver Matrix (homeserver principal) |
| **PostgreSQL 16** | Banco de dados do Synapse |

### 2.3 Fluxo de Dados

```
Usuário clica em "Enviar mensagem"
         ↓
Composer.tsx cria evento otimista (pending-*)
         ↓
Composer chama matrixService.sendMessage(roomId, body)
         ↓
matrix-js-sdk envia m.room.message para o Synapse
         ↓
Synapse aceita e retorna event_id
         ↓
Composer chama syncStore.resolvePending(localId, eventoReal)
         ↓
Timeline é atualizada com o evento real
         ↓
Se houver falha:
  → removePending(localId)
  → Restaura rascunho
  → Mostra erro ao usuário
```

---

## 3. Stack de Tecnologia

| Camada | Tecnologia | Versão | Propósito |
|--------|------------|--------|-----------|
| **Runtime Desktop** | Tauri 2 | 2.x | Empacotamento desktop (Windows, macOS, Linux) |
| **Frontend** | React + Vite | React 19, Vite 8 | Interface do usuário e build tool |
| **Estilização** | Tailwind CSS | v4.3.3 | Estilização utilitária com design tokens |
| **SDK Matrix** | matrix-js-sdk | v44.0.0 | Comunicação com homeserver Matrix |
| **Gerenciamento de Estado** | zustand | v5.0.15 | Estado global sincronizado com sync loop |
| **Ícones** | @phosphor-icons/react | v2.1.10 | Ícones da interface |
| **Fontes** | @fontsource/inter, @fontsource/space-grotesk | v5.3.0 | Tipografia |
| **Homeserver** | Synapse | v1.163.0 | Servidor Matrix |
| **Banco de Dados** | PostgreSQL | 16 | Armazenamento do Synapse |
| **Instalador** | NSIS (via Tauri) | - | Instalador Windows (.exe) |
| **Assinatura** | minisign | - | Assinatura de instaladores e atualizações |

---

## 4. Funcionalidades

### 4.1 Autenticação e Sessão

- **Login via Google SSO** — Autenticação via OIDC (OpenID Connect) com Google
- **Registro apenas por convite** — Registro fechado, apenas via registration token
- **Sessão persistente** — Sessão salva no Windows Credential Manager (keyring)
- **Restauração automática de sessão** — Login automático na inicialização se houver sessão salva
- **Logout completo** - Limpa sessão, keyring, e para o sync

### 2. Guildas e Canais

- **Criação de guildas (Spaces)** - Cada guilda é um Space do Matrix
- **Criação de canais** - Canais de texto dentro de cada guilda (Space child)
- **Edição de guildas** - Nome, ícone, banner e descrição
- **Exclusão de guildas** - Sai da guilda (leave) e remove da lista
- **Múltiplas guildas** - Suporte a múltiplas guildas simultâneas
- **Auto-seleção** - Primeira guilda é selecionada automaticamente ao entrar

### 3. Chat e Mensagens

- **Envio otimista** - Mensagens aparecem imediatamente (placeholder pending-*)
- **Rollback em falha** - Se o envio falhar, a mensagem volta ao estado anterior
- **Reações em tempo real** - Reações m.reaction em tempo real
- **Threads** - Suporte a threads de conversa
- **Tiping indicator** - Indicação de "está digitando…" em tempo real
- **Presença** - Status online/ausente/não perturbar/offline
- **Scrollback** - Carregamento de histórico ao rolar para cima

### 4. Perfil de Usuário

- **Avatar e banner** - Upload de imagem com recorte (crop)
- **Nickname** - Apelido visível na comunidade
- **Cargo** - Cargo dentro da comunidade
- **Biografia** - Descrição pessoal
- **Ligações sociais** - Links para redes sociais
- **Data de entrada** - Data de entrada na rede

### 5. Configurações

- **Notificações nativas do SO**
- **Som de mensagem**
- **Apenas menções** - Notificar apenas quando mencionado
- **Dispositivos de áudio/vídeo** - Seleção de microfone, câmera e fones de ouvido
- **Status online visível**
- **Confirmar leitura** - Enviar recibos de leitura
- **Digitação visível** - Mostrar 'está digitando…'

### 6. Auto-updater

- **Verificação automática** no boot
- **Download em background** sem bloquear o app
- **Banner estilo Discord** com estados: checking, downloading, ready
- **Reiniciar para aplicar** - Reinicia o aplicativo após download
- **Timeout de 10 segundos** - Não trava o boot se o endpoint estiver lento
- **Assinatura minisign** - Verificação de integridade do instalador

---

## 4. Arquitetura de Dados

### 4.1 Estrutura de Dados (Matrix)

| Entidade | Tipo Matrix | Descrição |
|----------|-------------|-----------|
| Guilda | `m.space` | Espaço Matrix (comunidade) |
| Canal | `m.room` | Sala dentro de um Space |
| Mensagem | `m.room.message` | Evento de mensagem |
| Reação | `m.reaction` | Reação a uma mensagem (m.annotation) |
| Nome da guilda | `m.room.name` | Estado do espaço |
| Ícone da guilda | `m.room.avatar` | Avatar do espaço |
| Banner da guilda | `echo.room.banner` | Banner customizado (evento custom) |
| Descrição da guilda | `m.room.topic` | Tópico/descrição do espaço |
| Membro | `m.room.member` | Membro de uma sala |
| Presença | `m.presence` | Presença do usuário |
| Digitação | `m.typing` | Evento efêmero de digitação |

### 4.2 Stores do Zustand

| Store | Responsabilidade |
|-------|------------------|
| `syncStore` | Dados do sync loop (guildas, canais, timeline, reações, membros, leituras) |
| `uiStore` | Estado de navegação (guilda ativa, canal ativo, sessão, presença, typing) |
| `profileStore` | Dados de perfil do usuário logado |
| `settingsStore` | Configurações do usuário |
| `updateStore` | Estado do auto-updater |

---

## 5. Autenticação e Segurança

### 5.1 Auth

- **OIDC Google** - Login via Google OAuth 2.0 com PKCE
- **Registro fechado** - Apenas via registration token (convite)
- **Username imutável** - Escolhido no primeiro login OIDC via `confirm_localpart: true`
- **Sessão persistente** - Salva no Windows Credential Manager (keyring, serviço "eco")

### 5.2 Segurança

- **E2EE não implementado** na Fase 1 (plano para Fase 2)
- **Federação desligada** - `federation_domain_whitelist: []`
- **Registro fechado** - `registration_requires_token: true`
- **Federação desabilitada** no listener (apenas recurso `client`)
- **Assinatura minisign** para instaladores e atualizações

---

## 6. Build e Release

### 6.1 Build

```bash
# Em apps/desktop
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content minisign-secret.key -Raw
pnpm tauri build
```

O instalador é gerado em:
`C:\st\sharestream\release\bundle\nsis\Echo_0.1.x_x64-setup.exe`

### 6.2 Release no GitHub

1. Criar release no GitHub: https://github.com/CilentoX/Echo/releases
2. Adicionar .exe e .sig (assinatura minisign)
3. Atualizar `latest.json` no site ecoapp.litteris.online

### 6.3 latest.json

Formato do arquivo de atualização:

```json
{
  "version": "0.1.12",
  "notes": "Echo v0.1.12: descrição das mudanças",
  "pub_date": "2026-10-23T18:40:46.230Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "ZFc1MGNuVnpkR1Zr...",
      "url": "https://github.com/CilentoX/Echo/releases/download/v0.1.12/Echo_0.1.12_x64-setup.exe"
    }
  }
}
```

---

## 7. Auto-updater

### 7.1 Fluxo

1. **Boot** → `runStartupUpdateCheck()` é chamado em paralelo com `loadSession()`
2. **Sem sessão** → Login abre diretamente (banner de update aparece depois)
3. **Com sessão** → Espera o check de update terminar antes de entrar no shell
4. **Update pronto** → `restartApp()` reinicia o aplicativo automaticamente
5. **Falha no check** → Timeout de 10s, boot segue normalmente, download continua em background

### 7.2 Estados do Updater

| Estado | Significado |
|--------|-------------|
| `idle` | Nada para mostrar |
| `checking` | Verificando atualização no boot |
| `downloading` | Baixando atualização em background |
| `ready` | Atualização pronta, reiniciar para aplicar |

---

## 8. Infraestrutura (Homeserver Synapse)

### 8.1 Configuração

O Synapse é gerenciado pelo **Coolify** (Docker Compose build pack) na VPS Oracle OCI. A pasta de origem é `~/eco/infra/vps/coolify/`.

**Containers:**
- `eco-synapse` - matrixdotorg/synapse:v1.163.0
- `eco-postgres` - postgres:16-alpine

**Redes:**
- `eco_net` - Rede interna entre synapse e postgres
- `coolify` - Rede externa para Traefik

**Volumes:**
- `eco_synapse_data` - Dados do Synapse
- `eco_pgdata` - Dados do PostgreSQL

### 8.2 Configuração do Synapse

- **server_name:** `litteris.online` (MXIDs: @usuario:litteris.online)
- **public_baseurl:** `https://echo.litteris.online/`
- **Federação:** Desligada (`federation_domain_whitelist: []`)
- **Registro:** Fechado (`registration_requires_token: true`)
- **OIDC:** Google habilitado (idp_id: `oidc-google`)
- **Listener:** 8008 (apenas client, sem federation)
- **bind_addresses:** `['0.0.0.0']`

### 8.3 Traefik

- Router: `Host(\`echo.litteris.online\`) || Host(\`eco.litteris.online\`)`
- Middleware: `eco-proto` (X-Forwarded-Proto: https)
- Porta: 8008 (cliente)

---

## 9. Deploy e Implantação

### 9.1 Deploy do Site (eco-site)

O site é hospedado no Coolify (app `eco-site`):

```bash
POST https://coolify.litteris.online/api/v1/deploy?uuid=akzlqfefwrmwd0ncyguwmoia&force=true
```

### 9.2 Deploy do Homeserver

O Synapse é implantado via **Coolify** a partir da pasta `~/eco/infra/vps/coolify/` (Docker Compose build pack). O Coolify reconstrói a imagem do Synapse (que renderiza `homeserver.yaml` a partir das env vars injetadas) e reutiliza os volumes externos `eco_synapse_data` e `eco_pgdata`.

```bash
# No Coolify: New Resource → Docker Compose → este repo, pasta infra/vps/coolify, branch main.
# Ou via API:
POST https://coolify.litteris.online/api/v1/deploy?uuid=<uuid-do-homeserver>&force=true
```

### 9.3 Release do App

1. Buildar o instalador NSIS
2. Assinar com minisign
3. Criar release no GitHub: https://github.com/CilentoX/Echo/releases
4. Atualizar latest.json no site
5. Deploy no Coolify

---

## 10. Roadmap

### Fase 1 - Fundação (Concluída)
- [x] App desktop Tauri 2
- [x] Login Google SSO
- [x] Guildas e canais
- [x] Chat em tempo real
- [x] Sessão persistente (keyring)
- [x] Auto-updater
- [x] Instalador NSIS

### 2 - Fase 2 (Planejada)
- [ ] Chat de voz + transmissão de tela (Element Call + LiveKit)
- [ ] E2EE (criptografia de ponta a ponta)
- **Histórico/scrollback** - Carregamento de mensagens antigas
- **Notificações nativas do SO**
- **Cache IndexedDB** - Cache local de mensagens

### 3 - Fase 3 (Planejada)
- [ ] Sistema de bots (painel de criação no app)
- **Sistema de roles/permissoes** - Painel de criação no app (AppWrite como candidato)
- **Mídia** - Upload e exibição de mídia
- **Busca de canais**

---

## 9. Licença

Este projeto é de código aberto. Consulte o arquivo LICENSE para mais detalhes.

---

Desenvolvido com ❤️ por CilentoX.

Repositório: https://github.com/CilentoX/Echo  
Site: https://echoapp.litteris.online  
Homeserver: https://echo.litteris.online
