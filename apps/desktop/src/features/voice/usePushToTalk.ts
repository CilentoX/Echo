"use client";

import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useUiStore } from "@/stores/uiStore";
import { webrtcVoice } from "@/lib/media/webrtcVoice";
import { audioEngine } from "@/lib/media/audioEngine";

/**
 * Hook para controle de transmissão Push-to-Talk (PTT) no Echo.
 *
 * Gerencia os atalhos de teclado globais da janela para silenciar/transmitir áudio,
 * aciona animações de fala sincronizadas no WebRTC e reproduz sons de confirmação táteis.
 */
export function usePushToTalk() {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const setSpeaking = useVoiceStore((s) => s.setSpeaking);
  const setParticipantSpeaking = useVoiceStore((s) => s.setParticipantSpeaking);
  const myUserId = useUiStore((s) => s.myUserId);

  const inputMode = useSettingsStore((s) => s.inputMode);
  const pushToTalkKey = useSettingsStore((s) => s.pushToTalkKey);
  const microphoneEnabled = useSettingsStore((s) => s.microphoneEnabled);
  const headphonesEnabled = useSettingsStore((s) => s.headphonesEnabled);
  const pttActive = useSettingsStore((s) => s.pttActive);
  const setPttActive = useSettingsStore((s) => s.setPttActive);

  const releaseTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isHoldingKeyRef = useRef(false);

  // Sincroniza estado inicial do microfone ao entrar/sair do modo PTT
  useEffect(() => {
    if (!isConnected) {
      if (pttActive) setPttActive(false);
      isHoldingKeyRef.current = false;
      return;
    }

    if (inputMode === "push_to_talk") {
      // No modo PTT, o microfone fica mudo por padrão até pressionar a tecla
      if (!isHoldingKeyRef.current) {
        webrtcVoice.setMicrophoneMuted(true);
        setSpeaking(false);
      }
    } else {
      // No modo Voice Activity, respeita a preferência geral do microfone
      webrtcVoice.setMicrophoneMuted(!microphoneEnabled || !headphonesEnabled);
    }
  }, [isConnected, inputMode, microphoneEnabled, headphonesEnabled]);

  useEffect(() => {
    if (!isConnected || inputMode !== "push_to_talk") {
      return;
    }

    const isModifierKey = (code: string) =>
      code.startsWith("Control") ||
      code.startsWith("Shift") ||
      code.startsWith("Alt") ||
      code.startsWith("Meta") ||
      code.startsWith("F") ||
      code === "CapsLock";

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora repetições automáticas do SO
      if (e.repeat) return;

      const activeEl = document.activeElement;
      const isInputActive =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable);

      // Se o usuário estiver digitando no chat e o atalho não for um modificador, ignora
      if (isInputActive && !isModifierKey(e.code)) {
        return;
      }

      if (e.code === pushToTalkKey) {
        isHoldingKeyRef.current = true;

        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }

        // Se o usuário estiver desmutado nas configurações globais
        if (microphoneEnabled && headphonesEnabled) {
          setPttActive(true);
          webrtcVoice.setMicrophoneMuted(false);
          setSpeaking(true);
          if (myUserId) {
            setParticipantSpeaking(myUserId, true);
          }
          setParticipantSpeaking("me", true);
          void audioEngine.playPttActivate();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === pushToTalkKey) {
        isHoldingKeyRef.current = false;

        // Hang time de 150ms para evitar corte abrupto da última sílaba falada
        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
        }

        releaseTimerRef.current = setTimeout(() => {
          setPttActive(false);
          webrtcVoice.setMicrophoneMuted(true);
          setSpeaking(false);
          if (myUserId) {
            setParticipantSpeaking(myUserId, false);
          }
          setParticipantSpeaking("me", false);
          void audioEngine.playPttDeactivate();
          releaseTimerRef.current = null;
        }, 150);
      }
    };

    const handleBlur = () => {
      // Se a janela perder o foco enquanto segura a tecla, libera a transmissão por segurança
      if (isHoldingKeyRef.current) {
        isHoldingKeyRef.current = false;
        setPttActive(false);
        webrtcVoice.setMicrophoneMuted(true);
        setSpeaking(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
    };
  }, [isConnected, inputMode, pushToTalkKey, microphoneEnabled, headphonesEnabled, myUserId, setSpeaking, setParticipantSpeaking, setPttActive]);
}

