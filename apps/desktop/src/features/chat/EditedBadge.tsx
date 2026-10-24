/**
 * Selo pequeno "editado" exibido abaixo da hora quando a mensagem foi
 * editada (editedAt definido).
 */
export interface EditedBadgeProps {
  editedAt: number;
}

export default function EditedBadge({ editedAt }: EditedBadgeProps) {
  const time = new Date(editedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <span
      data-testid="edited-badge"
      className="ml-1 inline-block rounded border border-acc/40 bg-acc/10 px-1 text-[10px] font-bold uppercase tracking-wide text-acc"
    >
      editado {time}
    </span>
  );
}
