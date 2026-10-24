import { useCallback, useMemo, useRef, useState } from "react";
import { Search, Smile, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * EmojiPicker simples: busca por nome, categorias, skin tone e frecência.
 * Não depende de biblioteca externa — usa um conjunto estático de emojis
 * comuns. Pode ser substituído por um conjunto maior depois.
 */

const EMOJIS = [
  { emoji: "😀", name: "grinning face", keywords: ["face", "smile", "happy"] },
  { emoji: "😃", name: "grinning face with big eyes", keywords: ["face", "smile", "happy"] },
  { emoji: "😄", name: "beaming face with smiling eyes", keywords: ["face", "smile", "happy"] },
  { emoji: "😁", name: "beaming face with smiling eyes", keywords: ["face", "smile", "happy"] },
  { emoji: "😆", name: "grinning squinting face", keywords: ["face", "laugh", "happy"] },
  { emoji: "😅", name: "grinning face with sweat", keywords: ["face", "nervous", "smile"] },
  { emoji: "😂", name: "face with tears of joy", keywords: ["face", "cry", "laugh", "tears"] },
  { emoji: "🤣", name: "rolling on the floor laughing", keywords: ["face", "laugh", "roll"] },
  { emoji: "😊", name: "smiling face with smiling eyes", keywords: ["face", "smile", "happy"] },
  { emoji: "😇", name: "smiling face with halo", keywords: ["face", "angel", "halo"] },
  { emoji: "🙂", name: "slightly smiling face", keywords: ["face", "smile"] },
  { emoji: "🙃", name: "upside-down face", keywords: ["face", "upside"] },
  { emoji: "😉", name: "winking face", keywords: ["face", "wink"] },
  { emoji: "😌", name: "relieved face", keywords: ["face", "relief"] },
  { emoji: "😍", name: "smiling face with heart-eyes", keywords: ["face", "love", "heart"] },
  { emoji: "🥰", name: "smiling face with hearts", keywords: ["face", "love", "hearts"] },
  { emoji: "😘", name: "face blowing a kiss", keywords: ["face", "kiss", "love"] },
  { emoji: "😜", name: "winking face with tongue", keywords: ["face", "wink", "tongue"] },
  { emoji: "😝", name: "squinting face with tongue", keywords: ["face", "tongue"] },
  { emoji: "😛", name: "face with tongue", keywords: ["face", "tongue"] },
  { emoji: "😴", name: "sleeping face", keywords: ["face", "sleep"] },
  { emoji: "😭", name: "loudly crying face", keywords: ["face", "cry", "tears", "sad"] },
  { emoji: "😤", name: "face with steam from nose", keywords: ["face", "anger", "pride"] },
  { emoji: "😡", name: "pouting face", keywords: ["face", "anger", "mad"] },
  { emoji: "😠", name: "angry face", keywords: ["face", "anger", "mad"] },
  { emoji: "🤬", name: "face with symbols on mouth", keywords: ["face", "swear", "anger"] },
  { emoji: "😰", name: "anxious face with sweat", keywords: ["face", "anxious", "sweat"] },
  { emoji: "😱", name: "face screaming in fear", keywords: ["face", "scream", "fear"] },
  { emoji: "😨", name: "fearful face", keywords: ["face", "fear"] },
  { emoji: "😢", name: "crying face", keywords: ["face", "cry", "tears", "sad"] },
  { emoji: "😥", name: "sad but relieved face", keywords: ["face", "sad", "relief"] },
  { emoji: "😓", name: "downcast face with sweat", keywords: ["face", "sweat", "sad"] },
  { emoji: "🤗", name: "hugging face", keywords: ["face", "hug"] },
  { emoji: "🤔", name: "thinking face", keywords: ["face", "think", "thinking"] },
  { emoji: "😐", name: "neutral face", keywords: ["face", "neutral"] },
  { emoji: "😑", name: "expressionless face", keywords: ["face", "expressionless"] },
  { emoji: "😬", name: "grimacing face", keywords: ["face", "grimace"] },
  { emoji: "🙄", name: "face with rolling eyes", keywords: ["face", "roll", "eyes"] },
  { emoji: "😯", name: "hushed face", keywords: ["face", "hushed"] },
  { emoji: "😦", name: "frowning face with open mouth", keywords: ["face", "frown"] },
  { emoji: "😧", name: "anguished face", keywords: ["face", "anguished"] },
  { emoji: "😮", name: "face with open mouth", keywords: ["face", "surprise", "open"] },
  { emoji: "😲", name: "astonished face", keywords: ["face", "astonished"] },
  { emoji: "😴", name: "sleeping face", keywords: ["face", "sleep"] },
  { emoji: "😷", name: "face with medical mask", keywords: ["face", "mask", "sick"] },
  { emoji: "🤒", name: "face with thermometer", keywords: ["face", "sick", "thermometer"] },
  { emoji: "🤕", name: "face with head-bandage", keywords: ["face", "injury", "bandage"] },
  { emoji: "🤢", name: "nauseated face", keywords: ["face", "sick", "nausea"] },
  { emoji: "🤮", name: "face vomiting", keywords: ["face", "vomit", "sick"] },
  { emoji: "🤧", name: "sneezing face", keywords: ["face", "sneeze", "sick"] },
  { emoji: "😎", name: "smiling face with sunglasses", keywords: ["face", "cool", "sunglasses"] },
  { emoji: "🤓", name: "nerd face", keywords: ["face", "nerd", "glasses"] },
  { emoji: "🧐", name: "face with monocle", keywords: ["face", "monocle"] },
  { emoji: "😕", name: "confused face", keywords: ["face", "confused"] },
  { emoji: "😟", name: "worried face", keywords: ["face", "worried"] },
  { emoji: "🙁", name: "slightly frowning face", keywords: ["face", "frown", "sad"] },
  { emoji: "☹️", name: "frowning face", keywords: ["face", "frown", "sad"] },
  { emoji: "😖", name: "confounded face", keywords: ["face", "confounded"] },
  { emoji: "😣", name: "persevering face", keywords: ["face", "persevere"] },
  { emoji: "😩", name: "weary face", keywords: ["face", "weary", "tired"] },
  { emoji: "😫", name: "tired face", keywords: ["face", "tired"] },
  { emoji: "🥺", name: "pleading face", keywords: ["face", "plead", "cute"] },
  { emoji: "😶", name: "face without mouth", keywords: ["face", "mute"] },
  { emoji: "😐", name: "neutral face", keywords: ["face", "neutral"] },
  { emoji: "😑", name: "expressionless face", keywords: ["face", "expressionless"] },
  { emoji: "😏", name: "smirking face", keywords: ["face", "smirk"] },
  { emoji: "😒", name: "unamused face", keywords: ["face", "unamused"] },
  { emoji: "🙂", name: "slightly smiling face", keywords: ["face", "smile"] },
  { emoji: "🤗", name: "hugging face", keywords: ["face", "hug"] },
  { emoji: "🤩", name: "star-struck", keywords: ["face", "star", "eyes"] },
  { emoji: "🥳", name: "partying face", keywords: ["face", "party", "celebrate"] },
  { emoji: "😎", name: "smiling face with sunglasses", keywords: ["face", "cool"] },
];

const SKIN_TONES = ["", "🏻", "🏼", "🏽", "🏾", "🏿"];

type Emoji = { emoji: string; name: string; keywords: string[] };

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmojiPicker({ onSelect, open, onOpenChange }: EmojiPickerProps) {
  const [query, setQuery] = useState("");
  const [skinTone, setSkinTone] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return EMOJIS.filter(
      (e) =>
        e.name.includes(q) || e.keywords.some((k) => k.includes(q)) || e.emoji.includes(q),
    );
  }, [query]);

  const handleSelect = useCallback(
    (emoji: string) => {
      onSelect(emoji + skinTone);
    },
    [onSelect, skinTone],
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          className="p-2 hover:bg-surf2 rounded-lg transition-colors"
          aria-label="Escolher emoji"
        >
          <Smile size={18} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0 bg-surf border border-bd rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 p-2 border-b border-bd bg-surf">
          <Search size={16} className="mut shrink-0" />
          <input
            type="text"
            placeholder="Buscar emoji…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-txt placeholder-mut outline-none text-sm"
            autoFocus
          />
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-surf2 rounded shrink-0 mut"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col h-[420px]">
          <div className="flex-1 overflow-y-auto p-1 space-y-1" ref={scrollRef}>
            {filtered.map((e) => (
              <button
                key={e.emoji + e.name}
                onClick={() => handleSelect(e.emoji)}
                className="w-full flex items-center justify-center gap-2 p-2 rounded hover:bg-surf2 transition-colors text-txt"
                aria-label={e.name}
              >
                <span className="text-2xl">{e.emoji}</span>
                <span className="text-xs mut">{e.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-sm text-mut">Nenhum emoji encontrado</div>
            )}
          </div>

          <div className="flex justify-center gap-1 p-1 border-t border-bd bg-surf">
            {SKIN_TONES.map((tone) => (
              <button
                key={tone || "default"}
                onClick={() => setSkinTone(tone)}
                className={`p-1 rounded-full text-lg transition-colors ${
                  skinTone === tone ? "ring-2 ring-acc" : "hover:bg-surf2"
                }`}
                aria-label={tone || "Padrão"}
              >
                {tone || "👌"}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
