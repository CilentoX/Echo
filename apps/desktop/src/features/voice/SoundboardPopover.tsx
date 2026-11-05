"use client";

import { useState } from "react";
import { SpeakerHigh, Sparkle } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface SoundEffect {
  id: string;
  name: string;
  emoji: string;
  color: string;
  play: () => void;
}

// Web Audio API Synthesizer Sounds
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
}

function playCoin() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(987.77, now); // B5
  osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.35);
}

function playVictory() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
  notes.forEach((freq, i) => {
    const now = ctx.currentTime + i * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (i === 3 ? 0.45 : 0.2));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (i === 3 ? 0.45 : 0.2));
  });
}

function playAirhorn() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const freqs = [466.16, 466.16 * 1.5]; // Bb4
  freqs.forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.05, now + 0.25);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  });
}

function playBaDumTss() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  // Ba
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.frequency.setValueAtTime(140, now);
  osc1.frequency.exponentialRampToValueAtTime(60, now + 0.1);
  gain1.gain.setValueAtTime(0.25, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.12);

  // Dum
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.frequency.setValueAtTime(120, now + 0.15);
  osc2.frequency.exponentialRampToValueAtTime(50, now + 0.25);
  gain2.gain.setValueAtTime(0.25, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.15);
  osc2.stop(now + 0.27);

  // Tss (high cymbal)
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = "triangle";
  osc3.frequency.setValueAtTime(3500, now + 0.32);
  gain3.gain.setValueAtTime(0.15, now + 0.32);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(now + 0.32);
  osc3.stop(now + 0.6);
}

function playClap() {
  const ctx = getAudioContext();
  if (!ctx) return;
  for (let i = 0; i < 4; i++) {
    const now = ctx.currentTime + i * 0.04;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
}

function playGG() {
  const ctx = getAudioContext();
  if (!ctx) return;
  const freqs = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
  freqs.forEach((freq, idx) => {
    const now = ctx.currentTime + idx * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  });
}

export const SOUNDBOARD_EFFECTS: SoundEffect[] = [
  { id: "clap", name: "Aplausos", emoji: "👏", color: "from-amber-500/20 to-orange-500/20", play: playClap },
  { id: "victory", name: "Vitória", emoji: "🎺", color: "from-emerald-500/20 to-teal-500/20", play: playVictory },
  { id: "horn", name: "Buzina", emoji: "📢", color: "from-rose-500/20 to-red-500/20", play: playAirhorn },
  { id: "badumtss", name: "Ba-Dum-Tss", emoji: "🥁", color: "from-purple-500/20 to-indigo-500/20", play: playBaDumTss },
  { id: "coin", name: "Moeda 8-bit", emoji: "🪙", color: "from-yellow-500/20 to-amber-500/20", play: playCoin },
  { id: "gg", name: "GG Well Played", emoji: "💥", color: "from-sky-500/20 to-blue-500/20", play: playGG },
];

export interface SoundboardPopoverProps {
  onPlaySound?: (sound: SoundEffect) => void;
}

export default function SoundboardPopover({ onPlaySound }: SoundboardPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);

  const handlePlay = (sound: SoundEffect) => {
    sound.play();
    setActiveSoundId(sound.id);
    onPlaySound?.(sound);
    setTimeout(() => setActiveSoundId((curr) => (curr === sound.id ? null : curr)), 600);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Soundboard comunitário"
          aria-label="Soundboard comunitário"
          className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-txt hover:bg-white/[0.12] border border-bd-subtle transition-all active:scale-95"
        >
          <SpeakerHigh size={18} weight="bold" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="center"
        sideOffset={12}
        className="w-72 p-3 bg-[#12161f]/95 border border-white/[0.08] backdrop-blur-2xl rounded-2xl shadow-2xl text-txt z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-1.5">
            <Sparkle size={15} weight="bold" className="text-acc" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-txt">
              Soundboard
            </h4>
          </div>
          <span className="text-[10px] text-mut font-mono">6 efeitos</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {SOUNDBOARD_EFFECTS.map((sound) => {
            const isPlaying = activeSoundId === sound.id;

            return (
              <button
                key={sound.id}
                type="button"
                onClick={() => handlePlay(sound)}
                className={`cursor-pointer flex items-center gap-2 p-2 rounded-xl border text-left transition-all active:scale-95 ${
                  isPlaying
                    ? "bg-acc text-bg border-acc shadow-lg shadow-acc/30 scale-105"
                    : "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06] text-txt"
                }`}
              >
                <span className="text-lg shrink-0">{sound.emoji}</span>
                <span className="text-xs font-semibold truncate leading-tight">
                  {sound.name}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

