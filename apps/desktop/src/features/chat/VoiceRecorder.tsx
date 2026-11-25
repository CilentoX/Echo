"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Pause, Play, Stop, Trash, PaperPlaneRight } from "@phosphor-icons/react";
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
  const [previewData, setPreviewData] = useState<{
    file: File;
    url: string;
    duration: number;
    waveform: number[];
  } | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

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
      onCancelRef.current();
      return;
    }

    try {
      const stream = await md.getUserMedia({
        audio: {
          deviceId:
            microphoneDevice && microphoneDevice !== "default"
              ? { ideal: microphoneDevice }
              : undefined,
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
      onCancelRef.current();
    }
  }, [microphoneDevice, echoCancellation, noiseSuppression, autoGainControl, stopAudioCapture]);

  useEffect(() => {
    void startRecording();
    return () => {
      stopAudioCapture();
    };
  }, [startRecording, stopAudioCapture]);

  useEffect(() => {
    return () => {
      if (previewData?.url) {
        URL.revokeObjectURL(previewData.url);
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, [previewData]);

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

  const buildRecordedFile = (recorder: MediaRecorder) => {
    const mimeType = recorder.mimeType || "audio/webm";
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    const extension = mimeType.includes("ogg") ? "ogg" : "webm";
    return new File([blob], `voice_${Date.now()}.${extension}`, { type: mimeType });
  };

  const handleStopToPreview = () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const file = buildRecordedFile(recorder);
      const url = URL.createObjectURL(file);
      const duration = seconds || 1;
      const waveform = [...waveformPeaksRef.current];
      stopAudioCapture();
      setPreviewData({ file, url, duration, waveform });
      setPreviewProgress(0);
      setIsPreviewPlaying(false);
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleTogglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (isPreviewPlaying) {
      audio.pause();
      setIsPreviewPlaying(false);
    } else {
      void audio.play().then(() => setIsPreviewPlaying(true)).catch(() => {});
    }
  };

  const handleSend = () => {
    if (previewData) {
      if (previewAudioRef.current) previewAudioRef.current.pause();
      onSend(previewData.file, previewData.duration, previewData.waveform);
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      const file = buildRecordedFile(recorder);
      stopAudioCapture();
      onSend(file, seconds || 1, waveformPeaksRef.current);
    };

    if (recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const handleDiscard = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
    }
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

  if (previewData) {
    return (
      <div
        data-testid="voice-recorder"
        className="flex items-center gap-3 w-full py-1.5 px-3 rounded-2xl bg-surf/80 border border-acc/30 select-none animate-in fade-in-0 duration-150"
      >
        <audio
          ref={previewAudioRef}
          src={previewData.url}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration && Number.isFinite(el.duration)) {
              setPreviewProgress((el.currentTime / el.duration) * 100);
            }
          }}
          onEnded={() => {
            setIsPreviewPlaying(false);
            setPreviewProgress(0);
          }}
        />
        <button
          type="button"
          title={isPreviewPlaying ? "Pausar prévia" : "Ouvir prévia"}
          aria-label={isPreviewPlaying ? "Pausar prévia" : "Ouvir prévia"}
          onClick={handleTogglePreviewPlay}
          className="cursor-pointer flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-acc/15 text-acc hover:bg-acc/25 active:scale-95 transition-all"
        >
          {isPreviewPlaying ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
        </button>

        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="h-1.5 w-full rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className="h-full bg-acc rounded-full transition-all duration-100"
              style={{ width: `${previewProgress}%` }}
            />
          </div>
        </div>

        <span className="font-mono text-xs font-semibold text-txt shrink-0">
          {formatTimer(previewData.duration)}
        </span>

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

      {/* Controles: Lixeira, Pausar/Retomar, Parar e Ouvir, Enviar */}
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
          title="Parar e ouvir prévia"
          aria-label="Parar e ouvir prévia"
          onClick={handleStopToPreview}
          className="cursor-pointer flex h-8 w-8 items-center justify-center rounded-xl text-mut hover:text-acc dark:hover:bg-white/[0.08] hover:bg-black/[0.06] active:scale-95 transition-all"
        >
          <Stop size={16} weight="fill" />
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
