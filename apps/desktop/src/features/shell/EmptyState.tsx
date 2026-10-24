import { Compass, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

/**
 * Estado vazio para home sem guildas (estilo Discord):
 * mensagem "Nenhuma guilda ainda" + botão "Criar guilda" (verde água).
 */
export default function EmptyState({ onCreateGuild }: { onCreateGuild?: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <Compass size={40} weight="duotone" className="text-mut" aria-hidden />
      <p role="status" className="text-sm text-mut">Nenhuma guilda ainda.</p>
      <Button
        type="button"
        onClick={onCreateGuild}
        className="bg-acc text-bg font-semibold rounded-xl hover:bg-acc-press transition-colors active:scale-95 px-6 py-2"
        disabled={!onCreateGuild}
      >
        <Plus size={16} className="mr-2" />
        Criar guilda
      </Button>
    </div>
  );
}
