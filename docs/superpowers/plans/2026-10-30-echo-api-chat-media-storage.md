# Echo API Chat Media Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o Echo API o storage primário de mídia do chat (imagens + áudios), mantendo upload simultâneo no Synapse para compatibilidade Matrix nativa (thumbnails, prévias, clientes web).

**Architecture:** Opção B (híbrida) — Desktop faz upload para Echo API (retorna HTTP URL) E para Synapse (retorna `mxc://`). Mensagem `m.file` usa `mxc://` como `url` principal; Echo API guarda cópia como backup/source of truth.

**Tech Stack:** Fastify + Prisma + PostgreSQL (Echo API), matrix-js-sdk (Desktop), Tauri (native file access)

**Spec:** Este plano implementa a decisão do usuário por armazenamento híbrido de mídia do chat.

## Global Constraints

- Não adicionar dependências sem perguntar
- Seguir estilo existente (ESM, async/await, error handling com try/catch)
- Commits seguem Conventional Commits (em inglês)
- Manter compatibilidade com clientes Matrix existentes (usar `mxc://` na mensagem)
- Echo API já tem `/api/upload` para avatar/banner — estender para chat media
- Tipos de arquivo permitidos: imagens (jpeg, png, gif, webp) + áudio (ogg, mp3, webm, m4a)

## Review Focus

1. **Upload falha no Echo API mas passa no Synapse** → Mensagem enviada com `mxc://`, log de erro no Echo API, retry posterior
2. **Upload falha no Synapse mas passa no Echo API** → Mensagem NÃO enviada (precisa `mxc://` para Matrix), erro claro ao usuário
3. **Arquivo grande (>10MB)** → Rejeitado com erro 413 tanto no Echo API quanto no Synapse
4. **Tipo MIME não permitido** → Rejeitado com erro 400, lista de tipos aceitos no erro
5. **Autenticação** → Endpoint `/api/upload` requer `X-API-Key` (já implementado no plugin auth)

---

### Task 1: Echo API — Extender uploadService para chat media

**Files:**
- Modify: `C:\Users\LucasCilento\echo-api\src\services\uploadService.js`
- Modify: `C:\Users\LucasCilento\echo-api\src\routes\uploadRoutes.js`
- Test: `C:\Users\LucasCilento\echo-api\src\services\uploadService.test.js` (criar)

**Interfaces:**
- Consumes: `uploadService.saveFile(file)` existente
- Produces: `uploadService.saveChatMedia(file, roomId?)` → `{ fileId, url, mxcUri?, mimeType, size }`

- [ ] **Step 1: Write failing test for `saveChatMedia`**

```javascript
// uploadService.test.js
import { uploadService } from "./uploadService.js";
import fs from "node:fs";
import path from "node:path";

describe("saveChatMedia", () => {
  it("salva arquivo de chat e retorna URL HTTP + metadados", async () => {
    const mockFile = {
      filename: "audio.ogg",
      mimetype: "audio/ogg",
      toBuffer: async () => Buffer.from("fake audio data"),
    };
    const result = await uploadService.saveChatMedia(mockFile, "!room:example.com");
    expect(result).toHaveProperty("fileId");
    expect(result).toHaveProperty("url");
    expect(result.url).toMatch(/^https?:\/\//);
    expect(result.mimeType).toBe("audio/ogg");
    expect(result.size).toBeGreaterThan(0);
  });

  it("rejeita tipo MIME não permitido", async () => {
    const mockFile = {
      filename: "evil.exe",
      mimetype: "application/x-msdownload",
      toBuffer: async () => Buffer.from("x"),
    };
    await expect(uploadService.saveChatMedia(mockFile))
      .rejects.toThrow("Tipo de arquivo não permitido");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd echo-api && npx vitest run src/services/uploadService.test.js`
Expected: FAIL — `saveChatMedia` não existe

- [ ] **Step 3: Implement `saveChatMedia` em `uploadService.js`**

- Adicionar `CHAT_ALLOWED_MIME_TYPES` com imagens + áudio (ogg, mp3, webm, m4a, mpeg, wav)
- Nova função `saveChatMedia(file, roomId?)` que:
  1. Valida MIME type contra lista expandida
  2. Gera `fileId` (uuid)
  3. Salva em `UPLOAD_DIR/chat/{roomId?}/` ou `UPLOAD_DIR/chat/` se sem roomId
  4. Retorna `{ fileId, originalName, mimeType, size, url, path }`
- Manter `saveFile` original para avatar/banner (tipos apenas imagem)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd echo-api && npx vitest run src/services/uploadService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add echo-api/src/services/uploadService.js echo-api/src/services/uploadService.test.js
git commit -m "feat(api): add saveChatMedia for chat media uploads (images + audio)"
```

---

### Task 2: Echo API — Nova rota `/api/upload/chat` para mídia do chat

**Files:**
- Modify: `C:\Users\LucasCilento\echo-api\src\routes\uploadRoutes.js`

**Interfaces:**
- Consumes: `uploadService.saveChatMedia(file, roomId)`
- Produces: `POST /api/upload/chat` → `{ fileId, url, mimeType, size }`

- [ ] **Step 1: Write failing test for rota chat upload**

```javascript
// uploadRoutes.test.js (ou integração)
import { build } from "../app.js";

describe("POST /api/upload/chat", () => {
  let app;
  beforeAll(async () => { app = await build(); });
  afterAll(async () => { await app.close(); });

  it("faz upload de áudio e retorna URL", async () => {
    const form = new FormData();
    form.append("file", new Blob(["fake audio"], { type: "audio/ogg" }), "test.ogg");
    form.append("roomId", "!room:example.com");
    
    const res = await app.inject({
      method: "POST",
      url: "/api/upload/chat",
      headers: { "x-api-key": process.env.API_KEY },
      payload: form,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("url");
    expect(body.url).toMatch(/^https?:\/\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd echo-api && npx vitest run src/routes/uploadRoutes.test.js`
Expected: FAIL — rota não existe

- [ ] **Step 3: Implement rota em `uploadRoutes.js`**

- `POST /api/upload/chat` (multipart: `file` + opcional `roomId`)
- Usa `uploadService.saveChatMedia(file, roomId)`
- Retorna `{ fileId, url, originalName, mimeType, size }`
- Mesma autenticação `X-API-Key` das outras rotas

- [ ] **Step 4: Run test to verify it passes**

Run: `cd echo-api && npx vitest run src/routes/uploadRoutes.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add echo-api/src/routes/uploadRoutes.js
git commit -m "feat(api): add POST /api/upload/chat for chat media"
```

---

### Task 3: Desktop — Novo módulo `echoApi.ts` para chamadas à Echo API

**Files:**
- Create: `C:\Users\LucasCilento\echo\apps\desktop\src\lib\api\echoApi.ts`
- Test: `C:\Users\LucasCilento\echo\apps\desktop\src\lib\api\echoApi.test.ts`

**Interfaces:**
- Produces: `uploadChatMedia(file: File, roomId?: string): Promise<{ url: string; fileId: string; mimeType: string; size: number }>`

- [ ] **Step 1: Write failing test**

```typescript
// echoApi.test.ts
import { uploadChatMedia } from "./echoApi";

describe("uploadChatMedia", () => {
  it("faz upload e retorna URL do Echo API", async () => {
    const file = new File(["test"], "test.ogg", { type: "audio/ogg" });
    const result = await uploadChatMedia(file, "!room:test");
    expect(result).toHaveProperty("url");
    expect(result.url).toMatch(/^https:\/\/api\.echo\.litteris\.online\/uploads\//);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && pnpm test src/lib/api/echoApi.test.ts`
Expected: FAIL — módulo não existe

- [ ] **Step 3: Implement `echoApi.ts`**

```typescript
// echoApi.ts
import { ECHO_API_CONFIG } from "./config";

export async function uploadChatMedia(
  file: File,
  roomId?: string
): Promise<{ url: string; fileId: string; mimeType: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  if (roomId) form.append("roomId", roomId);

  const res = await fetch(`${ECHO_API_CONFIG.baseUrl}/api/upload/chat`, {
    method: "POST",
    headers: { "X-API-Key": import.meta.env.VITE_ECHO_API_KEY },
    body: form,
    signal: AbortSignal.timeout(ECHO_API_CONFIG.timeout),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && pnpm test src/lib/api/echoApi.test.ts`
Expected: PASS (mockando fetch)

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/api/echoApi.ts apps/desktop/src/lib/api/echoApi.test.ts
git commit -m "feat(desktop): add echoApi.uploadChatMedia for chat media uploads"
```

---

### Task 4: Desktop — Atualizar `MessagesApi.sendFile` para upload híbrido

**Files:**
- Modify: `C:\Users\LucasCilento\echo\apps\desktop\src\lib\matrix\api\messages.ts`
- Test: `C:\Users\LucasCilento\echo\apps\desktop\src\lib\matrix\api\messages.test.ts`

**Interfaces:**
- Consumes: `uploadChatMedia` (Task 3), `uploadMedia` (existente, Synapse)
- Produces: `sendFile` que faz upload duplo, usa `mxc://` na mensagem, loga erro do Echo API

- [ ] **Step 1: Write failing test**

```typescript
// messages.test.ts (adicionar ao describe sendFile)
it("faz upload híbrido: Echo API + Synapse, usa mxc:// na mensagem", async () => {
  const file = new File(["test"], "test.ogg", { type: "audio/ogg" });
  mockEchoApi.uploadChatMedia.mockResolvedValue({ url: "https://api.echo/...", fileId: "1", mimeType: "audio/ogg", size: 4 });
  mockClient.uploadContent.mockResolvedValue({ content_uri: "mxc://echo/abc" });
  
  const eventId = await messagesApi.sendFile("!room:test", file);
  
  expect(mockEchoApi.uploadChatMedia).toHaveBeenCalledWith(file, "!room:test");
  expect(mockClient.uploadContent).toHaveBeenCalled();
  expect(eventId).toBe("event-123");
});

it("se Echo API falha, loga erro mas continua com Synapse", async () => {
  mockEchoApi.uploadChatMedia.mockRejectedValue(new Error("Echo API down"));
  mockClient.uploadContent.mockResolvedValue({ content_uri: "mxc://echo/abc" });
  
  const eventId = await messagesApi.sendFile("!room:test", file);
  
  expect(console.error).toHaveBeenCalledWith("[Echo API] Upload falhou:", expect.any(Error));
  expect(eventId).toBe("event-123");
});

it("se Synapse falha, propaga erro (mensagem não enviada)", async () => {
  mockEchoApi.uploadChatMedia.mockResolvedValue({ url: "https://api.echo/...", fileId: "1", mimeType: "audio/ogg", size: 4 });
  mockClient.uploadContent.mockRejectedValue(new Error("Synapse down"));
  
  await expect(messagesApi.sendFile("!room:test", file)).rejects.toThrow("Synapse down");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && pnpm test src/lib/matrix/api/messages.test.ts`
Expected: FAIL — lógica híbrida não implementada

- [ ] **Step 3: Implement `sendFile` híbrido em `messages.ts`**

```typescript
// No topo do arquivo
import { uploadChatMedia } from "@/lib/api/echoApi";

// Em sendFile:
async sendFile(roomId: string, file: File, body?: string): Promise<string> {
  // 1. Upload para Echo API (primário) — não bloqueia se falhar
  let echoUrl: string | null = null;
  try {
    const echoResult = await uploadChatMedia(file, roomId);
    echoUrl = echoResult.url;
    console.log("[Echo API] Chat media uploaded:", echoUrl);
  } catch (err) {
    console.error("[Echo API] Upload falhou, continuando apenas com Synapse:", err);
  }

  // 2. Upload para Synapse (obrigatório para Matrix)
  const mxcUri = await this.uploadMedia(file);

  // 3. Envia mensagem com mxc:// (padrão Matrix)
  const res = await this.requireClient().sendEvent(roomId, "m.message", {
    msgtype: file.type.startsWith("audio/") ? "m.audio" : "m.file",
    body: body ?? file.name,
    url: mxcUri,
    info: { mimetype: file.type, size: file.size },
  } as Record<string, unknown>);

  if (typeof res === "string") return res;
  if (!res?.event_id) throw new Error("sendFile failed: missing event_id");
  return res.event_id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/desktop && pnpm test src/lib/matrix/api/messages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/lib/matrix/api/messages.ts apps/desktop/src/lib/matrix/api/messages.test.ts
git commit -m "feat(desktop): hybrid upload (Echo API + Synapse) for chat media"
```

---

### Task 5: Desktop — Atualizar `MatrixService.sendFile` para passar roomId

**Files:**
- Modify: `C:\Users\LucasCilento\echo\apps\desktop\src\lib\matrix\service.ts`

**Interfaces:**
- Consumes: `MessagesApi.sendFile(roomId, file, body?)`
- Produces: Mesma assinatura, passa `roomId` internamente

- [ ] **Step 1: Verificar assinatura atual**

Já existe `sendFile(roomId, file, body?)` — só precisa garantir que o `roomId` chega no `MessagesApi`.

- [ ] **Step 2: Ajustar se necessário** (provavelmente já passa)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/lib/matrix/service.ts
git commit -m "fix(desktop): ensure roomId passed to sendFile for chat media upload"
```

---

### Task 6: Integração — Testes end-to-end manuais

**Files:** (nenhum novo — validação manual)

- [ ] **Step 1: Build Echo API e deploy no Coolify (ou local)**

```bash
cd echo-api && docker build -t echo-api . && docker run -p 3001:3001 ...
```

- [ ] **Step 2: Build Desktop e testar envio de imagem + áudio**

```bash
cd apps/desktop && pnpm tauri dev
```

- [ ] **Step 3: Verificar:**
  1. Imagem enviada → aparece no chat, thumbnail funciona
  2. Áudio enviado → player nativo do Matrix funciona
  3. Arquivo aparece em `https://echo-api.litteris.online/uploads/chat/...`
  4. Logs mostram `[Echo API] Chat media uploaded:` ou erro tratado

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "feat: hybrid chat media storage (Echo API primary + Synapse for Matrix compat)"
```

---