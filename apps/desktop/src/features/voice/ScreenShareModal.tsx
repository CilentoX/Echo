"use client";

import { useState, useEffect } from "react";
import {
  X,
  Screencast,
  Monitor,
  AppWindow,
  Broadcast,
  CheckCircle,
  Gear,
  CircleNotch,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@/lib/updater";
import type { ScreenShareConfig } from "@/stores/voiceStore";

export interface ScreenShareModalProps {
  open: boolean;
  onClose: () => void;
  onStartShare: (config: ScreenShareConfig) => void;
}

export interface ShareSource {
  id: string;
  name: string;
  type: "screen" | "window";
  subtitle: string;
  resolution: string;
  thumbnail?: string;
}

const PRESET_SCREENS: ShareSource[] = [
  {
    id: "screen-1",
    name: "Tela 1 (Principal)",
    type: "screen",
    subtitle: "Monitor Desktop Primário",
    resolution: "1920x1080",
  },
  {
    id: "screen-2",
    name: "Tela 2",
    type: "screen",
    subtitle: "Monitor Estendido",
    resolution: "1920x1080",
  },
];

const PRESET_WINDOWS: ShareSource[] = [
  {
    id: "window-echo",
    name: "Echo Desktop",
    type: "window",
    subtitle: "Canal de Voz / Chat",
    resolution: "Janela Ativa",
  },
  {
    id: "window-vscode",
    name: "Visual Studio Code",
    type: "window",
    subtitle: "Editor de Código",
    resolution: "1920x1040",
  },
  {
    id: "window-browser",
    name: "Google Chrome",
    type: "window",
    subtitle: "Navegador Web",
    resolution: "1920x1040",
  },
  {
    id: "window-spotify",
    name: "Spotify",
    type: "window",
    subtitle: "Player de Música",
    resolution: "1280x720",
  },
];

export default function ScreenShareModal({
  open,
  onClose,
  onStartShare,
}: ScreenShareModalProps) {
  const [activeTab, setActiveTab] = useState<"screens" | "windows">("screens");
  const [nativeScreens, setNativeScreens] = useState<ShareSource[]>([]);
  const [nativeWindows, setNativeWindows] = useState<ShareSource[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [selectedSource, setSelectedSource] = useState<ShareSource>(PRESET_SCREENS[0]!);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [fps, setFps] = useState<30 | 60>(60);

  const displayedScreens = nativeScreens.length > 0 ? nativeScreens : PRESET_SCREENS;
  const displayedWindows = nativeWindows.length > 0 ? nativeWindows : PRESET_WINDOWS;
  const currentList = activeTab === "screens" ? displayedScreens : displayedWindows;

  // Busca fontes nativas reais quando o modal abre no Tauri
  useEffect(() => {
    if (!open) return;

    if (isTauri()) {
      setIsLoadingSources(true);
      invoke<ShareSource[]>("get_desktop_sources")
        .then((sources) => {
          if (sources && Array.isArray(sources) && sources.length > 0) {
            const screens = sources.filter((s) => s.type === "screen");
            const windows = sources.filter((s) => s.type === "window");
            if (screens.length > 0) {
              setNativeScreens(screens);
              if (activeTab === "screens") setSelectedSource(screens[0]!);
            }
            if (windows.length > 0) {
              setNativeWindows(windows);
              if (activeTab === "windows") setSelectedSource(windows[0]!);
            }
          }
        })
        .catch((err) => {
          console.warn("[ScreenShare] Não foi possível obter fontes nativas:", err);
        })
        .finally(() => {
          setIsLoadingSources(false);
        });
    }
  }, [open]);

  // Carrega miniatura sob demanda para a fonte selecionada
  useEffect(() => {
    if (!isTauri() || !selectedSource?.id || selectedSource.thumbnail) return;

    let isMounted = true;
    invoke<string>("get_desktop_source_thumbnail", { sourceId: selectedSource.id })
      .then((thumbnailUrl) => {
        if (!isMounted || !thumbnailUrl) return;
        const updateThumbnail = (list: ShareSource[]) =>
          list.map((item) =>
            item.id === selectedSource.id ? { ...item, thumbnail: thumbnailUrl } : item,
          );

        setNativeScreens(updateThumbnail);
        setNativeWindows(updateThumbnail);
        setSelectedSource((curr) =>
          curr.id === selectedSource.id ? { ...curr, thumbnail: thumbnailUrl } : curr,
        );
      })
      .catch(() => {
        // Miniatura opcional silenciosa
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSource?.id]);

  const handleTabChange = (tab: "screens" | "windows") => {
    setActiveTab(tab);
    const targetList = tab === "screens" ? displayedScreens : displayedWindows;
    if (targetList[0]) {
      setSelectedSource(targetList[0]);
    }
  };

  const handleConfirm = () => {
    if (!selectedSource) return;
    onStartShare({
      sourceId: selectedSource.id,
      sourceName: selectedSource.name,
      sourceType: selectedSource.type,
      resolution,
      fps,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-xl p-0 gap-0 border border-white/[0.08] bg-[#12161f] text-txt shadow-2xl rounded-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
      >
        {/* Cabeçalho Superior Fixo */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acc text-bg shadow-md shadow-acc/20 font-bold">
              <Screencast size={20} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">
                Compartilhar Sua Tela
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-0.5">
                Escolha uma tela inteira ou janela de aplicativo para transmitir no canal.
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Seletor de Abas Estilo Discord: Telas vs Janelas */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex rounded-xl bg-white/[0.03] p-1 border border-white/[0.06] gap-1">
            <button
              type="button"
              onClick={() => handleTabChange("screens")}
              className={`cursor-pointer flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 ${
                activeTab === "screens"
                  ? "bg-acc text-bg shadow-md shadow-acc/20"
                  : "text-mut hover:text-txt hover:bg-white/[0.04]"
              }`}
            >
              <Monitor size={15} weight="bold" />
              <span>Telas Inteiras</span>
            </button>
            <button
              type="button"
              onClick={() => handleTabChange("windows")}
              className={`cursor-pointer flex flex-1 items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-95 ${
                activeTab === "windows"
                  ? "bg-acc text-bg shadow-md shadow-acc/20"
                  : "text-mut hover:text-txt hover:bg-white/[0.04]"
              }`}
            >
              <AppWindow size={15} weight="bold" />
              <span>Janelas de Aplicativos</span>
            </button>
          </div>
        </div>

        {/* Grade de Telas ou Janelas Selecionáveis */}
        <div className="p-5 max-h-[300px] overflow-y-auto scrollbar-thin">
          {isLoadingSources && (
            <div className="flex items-center justify-center py-6 gap-2 text-xs text-mut">
              <CircleNotch size={16} className="animate-spin text-acc" />
              <span>Detectando telas e janelas ativas...</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentList.map((source) => {
              const isSelected = selectedSource.id === source.id;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => setSelectedSource(source)}
                  className={`cursor-pointer group relative flex flex-col p-3 rounded-xl border text-left transition-all duration-150 active:scale-[0.98] ${
                    isSelected
                      ? "bg-acc/10 border-acc shadow-lg shadow-acc/10 ring-1 ring-acc"
                      : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.05]"
                  }`}
                >
                  {/* Mockup Preview ou Miniatura Real */}
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/60 border border-white/[0.06] flex flex-col items-center justify-center mb-2.5">
                    {source.thumbnail ? (
                      <img
                        src={source.thumbnail}
                        alt={source.name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                    ) : source.type === "screen" ? (
                      <div className="flex flex-col items-center gap-1 text-mut/60 group-hover:text-acc transition-colors">
                        <Monitor size={32} weight={isSelected ? "fill" : "regular"} className={isSelected ? "text-acc" : ""} />
                        <span className="text-[10px] font-mono opacity-80">{source.resolution}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-mut/60 group-hover:text-acc transition-colors">
                        <AppWindow size={32} weight={isSelected ? "fill" : "regular"} className={isSelected ? "text-acc" : ""} />
                        <span className="text-[10px] font-mono opacity-80">{source.subtitle}</span>
                      </div>
                    )}

                    {/* Badge Selecionado */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex items-center justify-center rounded-full bg-acc text-bg shadow-sm">
                        <CheckCircle size={16} weight="fill" />
                      </div>
                    )}
                  </div>

                  {/* Informações da Fonte */}
                  <div className="flex items-center justify-between min-w-0">
                    <span className="text-xs font-semibold text-txt truncate group-hover:text-acc transition-colors">
                      {source.name}
                    </span>
                    <span className="text-[10px] font-mono text-mut/60 shrink-0 ml-1">
                      {source.resolution}
                    </span>
                  </div>
                  <span className="text-[10px] text-mut/70 truncate mt-0.5">
                    {source.subtitle}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Configurações de Qualidade de Transmissão (Padrão Discord) */}
        <div className="px-5 py-3.5 border-t border-white/[0.06] bg-black/10 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-mut uppercase tracking-wider">
            <Gear size={13} weight="bold" />
            <span>Qualidade da Transmissão</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Seletor de Resolução */}
            <div>
              <span className="text-[11px] text-mut/80 block mb-1.5 font-medium">Resolução</span>
              <div className="flex rounded-xl bg-white/[0.03] p-1 border border-white/[0.06] gap-1">
                <button
                  type="button"
                  onClick={() => setResolution("720p")}
                  className={`cursor-pointer flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                    resolution === "720p"
                      ? "bg-acc text-bg shadow-sm"
                      : "text-mut hover:text-txt"
                  }`}
                >
                  720p
                </button>
                <button
                  type="button"
                  onClick={() => setResolution("1080p")}
                  className={`cursor-pointer flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                    resolution === "1080p"
                      ? "bg-acc text-bg shadow-sm"
                      : "text-mut hover:text-txt"
                  }`}
                >
                  1080p
                </button>
              </div>
            </div>

            {/* Seletor de Taxa de Quadros */}
            <div>
              <span className="text-[11px] text-mut/80 block mb-1.5 font-medium">Taxa de Quadros</span>
              <div className="flex rounded-xl bg-white/[0.03] p-1 border border-white/[0.06] gap-1">
                <button
                  type="button"
                  onClick={() => setFps(30)}
                  className={`cursor-pointer flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                    fps === 30
                      ? "bg-acc text-bg shadow-sm"
                      : "text-mut hover:text-txt"
                  }`}
                >
                  30 FPS
                </button>
                <button
                  type="button"
                  onClick={() => setFps(60)}
                  className={`cursor-pointer flex-1 py-1 px-2 rounded-lg text-xs font-semibold transition-all ${
                    fps === 60
                      ? "bg-acc text-bg shadow-sm"
                      : "text-mut hover:text-txt"
                  }`}
                >
                  60 FPS
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center gap-3 p-4 border-t border-white/[0.08] bg-black/20">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] text-txt hover:bg-white/[0.08] active:scale-95 transition-all py-2.5 text-xs font-semibold text-center"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="cursor-pointer flex-1 rounded-xl bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all py-2.5 text-xs flex items-center justify-center gap-2"
          >
            <Broadcast size={15} weight="bold" />
            <span>Transmitir ao Vivo</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
