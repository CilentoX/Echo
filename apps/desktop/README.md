# Eco Desktop

Cliente desktop da rede Eco (Tauri 2 + React + Vite + Tailwind).

## Desenvolvimento

```bash
pnpm install
pnpm test        # vitest (jsdom)
pnpm tauri dev   # app em modo dev
```

## Build (Windows, NSIS)

```bash
pnpm tauri build
```

Produz o instalador NSIS em `src-tauri/target/release/bundle/nsis/*.exe`
(bundle configurado com `"targets": ["nsis"]`).

## Auto-atualização (Task 12)

O app checa atualizações silenciosamente no boot e instala em background;
a atualização entra em vigor no próximo restart.

- Endpoint publicado: `https://ecoapp.litteris.online/latest.json`
  (configurado em `src-tauri/tauri.conf.json` → `plugins.updater.endpoints`).
- Caminho único: `src/lib/updater.ts` (`runStartupUpdateCheck` →
  `downloadAndInstall`) usa `tauri-plugin-updater`, que consulta o endpoint,
  compara versões e instala — sem fetch manual do `latest.json` no frontend
  (o fetch duplo foi removido na revisão da Fase 1).

### Checklist de release (passos manuais)

1. **Gerar as chaves minisign** (uma vez, fora do repositório — a chave
   privada nunca é commitada):

   ```bash
   pnpm tauri signer generate -w ~/.tauri/eco.key
   ```

2. **Substituir a `pubkey` placeholder** em `src-tauri/tauri.conf.json`
   (`plugins.updater.pubkey`) pela chave pública gerada
   (`~/.tauri/eco.key.pub`).

3. **Habilitar artefatos assinados** no bundle e construir com a chave
   privada:

   ```json
   // tauri.conf.json → bundle
   "createUpdaterArtifacts": true
   ```

   ```bash
   export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/eco.key)
   export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=...
   pnpm tauri build
   ```

   Isso gera o instalador + arquivo `.sig` junto ao artefato.

4. **Publicar** o instalador e o `latest.json` no host
   `https://ecoapp.litteris.online`. Formato do manifest:

   ```json
   {
     "version": "0.2.0",
     "notes": "Notas da release",
     "pub_date": "2026-10-21T12:00:00Z",
     "platforms": {
       "windows-x86_64": {
         "signature": "<conteúdo do .sig>",
         "url": "https://ecoapp.litteris.online/Eco_0.2.0_x64-setup.exe"
       }
     }
   }
   ```

5. **CSP** (configurada desde a revisão da Fase 1, em
   `src-tauri/tauri.conf.json` → `app.security.csp`):
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob: https:; font-src 'self' data:;
   connect-src 'self' https://eco.litteris.online ipc: http://ipc.localhost`.
   Ao adicionar novos domínios de API/mídia (ex.: proxy de mídia Matrix da
   Fase 2), atualize `connect-src`/`img-src` — nunca reabra `default-src`.

> Sem a chave privada real e o `createUpdaterArtifacts`, o build de
> desenvolvimento funciona normalmente; apenas a instalação de updates
> falhará na verificação de assinatura (esperado até o primeiro release).
