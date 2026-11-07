# 🌌 Echo — Guia Completo de Infraestrutura, Hospedagem e Configuração MCP para o Claude Code

Este documento consolida toda a arquitetura, topologia de servidores, ambientes Coolify, banco de dados, Matrix Synapse, DNS Cloudflare e os **servidores MCP (Model Context Protocol)** prontos para serem integrados diretamente no **Claude Code** (`~/.claude.json` ou `claude_desktop_config.json`).

---

## 1. Topologia de Infraestrutura e Hospedagem (Coolify)

O backend do Echo e o Homeserver Matrix são hospedados em uma VPS autogerenciada via **Coolify v4**, com orquestração Docker, redes virtuais isoladas e proxy reverso com certificados TLS/SSL automatizados (Let's Encrypt).

### 🖥️ Servidor Host Principal
* **IP do Servidor:** `152.67.46.168`
* **Provedor:** Oracle Cloud Infrastructure (OCI Compute VPS)
* **Sistema Operacional:** Ubuntu Linux 22.04 / 24.04 LTS
* **Rede Interna Docker:** `coolify` (bridge compartilhada entre aplicações e banco de dados)
* **Painel Coolify:** Instalado no host, gerenciando deploys via Webhooks do GitHub.

---

## 2. Mapa dos Serviços e Containers no Coolify

* **Projeto:** `echo` (UUID: `xovjnydvqj6cqmosrxoyboil`)
* **Ambiente:** `production`

| Aplicação / Serviço | Coolify UUID | Repositório Git | Domínio Público / URL | Porta Interna | Descrição |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`echo-api`** | `szbzibmikrmc99zkzxv61d47` | `CilentoX/echo-api` (`master`) | `https://echo-api.litteris.online` | `3001` | Backend Fastify (TypeScript) para presença de voz WebRTC, sincronização de salas, cache de membros e integração Spotify |
| **`echo-homeserver`** | `ogtogbmrw8tn2yeaikpcdrfg` | `CilentoX/Echo` (`master`) | `https://echo.litteris.online` | `80` / `8008` | Matrix Synapse Homeserver oficial com autenticação SSO Google OAuth2/OIDC e federação descentralizada |
| **`echo-site`** | `akzlqfefwrmwd0ncyguwmoia` | `CilentoX/Echo` (`master`) | `https://echoapp.litteris.online` | `80` | Landing Page oficial e portal de download do instalador Windows |
| **`echo-api-db`** | `mfyvtp0rr67z9zegxo6latrq` | Docker Hub (`postgres:15-alpine`) | *Acesso interno via rede `coolify`* | `5432` | Banco PostgreSQL relacional para metadados da API e contas |

### 🔐 Pontos de Conexão e Endpoints Críticos
* **Matrix Client-Server API:** `https://echo.litteris.online/_matrix/client/v3`
* **Endpoint de Login SSO Google:** `https://echo.litteris.online/_matrix/client/v3/login/sso/redirect/oidc-google?redirectUrl=...`
* **Echo Voice & Presence API:** `https://echo-api.litteris.online/api`
* **Status da API:** `https://echo-api.litteris.online/health` ou `GET /api/config`

---

## 3. Gestão DNS e CDN (Cloudflare)

* **Zona Raiz:** `litteris.online`
* **Registros DNS Configurados:**
  * `echo.litteris.online` ➔ `CNAME` / `A` apontando para `152.67.46.168` (Proxied via Cloudflare)
  * `echo-api.litteris.online` ➔ `CNAME` / `A` apontando para `152.67.46.168` (Proxied via Cloudflare)
  * `echoapp.litteris.online` ➔ `CNAME` / `A` apontando para `152.67.46.168` (Proxied via Cloudflare)
* **SSL/TLS:** Modo *Full (Strict)* com certificados origin Coolify e Edge Certificates da Cloudflare.

---

## 4. Configuração Completa de MCPs para o Claude Code

Para habilitar o **Claude Code** a interagir nativamente com a infraestrutura Coolify, GitHub, Cloudflare e o servidor via SSH, configure o seu arquivo de configuração do Claude Code:

* **No Windows:** `%USERPROFILE%\.claude.json` ou `%APPDATA%\Claude\claude_desktop_config.json`
* **No Linux/macOS:** `~/.claude.json` ou `~/.config/Claude/claude_desktop_config.json`

### 📋 JSON de Configuração MCP (`mcpServers`)

```json
{
  "mcpServers": {
    "coolify": {
      "command": "npx",
      "args": ["-y", "@coolify/mcp"],
      "env": {
        "COOLIFY_API_BASE_URL": "https://coolify.litteris.online/api/v1",
        "COOLIFY_API_TOKEN": "<SEU_TOKEN_DE_API_DO_COOLIFY>"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<SEU_GITHUB_PAT_COM_REPO_ACCESS>"
      }
    },
    "cloudflare": {
      "command": "npx",
      "args": ["-y", "@cloudflare/mcp-server-cloudflare"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "<SEU_CLOUDFLARE_API_TOKEN>",
        "CLOUDFLARE_ACCOUNT_ID": "<SEU_CLOUDFLARE_ACCOUNT_ID>"
      }
    },
    "ssh": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-ssh"],
      "env": {
        "SSH_HOST": "152.67.46.168",
        "SSH_PORT": "22",
        "SSH_USER": "ubuntu",
        "SSH_KEY_PATH": "C:/Users/LucasCilento/.ssh/id_rsa"
      }
    }
  }
}
```

---

## 5. Como Adicionar os MCPs via Linha de Comando no Claude Code

Se você preferir adicionar os servidores individualmente através da CLI do Claude Code:

### 1. Coolify MCP
```bash
claude mcp add coolify -- npx -y @coolify/mcp
```
*(Configure a variável `COOLIFY_API_TOKEN` no prompt de ambiente solicitado pelo Claude).*

### 2. GitHub MCP
```bash
claude mcp add github -e GITHUB_PERSONAL_ACCESS_TOKEN=<SEU_GITHUB_TOKEN> -- npx -y @modelcontextprotocol/server-github
```

### 3. Cloudflare MCP
```bash
claude mcp add cloudflare -e CLOUDFLARE_API_TOKEN=<SEU_CLOUDFLARE_TOKEN> -- npx -y @cloudflare/mcp-server-cloudflare
```

### 4. SSH MCP (Acesso direto ao servidor da VPS)
```bash
claude mcp add ssh -e SSH_HOST=152.67.46.168 -e SSH_USER=ubuntu -- npx -y @modelcontextprotocol/server-ssh
```

---

## 6. Principais Comandos e Operações do Claude Code para o Echo

### 🔄 Fazer Redeploy de Serviços no Coolify
O Claude Code pode executar restarts e deploys instantâneos diretamente via MCP Coolify:
* **Deploy da API:** Chamar `deployments` ou disparar webhook com UUID `szbzibmikrmc99zkzxv61d47`.
* **Deploy do Homeserver:** Disparar deploy para UUID `ogtogbmrw8tn2yeaikpcdrfg`.
* **Deploy do Site:** Disparar deploy para UUID `akzlqfefwrmwd0ncyguwmoia`.

### 🔍 Inspecionar Logs em Tempo Real
Pelo SSH ou Coolify MCP:
```bash
# Ver logs da API Fastify
docker logs -f szbzibmikrmc99zkzxv61d47

# Ver logs do Matrix Synapse
docker logs -f ogtogbmrw8tn2yeaikpcdrfg

# Ver status dos containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## 7. Repositórios e Links de Código Fonte
* **Repositório Desktop (Tauri + React):** [github.com/CilentoX/Echo](https://github.com/CilentoX/Echo)
* **Repositório Backend API (Fastify):** [github.com/CilentoX/echo-api](https://github.com/CilentoX/echo-api)
* **Instaladores e Releases:** [github.com/CilentoX/Echo/releases](https://github.com/CilentoX/Echo/releases)

