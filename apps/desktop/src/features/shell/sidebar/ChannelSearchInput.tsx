import { MagnifyingGlass } from "@phosphor-icons/react";

interface ChannelSearchInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function ChannelSearchInput({ value, onChange }: ChannelSearchInputProps) {
  return (
    <div className="border-b border-bd-subtle px-3 py-2">
      <div className="flex items-center gap-2 rounded-xl dark:bg-white/[0.03] bg-card-bg/70 border border-bd-subtle px-2.5 py-1.5 text-mut/70 group focus-within:bg-card-bg focus-within:border-acc/40 transition-all">
        <MagnifyingGlass size={13} aria-hidden />
        <input
          type="search"
          placeholder="Buscar canais"
          aria-label="Buscar canais"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-xs text-txt outline-none placeholder:text-mut/50 group-focus-within:text-txt"
        />
      </div>
    </div>
  );
}
