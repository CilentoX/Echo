"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Waveform } from "@phosphor-icons/react";

export interface AudioPlayerProps {
  src: string;
  duration?: number;
  waveform?: number[];
  isSender?: boolean;
}

export default function AudioPlayer({
  src,
  duration: initialDuration = 0,
  waveform,
  isSender = false,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(initialDuration);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  // Gera waveform padrão se não for fornecido
  const bars = useRef(
    waveform && waveform.length >= 16
      ? waveform.slice(0, 36)
      : Array.from({ length: 32 }, (_, i) => {
          // Curva orgânica realista de fala humana
          const mid = 16;
          const dist = Math.abs(i - mid) / mid;
          const base = 0.2 + (1 - dist) * 0.6;
          const jitter = (Math.sin(i * 1.5) * 0.2);
          return Math.max(0.15, Math.min(1, base + jitter));
        }),
  ).current;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio || !totalDuration) return;

    const pct = index / bars.length;
    const seekTime = pct * totalDuration;
    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audio) {
      audio.playbackRate = nextRate;
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

  return (
    <div
      data-testid="audio-player"
      className="flex flex-col gap-2 p-2 rounded-2xl bg-card-bg/60 border border-bd-subtle max-w-sm select-none"
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Botão Play / Pause */}
        <button
          type="button"
          aria-label={isPlaying ? "Pausar áudio" : "Tocar áudio"}
          onClick={togglePlay}
          className={`cursor-pointer flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all shadow-md active:scale-95 ${
            isSender
              ? "bg-acc text-bg shadow-acc/20 hover:bg-acc-press"
              : "bg-acc text-bg shadow-acc/20 hover:bg-acc-press"
          }`}
        >
          {isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" className="ml-0.5" />}
        </button>

        {/* Visualizador de Waveform Clicável */}
        <div className="flex-1 flex items-center gap-1 h-9 cursor-pointer" title="Clique para avançar/retroceder">
          {bars.map((height, i) => {
            const barProgress = i / bars.length;
            const isPlayed = barProgress <= progress;
            const barHeightPx = Math.max(4, Math.round(height * 28));

            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                style={{ height: `${barHeightPx}px` }}
                className={`w-1 rounded-full transition-all duration-100 hover:scale-y-125 ${
                  isPlayed
                    ? "bg-acc shadow-xs shadow-acc/30"
                    : "bg-bd hover:bg-mut/50"
                }`}
              />
            );
          })}
        </div>

        {/* Alternador de Velocidade */}
        <button
          type="button"
          onClick={cycleSpeed}
          title="Velocidade de reprodução"
          className="cursor-pointer flex h-7 items-center justify-center rounded-lg bg-surf border border-bd-subtle px-1.5 text-[11px] font-mono font-semibold text-mut hover:text-txt active:scale-95 transition-all"
        >
          {playbackRate}x
        </button>
      </div>

      {/* Barra de Tempo e Badge de Voz */}
      <div className="flex items-center justify-between text-[10px] text-mut px-1 font-mono">
        <div className="flex items-center gap-1">
          <Waveform size={12} className="text-acc" />
          <span>Mensagem de voz</span>
        </div>
        <span>
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
      </div>
    </div>
  );
}

