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

## Auto-atualização (Task 12) — GitHub Releases

O app checa atualizações silenciosamente no boot e instala em background;
a atualização entra em vigor no próximo restart.

- **GitHub Releases**: o `tauri-plugin-updater` consulta os releases do
  repositório GitHub automaticamente (sem `endpoints` custom em
  `src-tauri/tauri.conf.json` → `plugins.updater.pubkey` apenas).
- Caminho único: `src/lib/updater.ts` (`runStartupUpdateCheck` →
  `downloadAndInstall`) usa `tauri-plugin-updater`, que consulta o GitHub,
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

4. **Publicar uma release no GitHub** (repositório `CilentoX/eco`, tag
   compatível com semver, ex.: `v0.2.0`) anexando o instalador `.exe` como
   asset. O plugin compara a tag com a versão do app (`0.1.0`) e, se houver
   release mais recente com `.sig` válido, baixa e instala silenciosamente.

   No build/CI, defina `TAURI_UPDATER_GITHUB_REPO=CilentoX/eco` para que o
   plugin saiba qual repositório consultar (ou garanta que o remote `origin`
   aponte para `github.com/CilentoX/eco` — o plugin detecta automaticamente
   no build).

5. **CSP** (configurada desde a revisão da Fase 1, em
   `src-tauri/tauri.conf.json` → `app.security.csp`):
   `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob: https:; font-src 'self' data:;
   connect-src 'self' https://eco.litteris.online ipc: http://ipc.localhost`.
   Para baixar o instalador do GitHub, o plugin faz a requisição de saída
   (`https://api.github.com/...` e `https://github.com/.../releases/download/...`).
   Se o CSP bloquear, adicione `https://api.github.com` e
   `https://github.com` ao `connect-src` — nunca reabra `default-src`.

> Sem a chave privada real e o `createUpdaterArtifacts`, o build de
> desenvolvimento funciona normalmente; apenas a instalação de updates
> falhará na verificação de assinatura (esperado até o primeiro release).
