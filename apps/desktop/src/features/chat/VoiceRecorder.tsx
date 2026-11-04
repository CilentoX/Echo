"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play, Trash, PaperPlaneRight } from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";

export interface VoiceRecorderProps {
  onCancel: () => void;
  onSend: (file: File, duration: number, waveform: number[]) => void;
}

export default function VoiceRecorder({ onCancel, onSend }: VoiceRecorderProps) {
  const [, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const waveformPeaksRef = useRef<number[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const microphoneDevice = useSettingsStore((s) => s.microphoneDevice);
  const echoCancellation = useSettingsStore((s) => s.echoCancellation);
  const noiseSuppression = useSettingsStore((s) => s.noiseSuppression);
  const autoGainControl = useSettingsStore((s) => s.autoGainControl);

  const stopAudioCapture = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    stopAudioCapture();
    audioChunksRef.current = [];
    waveformPeaksRef.current = [];
    setSeconds(0);

    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
    if (!md?.getUserMedia) {
      onCancel();
      return;
    }

    try {
      const stream = await md.getUserMedia({
        audio: {
          deviceId: microphoneDevice ? { exact: microphoneDevice } : undefined,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        video: false,
      });
      streamRef.current = stream;

      // Suporte a codecs universais (preferência Opus)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
          ? "audio/ogg;codecs=opus"
          : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100); // chunk a cada 100ms
      setIsRecording(true);
      setIsPaused(false);

      // Inicia timer
      timerIntervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);

      // Web Audio Analyser para extrair onda visual
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkSignal = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128);
          setVolumeLevel(normalized);

          // Armazena peak para a forma de onda
          if (waveformPeaksRef.current.length < 48) {
            waveformPeaksRef.current.push(Number(normalized.toFixed(2)));
          }

          animFrameRef.current = requestAnimationFrame(checkSignal);
        };
        animFrameRef.current = requestAnimationFrame(checkSignal);
      }
    } catch {
      stopAudioCapture();
      onCancel();
    }
  }, [microphoneDevice, echoCancellation, noiseSuppression, autoGainControl, onCancel, stopAudioCapture]);

  useEffect(() => {
    void startRecording();
    return () => {
      stopAudioCapture();
    };
  }, [startRecording, stopAudioCapture]);

  const handlePauseResume = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === "recording") {
      recorder.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    } else if (recorder.state === "paused") {
      recorder.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
  };

  const handleSend = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const mimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      const extension = mimeType.includes("ogg") ? "ogg" : "webm";
      const file = new File(
        [blob],
        `voice_${Date.now()}.${extension}`,
        { type: mimeType },
      );
      stopAudioCapture();
      onSend(file, seconds || 1, waveformPeaksRef.current);
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleDiscard = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopAudioCapture();
    onCancel();
  };

  const formatTimer = (totalSecs: number) => {
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      data-testid="voice-recorder"
      className="flex items-center gap-3 w-full py-1.5 px-3 rounded-2xl bg-surf/80 border border-bd-subtle select-none animate-in fade-in-0 duration-150"
    >
      {/* Indicador de Gravação (Ponto vermelho piscando) */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="relative flex h-3 w-3">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-err opacity-75 ${isPaused ? "hidden" : ""}`} />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-err" />
        </span>
        <span className="font-mono text-xs font-semibold text-txt min-w-[42px]">
          {formatTimer(seconds)}
        </span>
      </div>

      {/* Visualizador de Ondas ao Vivo */}
      <div className="flex-1 flex items-center justify-center gap-1 h-7 px-2 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => {
          const barHeight = Math.max(4, Math.round((volumeLevel + (Math.sin(i + seconds * 2) * 0.3 + 0.3) * volumeLevel) * 24));
          return (
            <div
              key={i}
              style={{ height: `${isPaused ? 4 : barHeight}px` }}
              className={`w-1 rounded-full transition-all duration-75 ${isPaused ? "bg-mut/30" : "bg-acc"}`}
            />
          );
        })}
      </div>

      {/* Controles: Lixeira, Pausar/Retomar, Enviar */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          title="Descartar gravação"
          aria-label="Descartar gravação"
          onClick={handleDiscard}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-mut hover:text-err hover:bg-err/10 active:scale-95 transition-all"
        >
          <Trash size={16} />
        </button>

        <button
          type="button"
          title={isPaused ? "Retomar gravação" : "Pausar gravação"}
          aria-label={isPaused ? "Retomar gravação" : "Pausar gravação"}
          onClick={handlePauseResume}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-mut hover:text-txt dark:hover:bg-white/[0.08] hover:bg-black/[0.06] active:scale-95 transition-all"
        >
          {isPaused ? <Play size={16} weight="fill" /> : <Pause size={16} weight="fill" />}
        </button>

        <button
          type="button"
          title="Enviar mensagem de voz"
          aria-label="Enviar mensagem de voz"
          onClick={handleSend}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl bg-acc text-bg font-semibold shadow-md shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all"
        >
          <PaperPlaneRight size={16} weight="fill" />
        </button>
      </div>
    </div>
  );
}
