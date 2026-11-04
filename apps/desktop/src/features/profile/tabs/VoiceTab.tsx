"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Microphone,
  Headphones,
  SpeakerHigh,
  VideoCamera,
  Play,
  Stop,
  Sparkle,
  Waveform,
  Sliders,
  Check,
} from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";
import { audioEngine } from "@/lib/media/audioEngine";
import { FALLBACK_DEVICES, listRealDevices, type DeviceLists } from "@/lib/media/devices";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function VoiceTab() {
  const {
    microphoneEnabled,
    microphoneDevice,
    setMicrophoneDevice,
    headphonesEnabled,
    headphonesDevice,
    setHeadphonesDevice,
    cameraEnabled,
    cameraDevice,
    setCameraDevice,
    inputVolume,
    setInputVolume,
    outputVolume,
    setOutputVolume,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    autoGainControl,
    setAutoGainControl,
    inputMode,
    setInputMode,
    pushToTalkKey,
    setPushToTalkKey,
  } = useSettingsStore();

  const [devices, setDevices] = useState<DeviceLists>(FALLBACK_DEVICES);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [isTestingMic, setIsTestingMic] = useState<boolean>(false);
  const [isPlayingTestSound, setIsPlayingTestSound] = useState<boolean>(false);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState<boolean>(false);

  // Enumera dispositivos ao montar o componente
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

  // Monitora o nível do microfone quando estiver na aba de voz
  useEffect(() => {
    if (!microphoneEnabled) {
      setMicLevel(0);
      return;
    }

    let active = true;
    audioEngine
      .startMeter(
        (level) => {
          if (active) setMicLevel(level);
        },
        {
          deviceId: microphoneDevice,
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
      )
      .catch(() => {
        if (active) setMicLevel(0);
      });

    return () => {
      active = false;
      audioEngine.stopMeter();
    };
  }, [microphoneDevice, microphoneEnabled, echoCancellation, noiseSuppression, autoGainControl]);

  // Limpa o teste de loopback ao desmontar
  useEffect(() => {
    return () => {
      audioEngine.stopMicTest();
    };
  }, []);

  const handleToggleMicTest = async () => {
    if (isTestingMic) {
      audioEngine.stopMicTest();
      setIsTestingMic(false);
    } else {
      try {
        await audioEngine.startMicTest(microphoneDevice, headphonesDevice);
        setIsTestingMic(true);
      } catch (err) {
        console.warn("[VoiceTab] Falha ao testar microfone:", err);
        setIsTestingMic(false);
      }
    }
  };

  const handlePlayTestSound = async () => {
    if (isPlayingTestSound) return;
    setIsPlayingTestSound(true);
    try {
      await audioEngine.playTestChime(headphonesDevice, outputVolume);
    } catch (err) {
      console.warn("[VoiceTab] Falha ao tocar som de teste:", err);
    } finally {
      setTimeout(() => setIsPlayingTestSound(false), 800);
    }
  };

  const handleKeyDownHotkey = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPushToTalkKey(e.code);
      setIsRecordingHotkey(false);
    },
    [setPushToTalkKey],
  );

  useEffect(() => {
    if (isRecordingHotkey) {
      window.addEventListener("keydown", handleKeyDownHotkey, { once: true });
      return () => {
        window.removeEventListener("keydown", handleKeyDownHotkey);
      };
    }
  }, [isRecordingHotkey, handleKeyDownHotkey]);

  return (
    <div className="space-y-6 select-none">
      {/* Header com ícone e badge */}
      <div className="flex items-center justify-between pb-3 border-b border-bd-subtle">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-acc/10 text-acc border border-acc/20 shadow-xs">
            <Sliders size={20} weight="bold" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-txt">Voz & Dispositivos</h3>
            <p className="text-xs text-mut">Controle de microfone, fones de ouvido e processamento sonoro</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-acc/10 border border-acc/20 text-[11px] font-medium text-acc">
          <Sparkle size={12} weight="fill" />
          <span>Echo Audio Studio</span>
        </div>
      </div>

      {/* Dispositivos Principais (Microfone & Saída) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Dispositivo de Entrada (Microfone) */}
        <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-txt font-semibold text-xs uppercase tracking-wider">
              <Microphone size={16} className="text-acc" weight="bold" />
              <span>Dispositivo de Entrada</span>
            </div>
            <span className="text-[11px] font-mono text-mut">{inputVolume}%</span>
          </div>

          <Select
            value={microphoneDevice ?? ""}
            onValueChange={(val) => setMicrophoneDevice(val || null)}
          >
            <SelectTrigger className="w-full cursor-pointer rounded-xl border border-bd-subtle bg-card-bg px-3 py-2 text-xs text-txt outline-none hover:border-acc/40 transition-colors">
              <SelectValue placeholder="Microfone padrão do sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Padrão do sistema</SelectItem>
              {devices.microphone.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Volume de Entrada */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-mut font-medium">
              <span>Volume de Entrada</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={inputVolume}
              onChange={(e) => setInputVolume(Number(e.target.value))}
              className="w-full accent-acc cursor-pointer h-1.5 rounded-lg bg-bd-subtle"
            />
          </div>
        </div>

        {/* Dispositivo de Saída (Fones de ouvido / Alto-falantes) */}
        <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-txt font-semibold text-xs uppercase tracking-wider">
              <Headphones size={16} className="text-acc" weight="bold" />
              <span>Dispositivo de Saída</span>
            </div>
            <span className="text-[11px] font-mono text-mut">
              {headphonesEnabled ? `${outputVolume}%` : "Desativado"}
            </span>
          </div>

          <Select
            value={headphonesDevice ?? ""}
            onValueChange={(val) => setHeadphonesDevice(val || null)}
          >
            <SelectTrigger className="w-full cursor-pointer rounded-xl border border-bd-subtle bg-card-bg px-3 py-2 text-xs text-txt outline-none hover:border-acc/40 transition-colors">
              <SelectValue placeholder="Saída padrão do sistema" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Padrão do sistema</SelectItem>
              {devices.headphones.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Volume de Saída */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-mut font-medium">
              <span>Volume de Saída</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={outputVolume}
              onChange={(e) => setOutputVolume(Number(e.target.value))}
              className="w-full accent-acc cursor-pointer h-1.5 rounded-lg bg-bd-subtle"
            />
          </div>
        </div>
      </div>

      {/* Monitor de Microfone em Tempo Real (VU Meter) e Teste de Som */}
      <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Waveform size={18} className="text-acc" />
            <h4 className="font-semibold text-sm text-txt">Teste de Microfone & Saída</h4>
          </div>
          <span className="text-[11px] text-mut font-mono">
            {microphoneEnabled ? `${micLevel}% sinal` : "Microfone Silenciado"}
          </span>
        </div>

        {/* Barra de VU Meter Dinâmico com 24 segmentos */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-mut">
            <span>Sensibilidade do Microfone</span>
            <span className={micLevel > 5 ? "text-acc font-semibold" : "text-mut/70"}>
              {micLevel > 5 ? "Captando voz..." : "Aguardando áudio..."}
            </span>
          </div>

          <div className="h-3 w-full rounded-full bg-bd-subtle/70 overflow-hidden flex items-center p-0.5 gap-0.5">
            {Array.from({ length: 24 }).map((_, i) => {
              const segmentThreshold = (i / 24) * 100;
              const isActive = micLevel > segmentThreshold;
              // Gradiente suave de verde/teal para âmbar se estourar
              const isPeak = i >= 20;
              return (
                <div
                  key={i}
                  className={`h-full flex-1 rounded-xs transition-all duration-75 ${
                    isActive
                      ? isPeak
                        ? "bg-err shadow-xs shadow-err/40"
                        : "bg-acc shadow-xs shadow-acc/40"
                      : "bg-transparent opacity-20"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Ações de Teste */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleToggleMicTest}
            className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
              isTestingMic
                ? "bg-err text-bg shadow-md shadow-err/20 hover:bg-err/90"
                : "bg-acc text-bg shadow-md shadow-acc/20 hover:bg-acc-press"
            }`}
          >
            {isTestingMic ? <Stop size={14} weight="bold" /> : <Microphone size={14} weight="bold" />}
            <span>{isTestingMic ? "Parar Teste de Microfone" : "Testar Microfone (Escutar a si mesmo)"}</span>
          </button>

          <button
            type="button"
            onClick={handlePlayTestSound}
            disabled={isPlayingTestSound}
            className="cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border border-bd-subtle bg-card-bg text-txt hover:bg-surf active:scale-95 transition-all disabled:opacity-50"
          >
            {isPlayingTestSound ? <SpeakerHigh size={14} className="text-acc animate-pulse" /> : <Play size={14} />}
            <span>{isPlayingTestSound ? "Reproduzindo Chime..." : "Testar Alto-falante"}</span>
          </button>
        </div>
      </div>

      {/* Modo de Entrada: Atividade de Voz vs Push-to-Talk */}
      <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-3 shadow-xs">
        <h4 className="font-semibold text-sm text-txt">Modo de Entrada</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInputMode("voice_activity")}
            className={`cursor-pointer flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              inputMode === "voice_activity"
                ? "border-acc bg-acc/10 text-txt ring-1 ring-acc/30"
                : "border-bd-subtle bg-card-bg/60 text-mut hover:border-bd hover:text-txt"
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${inputMode === "voice_activity" ? "border-acc bg-acc text-bg" : "border-bd"}`}>
              {inputMode === "voice_activity" && <Check size={10} weight="bold" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-txt">Detecção de Voz</div>
              <div className="text-[11px] text-mut">O microfone é ativado automaticamente ao falar</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setInputMode("push_to_talk")}
            className={`cursor-pointer flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
              inputMode === "push_to_talk"
                ? "border-acc bg-acc/10 text-txt ring-1 ring-acc/30"
                : "border-bd-subtle bg-card-bg/60 text-mut hover:border-bd hover:text-txt"
            }`}
          >
            <div className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${inputMode === "push_to_talk" ? "border-acc bg-acc text-bg" : "border-bd"}`}>
              {inputMode === "push_to_talk" && <Check size={10} weight="bold" />}
            </div>
            <div>
              <div className="text-xs font-semibold text-txt">Pressionar para Falar</div>
              <div className="text-[11px] text-mut">Segure a tecla de atalho para transmitir</div>
            </div>
          </button>
        </div>

        {inputMode === "push_to_talk" && (
          <div className="flex items-center justify-between pt-2 border-t border-bd-subtle">
            <span className="text-xs text-mut font-medium">Tecla de Atalho:</span>
            <button
              type="button"
              onClick={() => setIsRecordingHotkey(true)}
              className="cursor-pointer px-3 py-1.5 rounded-lg border border-bd-subtle bg-card-bg text-xs font-mono font-semibold text-txt hover:border-acc transition-all"
            >
              {isRecordingHotkey ? "Pressione uma tecla..." : pushToTalkKey || "ControlLeft"}
            </button>
          </div>
        )}
      </div>

      {/* Processamento Avançado de Áudio */}
      <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-3 shadow-xs">
        <h4 className="font-semibold text-sm text-txt">Processamento de Áudio</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <div className="text-xs font-medium text-txt">Supressão de Ruído</div>
              <div className="text-[11px] text-mut">Filtra ruídos de fundo como ventiladores e teclados mecânicos</div>
            </div>
            <Switch checked={noiseSuppression} onCheckedChange={setNoiseSuppression} />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-bd-subtle">
            <div>
              <div className="text-xs font-medium text-txt">Cancelamento de Eco</div>
              <div className="text-[11px] text-mut">Evita que o som dos alto-falantes retorne para o microfone</div>
            </div>
            <Switch checked={echoCancellation} onCheckedChange={setEchoCancellation} />
          </div>

          <div className="flex items-center justify-between py-1 border-t border-bd-subtle">
            <div>
              <div className="text-xs font-medium text-txt">Controle Automático de Ganho</div>
              <div className="text-[11px] text-mut">Equaliza o volume da sua voz de forma consistente</div>
            </div>
            <Switch checked={autoGainControl} onCheckedChange={setAutoGainControl} />
          </div>
        </div>
      </div>

      {/* Câmera / Vídeo */}
      <div className="rounded-2xl border border-bd-subtle bg-surf/40 p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-txt font-semibold text-xs uppercase tracking-wider">
            <VideoCamera size={16} className="text-acc" weight="bold" />
            <span>Câmera de Vídeo</span>
          </div>
          <Switch checked={cameraEnabled} onCheckedChange={() => useSettingsStore.getState().setCameraEnabled(!cameraEnabled)} />
        </div>

        <Select
          value={cameraDevice ?? ""}
          disabled={!cameraEnabled}
          onValueChange={(val) => setCameraDevice(val || null)}
        >
          <SelectTrigger className="w-full cursor-pointer rounded-xl border border-bd-subtle bg-card-bg px-3 py-2 text-xs text-txt outline-none hover:border-acc/40 transition-colors disabled:opacity-50">
            <SelectValue placeholder="Câmera padrão do sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Padrão do sistema</SelectItem>
            {devices.camera.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
