import { useState, useRef, useMemo } from "react";
import EmojiPickerReact, {
  Theme,
  EmojiStyle,
  SkinTones,
  Categories,
  type EmojiClickData,
  type CustomEmoji,
} from "emoji-picker-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useUiStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";

export type EmojiPickerProps = {
  children?: React.ReactNode;
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SKIN_TONES = [
  { tone: SkinTones.NEUTRAL, label: "Padrão", color: "#FFDC5D" },
  { tone: SkinTones.LIGHT, label: "Claro", color: "#FADCBC" },
  { tone: SkinTones.MEDIUM_LIGHT, label: "Médio-Claro", color: "#E0BB95" },
  { tone: SkinTones.MEDIUM, label: "Médio", color: "#BF8F68" },
  { tone: SkinTones.MEDIUM_DARK, label: "Médio-Escuro", color: "#9B643D" },
  { tone: SkinTones.DARK, label: "Escuro", color: "#594539" },
];

const CATEGORIES = [
  { category: Categories.SUGGESTED, name: "Recentes" },
  { category: Categories.SMILEYS_PEOPLE, name: "Carinhas e Pessoas" },
  { category: Categories.ANIMALS_NATURE, name: "Animais e Natureza" },
  { category: Categories.FOOD_DRINK, name: "Comida e Bebida" },
  { category: Categories.TRAVEL_PLACES, name: "Viagens e Lugares" },
  { category: Categories.ACTIVITIES, name: "Atividades" },
  { category: Categories.OBJECTS, name: "Objetos" },
  { category: Categories.SYMBOLS, name: "Símbolos" },
  { category: Categories.FLAGS, name: "Bandeiras" },
];

/**
 * EmojiPicker moderno do Echo com Dark Glassmorphism,
 * seletor de tom de pele dinâmico por hover e categorias em português.
 */
export function EmojiPicker({
  children,
  onSelect,
  open,
  onOpenChange,
}: EmojiPickerProps) {
  const mode = useThemeStore((s) => s.mode);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const guilds = useSyncStore((s) => s.guilds);
  const guildEmojis = useSyncStore((s) => s.guildEmojis);

  const customEmojis: CustomEmoji[] | undefined = useMemo(() => {
    if (!activeGuildId || activeGuildId === "home") return undefined;
    const list = guildEmojis[activeGuildId] ?? [];
    if (list.length === 0) return undefined;
    const activeGuild = guilds.find((g) => g.guildId === activeGuildId);
    return list.map((e) => ({
      id: e.id,
      names: [e.name],
      imgUrl: e.url,
      group: activeGuild?.name ?? "Servidor",
    }));
  }, [activeGuildId, guildEmojis, guilds]);

  const [skinTone, setSkinTone] = useState<SkinTones>(SkinTones.NEUTRAL);
  const [isHoveringSkinTones, setIsHoveringSkinTones] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterToneArea = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHoveringSkinTones(true);
  };

  const handleMouseLeaveToneArea = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHoveringSkinTones(false);
    }, 250);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    if (emojiData.isCustom || (emojiData as any).imageUrl) {
      onSelect(`:${emojiData.names?.[0] || "emoji"}: `);
    } else {
      onSelect(emojiData.emoji);
    }
    onOpenChange(false);
  };

  const currentToneObj =
    SKIN_TONES.find((s) => s.tone === skinTone) ?? SKIN_TONES[0];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children ?? (
          <button
            type="button"
            className="cursor-pointer p-1.5 dark:hover:bg-white/[0.06] hover:bg-black/[0.06] rounded-xl transition-colors text-mut hover:text-txt"
            aria-label="Escolher emoji"
          >
            <Smile size={18} />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={10}
        className="w-[360px] p-0 border border-bd-glass bg-card-bg rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
      >
        {/* Barra Superior Echo com Seletor de Tom de Pele Interativo no Hover */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-bd-subtle bg-userbar-bg select-none">
          <div className="flex items-center gap-1.5">
            <Smile size={14} className="text-acc" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-txt/90">
              Emojis
            </span>
          </div>

          {/* Seletor com expansão ao passar o mouse */}
          <div
            className="relative flex items-center"
            onMouseEnter={handleMouseEnterToneArea}
            onMouseLeave={handleMouseLeaveToneArea}
          >
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-xl transition-all duration-200 border ${
                isHoveringSkinTones
                  ? "dark:bg-white/[0.08] bg-black/[0.05] dark:border-white/[0.12] border-black/[0.1] shadow-lg shadow-black/20"
                  : "dark:bg-white/[0.03] bg-black/[0.03] dark:border-white/[0.05] border-black/[0.06] dark:hover:bg-white/[0.06] hover:bg-black/[0.05]"
              }`}
            >
              <span className="text-[11px] text-mut font-medium mr-0.5">
                Tom:
              </span>

              {isHoveringSkinTones ? (
                <div
                  data-testid="skin-tone-hover-list"
                  className="flex items-center gap-1 animate-in fade-in-0 duration-150"
                >
                  {SKIN_TONES.map((item) => {
                    const active = item.tone === skinTone;
                    return (
                      <button
                        key={item.tone}
                        type="button"
                        title={item.label}
                        aria-label={item.label}
                        onMouseEnter={() => setSkinTone(item.tone)}
                        onClick={() => {
                          setSkinTone(item.tone);
                          setIsHoveringSkinTones(false);
                        }}
                        className={`cursor-pointer flex h-6 w-6 items-center justify-center rounded-lg transition-all duration-150 ${
                          active
                            ? "bg-acc/20 ring-1 ring-acc scale-110 shadow-sm shadow-acc/30"
                            : "dark:hover:bg-white/[0.1] hover:bg-black/[0.08] hover:scale-105"
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shadow-inner ring-1 ring-black/20"
                          style={{ backgroundColor: item.color }}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <button
                  type="button"
                  title="Passe o mouse para mudar o tom de pele"
                  className="cursor-pointer flex items-center gap-1 px-1 py-0.5 rounded-lg transition-colors"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-sm ring-1 ring-black/10 dark:ring-white/30"
                    style={{ backgroundColor: currentToneObj.color }}
                  />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* EmojiPickerReact com Tema Adaptativo (Light/Dark) e Categorias em Português */}
        <EmojiPickerReact
          onEmojiClick={handleEmojiClick}
          customEmojis={customEmojis}
          theme={mode === "light" ? Theme.LIGHT : Theme.DARK}
          emojiStyle={EmojiStyle.NATIVE}
          searchPlaceHolder="Buscar emoji..."
          width="100%"
          height={390}
          lazyLoadEmojis={true}
          skinTone={skinTone}
          skinTonesDisabled={true}
          categories={CATEGORIES}
          previewConfig={{
            showPreview: true,
            defaultCaption: "Escolha um emoji...",
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;
