"use client";

import { useEffect, useRef } from "react";

export interface UseVoiceActivityOptions {
  enabled: boolean;
  isMuted: boolean;
  threshold?: number;
  holdTimeMs?: number;
  onSpeakingChange: (speaking: boolean) => void;
}

/**
 * Hook de Detecção de Atividade de Voz (VAD) em Tempo Real.
 * Analisa o fluxo do microfone via Web Audio API e AnalyserNode,
 * disparando automaticamente a animação de fala quando o usuário fala,
 * eliminando a necessidade de botões manuais de teste.
 */
export function useVoiceActivity({
  enabled,
  isMuted,
  threshold = 8,
  holdTimeMs = 350,
  onSpeakingChange,
}: UseVoiceActivityOptions) {
  const isSpeakingRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Se desconectado ou mutado, cancela a fala imediatamente e libera recursos
    if (!enabled || isMuted) {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        onSpeakingChange(false);
      }
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return;
    }

    let isCancelled = false;

    async function initAudio() {
      try {
        if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
          return;
        }

        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextClass) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        mediaStreamRef.current = stream;
        const ctx = new AudioContextClass();
        audioContextRef.current = ctx;

        if (ctx.state === "suspended" && typeof ctx.resume === "function") {
          try {
            await ctx.resume();
          } catch {}
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);

        const buffer = new Uint8Array(analyser.frequencyBinCount);

        intervalRef.current = setInterval(() => {
          if (!audioContextRef.current || !mediaStreamRef.current) return;
          if (audioContextRef.current.state === "suspended" && typeof audioContextRef.current.resume === "function") {
            void audioContextRef.current.resume().catch(() => {});
          }
          analyser.getByteFrequencyData(buffer);

          let sum = 0;
          // Foca a análise de energia na faixa de frequência da voz humana (bins 0 a 48)
          const voiceBins = Math.min(buffer.length, 48);
          for (let i = 0; i < voiceBins; i++) {
            sum += buffer[i]!;
          }
          const averageVolume = voiceBins > 0 ? sum / voiceBins : 0;
          const isLoudEnough = averageVolume > threshold;

          if (isLoudEnough) {
            if (holdTimerRef.current) {
              clearTimeout(holdTimerRef.current);
              holdTimerRef.current = null;
            }
            if (!isSpeakingRef.current) {
              isSpeakingRef.current = true;
              onSpeakingChange(true);
            }
          } else {
            if (isSpeakingRef.current && !holdTimerRef.current) {
              holdTimerRef.current = setTimeout(() => {
                isSpeakingRef.current = false;
                onSpeakingChange(false);
                holdTimerRef.current = null;
              }, holdTimeMs);
            }
          }
        }, 50);
      } catch {
        // Fallback gracioso para ambientes de teste sem hardware de áudio
      }
    }

    void initAudio();

    return () => {
      isCancelled = true;
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        onSpeakingChange(false);
      }
    };
  }, [enabled, isMuted, threshold, holdTimeMs, onSpeakingChange]);
}

