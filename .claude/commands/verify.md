---
description: Executa verificação completa de tipos, testes unitários e Rust no Echo
---

Execute as seguintes verificações estritas em sequência:

1. Verifique a tipagem estrita do TypeScript:
   `pnpm --prefix apps/desktop tsc --noEmit`
2. Execute todos os testes unitários com Vitest:
   `pnpm --prefix apps/desktop test`
3. Verifique a compilação do Rust no Tauri (se houver arquivos Rust alterados):
   `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`

Apresente um resumo claro: status de cada verificação, erros encontrados (se houver) e se o projeto está pronto para commit.

