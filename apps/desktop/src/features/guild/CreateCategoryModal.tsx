"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { FolderSimplePlus, X, WarningCircle } from "@phosphor-icons/react";

export interface CreateCategoryModalProps {
  open: boolean;
  onClose: () => void;
  guildId: string;
  onCreateCategory: (name: string) => void;
}

export default function CreateCategoryModal({
  open,
  onClose,
  guildId: _guildId,
  onCreateCategory,
}: CreateCategoryModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a categoria.");
      return;
    }
    onCreateCategory(trimmed);
    setName("");
    setError(null);
    onClose();
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full sm:max-w-[460px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] text-txt p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
      >
        {/* Cabeçalho Superior Fixo (Padrão Guild Modal) */}
        <div className="relative p-6 pb-4 border-b border-white/[0.08] bg-black/20 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
              <FolderSimplePlus size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">
                Criar Categoria
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Organize seus canais de texto e de voz em grupos temáticos.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={handleClose}
            className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Nome da Categoria */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-mut">
                Nome da Categoria
              </label>
              <span className="font-mono text-[11px] text-mut">
                {name.length}/100
              </span>
            </div>
            <input
              type="text"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="Ex: COMUNIDADE, JOGOS, PROJETOS"
              autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
            />
            {error && (
              <p role="alert" className="text-xs text-err flex items-center gap-1.5 mt-2">
                <WarningCircle size={14} weight="bold" />
                {error}
              </p>
            )}
          </div>
        </div>

        {/* Rodapé Padrão */}
        <div className="p-4 border-t border-white/[0.08] bg-black/20 flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-xs font-semibold text-txt hover:bg-white/[0.08] active:scale-95 transition-all text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-xs font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            Criar Categoria
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
