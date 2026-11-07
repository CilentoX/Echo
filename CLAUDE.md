# Echo — Claude Code Project Guide

## 📌 Project Overview
Echo is a decentralized desktop communication client featuring voice channels (WebRTC), Matrix-federated text chat, customizable guilds, direct messaging, rich embeds, and integrated presence.

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, Radix UI Primitives, Phosphor Icons.
* **Desktop Shell:** Tauri v2 (Rust 2021 edition).
* **Protocols & Backend:** Matrix Synapse Homeserver (`https://echo.litteris.online`), Fastify presence API (`https://echo-api.litteris.online`).

---

## 📖 Primary Guidelines & Context Files
Before designing UI components, modifying styles, or interacting with servers, consult:
* **UI/UX & Design Rules:** [GEMINI.md](file:///c:/Users/LucasCilento/echo/GEMINI.md) (Discord ergonomics, Echo Dark Glassmorphism, `#0FB9A8` teal accent, Guild modal architecture).
* **Infrastructure & Server Topology:** [CLAUDE_CODE_INFRA_AND_MCP.md](file:///c:/Users/LucasCilento/echo/CLAUDE_CODE_INFRA_AND_MCP.md) (Coolify apps, OCI VPS `152.67.46.168`, Cloudflare DNS, Docker networks).

---

## 🛠️ Verification & Build Commands

Always run these commands to verify changes:

```bash
# 1. Type check (must always pass with 0 errors)
pnpm --prefix apps/desktop tsc --noEmit

# 2. Run unit tests (must pass 100%)
pnpm --prefix apps/desktop test

# 3. Rust check (when modifying src-tauri)
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml

# 4. Local development servers
pnpm --prefix apps/desktop dev
pnpm --prefix apps/desktop tauri dev
```

---

## ⚠️ Claude Code Context & Exploration Best Practices
To prevent context truncation, token exhaustion, and API overload errors:
1. **Never run recursive directory dumps** (e.g. `ls -laR` or `find .`) on the whole project or into `.git`.
2. **Use targeted reads**: Read only specific files or line ranges required for the task.
3. **One project at a time**: Focus either on `echo` (desktop), `echo-api`, or `echo-site` individually rather than sweeping all 3 simultaneously in one prompt session.

