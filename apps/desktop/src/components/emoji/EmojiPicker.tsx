import EmojiPickerReact, {
  Theme,
  EmojiStyle,
  type EmojiClickData,
} from "emoji-picker-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * EmojiPicker moderno do Echo usando emoji-picker-react.
 * Possui suporte completo a Unicode, busca rápida, categorias, tons de pele e tema Dark.
 */
export function EmojiPicker({ onSelect, open, onOpenChange }: EmojiPickerProps) {
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelect(emojiData.emoji);
    onOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span className="hidden" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-auto p-0 border border-white/[0.08] bg-[#12161f] rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          theme={Theme.DARK}
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceHolder="Buscar emoji..."
          width={350}
          height={400}
          lazyLoadEmojis={true}
          previewConfig={{
            showPreview: true,
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;
