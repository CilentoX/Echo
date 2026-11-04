"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Headphones,
  Microphone,
  Play,
  Sliders,
  SpeakerHigh,
} from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioEngine } from "@/lib/media/audioEngine";
import { FALLBACK_DEVICES, listRealDevices, type DeviceLists } from "@/lib/media/devices";

export interface AudioDeviceQuickMenuProps {
  onClose: () => void;
  onOpenVoiceSettings?: () => void;
}

export default function AudioDeviceQuickMenu({
  onClose,
  onOpenVoiceSettings,
}: AudioDeviceQuickMenuProps) {
  const {
    microphoneDevice,
    setMicrophoneDevice,
    headphonesDevice,
    setHeadphonesDevice,
    inputVolume,
    setInputVolume,
    outputVolume,
    setOutputVolume,
  } = useSettingsStore();

  const [devices, setDevices] = useState<DeviceLists>(FALLBACK_DEVICES);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);

  useEffect(() => {
    let alive = true;
    listRealDevices()
      .then((d) => {
        if (alive) setDevices(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handleTestSound = async () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);
    try {
      await audioEngine.playTestChime(headphonesDevice, outputVolume);
    } finally {
      setTimeout(() => setIsPlayingTestSound(false), 700);
    }
  };

  return (
    <div
      data-testid="audio-device-quick-menu"
      className="w-72 rounded-2xl border border-bd-glass bg-card-bg/95 p-3 shadow-2xl backdrop-blur-xl select-none text-txt space-y-3 font-ui"
    >
      {/* Título & Atalho para Teste de Som */}
      <div className="flex items-center justify-between px-1 pb-1 border-b border-bd-subtle">
        <span className="font-display text-xs font-bold uppercase tracking-wider text-mut">
          Dispositivos de Áudio
        </span>
        <button
          type="button"
          onClick={handleTestSound}
          title="Tocar som de teste"
          aria-label="Tocar som de teste"
          className="cursor-pointer flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-acc hover:bg-acc/10 active:scale-95 transition-all"
        >
          {isPlayingTestSound ? (
            <SpeakerHigh size={12} className="animate-pulse" />
          ) : (
            <Play size={12} weight="fill" />
          )}
          <span>{isPlayingTestSound ? "Tocando..." : "Testar"}</span>
        </button>
      </div>

      {/* Seção Microfone (Entrada) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-txt">
            <Microphone size={14} className="text-acc" weight="bold" />
            <span>Microfone</span>
          </div>
          <span className="text-[10px] font-mono text-mut">{inputVolume}%</span>
        </div>

        {/* Lista de Microfones */}
        <div className="space-y-0.5 max-h-28 overflow-y-auto pr-0.5">
          <button
            type="button"
            onClick={() => setMicrophoneDevice(null)}
            className={`cursor-pointer flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors ${
              !microphoneDevice
                ? "bg-acc/10 font-semibold text-acc"
                : "text-mut hover:bg-surf hover:text-txt"
            }`}
          >
            <span className="truncate">Padrão do sistema</span>
            {!microphoneDevice && <Check size={12} weight="bold" />}
          </button>
          {devices.microphone.map((d) => {
            const isSelected = microphoneDevice === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setMicrophoneDevice(d.id)}
                className={`cursor-pointer flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-acc/10 font-semibold text-acc"
                    : "text-mut hover:bg-surf hover:text-txt"
                }`}
              >
                <span className="truncate">{d.label}</span>
                {isSelected && <Check size={12} weight="bold" />}
              </button>
            );
          })}
        </div>

        {/* Mini Slider de Volume do Microfone */}
        <div className="px-1 pt-0.5">
          <input
            type="range"
            min="0"
            max="100"
            value={inputVolume}
            onChange={(e) => setInputVolume(Number(e.target.value))}
            className="w-full accent-acc cursor-pointer h-1 rounded-lg bg-bd-subtle"
          />
        </div>
      </div>

      {/* Seção Fone / Saída */}
      <div className="space-y-1.5 pt-1 border-t border-bd-subtle">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-txt">
            <Headphones size={14} className="text-acc" weight="bold" />
            <span>Saída de Áudio</span>
          </div>
          <span className="text-[10px] font-mono text-mut">{outputVolume}%</span>
        </div>

        {/* Lista de Saídas */}
        <div className="space-y-0.5 max-h-28 overflow-y-auto pr-0.5">
          <button
            type="button"
            onClick={() => setHeadphonesDevice(null)}
            className={`cursor-pointer flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors ${
              !headphonesDevice
                ? "bg-acc/10 font-semibold text-acc"
                : "text-mut hover:bg-surf hover:text-txt"
            }`}
          >
            <span className="truncate">Padrão do sistema</span>
            {!headphonesDevice && <Check size={12} weight="bold" />}
          </button>
          {devices.headphones.map((d) => {
            const isSelected = headphonesDevice === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setHeadphonesDevice(d.id)}
                className={`cursor-pointer flex w-full items-center justify-between rounded-lg px-2 py-1 text-left text-xs transition-colors ${
                  isSelected
                    ? "bg-acc/10 font-semibold text-acc"
                    : "text-mut hover:bg-surf hover:text-txt"
                }`}
              >
                <span className="truncate">{d.label}</span>
                {isSelected && <Check size={12} weight="bold" />}
              </button>
            );
          })}
        </div>

        {/* Mini Slider de Volume de Saída */}
        <div className="px-1 pt-0.5">
          <input
            type="range"
            min="0"
            max="100"
            value={outputVolume}
            onChange={(e) => setOutputVolume(Number(e.target.value))}
            className="w-full accent-acc cursor-pointer h-1 rounded-lg bg-bd-subtle"
          />
        </div>
      </div>

      {/* Link para Configurações Completas de Voz */}
      <div className="pt-1 border-t border-bd-subtle">
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenVoiceSettings?.();
          }}
          className="cursor-pointer flex w-full items-center justify-center gap-2 rounded-xl border border-bd-subtle bg-surf/80 px-3 py-2 text-xs font-semibold text-txt hover:border-acc/40 hover:bg-surf hover:text-acc active:scale-95 transition-all shadow-xs"
        >
          <Sliders size={14} weight="bold" />
          <span>Configurações de Voz & Vídeo</span>
        </button>
      </div>
    </div>
  );
}

