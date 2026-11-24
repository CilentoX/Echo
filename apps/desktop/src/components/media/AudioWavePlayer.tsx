"use client";

import { useEffect, useRef, useState, memo } from "react";
import WaveSurfer from "wavesurfer.js";
import { Play, Pause } from "@phosphor-icons/react";

export interface AudioWavePlayerProps {
  url: string;
  className?: string;
}

export const AudioWavePlayer = memo(function AudioWavePlayer({
  url,
  className = "",
}: AudioWavePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [totalDuration, setTotalDuration] = useState("0:00");
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
      setIsLoading(false);
      return;
    }

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#2A3546",
      progressColor: "#0FB9A8",
      cursorColor: "#0FB9A8",
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height: 38,
      normalize: true,
      url,
    });

    wavesurferRef.current = ws;

    ws.on("ready", () => {
      setIsLoading(false);
      setTotalDuration(formatTime(ws.getDuration()));
    });

    ws.on("timeupdate", (time) => {
      setCurrentTime(formatTime(time));
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      ws.seekTo(0);
    });

    return () => {
      ws.destroy();
    };
  }, [url]);

  const togglePlay = () => {
    if (!wavesurferRef.current) return;
    wavesurferRef.current.playPause();
  };

  const cyclePlaybackRate = () => {
    if (!wavesurferRef.current) return;
    const rates = [1, 1.5, 2];
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    wavesurferRef.current.setPlaybackRate(nextRate);
    setPlaybackRate(nextRate);
  };

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-2xl bg-[#12161f] border border-white/[0.08] shadow-md max-w-sm w-full select-none ${className}`}
    >
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className="w-9 h-9 rounded-xl bg-acc text-bg flex items-center justify-center shrink-0 hover:bg-acc-press active:scale-95 transition-all shadow-md shadow-acc/20 cursor-pointer disabled:opacity-50"
        title={isPlaying ? "Pausar" : "Reproduzir"}
      >
        {isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" className="ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div ref={containerRef} className="w-full h-[38px] cursor-pointer" />
        <div className="flex items-center justify-between text-[11px] font-mono text-mut">
          <span>{currentTime}</span>
          <span>{totalDuration}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={cyclePlaybackRate}
        className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-txt font-mono text-[11px] font-semibold shrink-0 cursor-pointer active:scale-95 transition-all"
        title="Velocidade de reprodução"
      >
        {playbackRate}x
      </button>

      <audio src={url} className="sr-only" preload="none" aria-hidden="true" />
    </div>
  );
});
