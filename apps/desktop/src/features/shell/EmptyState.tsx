import { Compass } from "@phosphor-icons/react";

/**
 * Estado vazio de conta recém-criada, sem guildas (Review Focus 2):
 * mensagem "Entrar com convite" em vez de colunas em branco.
 * Convites em si chegam na Fase 2 — por agora é somente a tela.
 */
export default function EmptyState() {
  return (
    <div
      role="status"
      className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
    >
      <Compass size={32} weight="duotone" className="text-mut" aria-hidden />
      <p className="text-sm text-mut">
        Você ainda não está em nenhuma comunidade. Entre com um convite.
      </p>
    </div>
  );
}
