---
description: Audita componentes e telas recentes de acordo com o GEMINI.md do Echo
---

Leia o arquivo de diretrizes permanentes de design `GEMINI.md` e faça uma auditoria nos componentes recém-criados ou alterados no `git status`:

1. **Ergonomia Discord vs Identidade Visual Echo:** Verifica se a hierarquia de 4 colunas está respeitada.
2. **Dark Glassmorphism:** Fundos `#0b0e14`, `#10141d`, `#12161f`, bordas translúcidas `border-white/[0.04]` a `border-white/[0.08]` e acento `#0FB9A8`.
3. **Padrão de Diálogos e Modais:** Containers com `bg-[#12161f]`, `rounded-2xl`, `border-white/[0.08]`, `shadow-2xl`, `max-h-[90vh] overflow-y-auto scrollbar-thin`.
4. **Micro-interações:** `cursor-pointer`, `active:scale-[0.98]` em botões e `transition-all`.

Aponte qualquer desvio das regras do GEMINI.md com número de linha e sugestão de correção.

