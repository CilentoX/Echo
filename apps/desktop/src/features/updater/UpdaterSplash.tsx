import { useEffect, useState } from "react";
import { useUpdateStore } from "@/stores/updateStore";
import {
  closeAppWindow,
  minimizeAppWindow,
  startDraggingAppWindow,
} from "@/lib/updater";

const SLOGANS: string[] = [
  "CALIBRANDO AS CÂMARAS DE ECHO...",
  "SINTONIZANDO FREQUÊNCIAS...",
  "ROTEANDO PACOTES QUÂNTICOS...",
  "CONECTANDO À MATRIX...",
  "INICIALIZANDO O SYNAPSE...",
  "DOBRANDO O ESPAÇO-TEMPO...",
  "SEGUREM SEUS TRANSMISSORES...",
  "CARREGANDO CAPACITORES...",
  "SINCRONIZANDO CANAIS DE ÁUDIO...",
  "ESTABELECENDO CONEXÃO SEGURA...",
];

export interface UpdaterSplashProps {
  customStatus?: string;
}

export default function UpdaterSplash({ customStatus }: UpdaterSplashProps) {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);
  const progress = useUpdateStore((s) => s.progress);
  const storeStatusText = useUpdateStore((s) => s.statusText);

  // Rotação dos slogans a cada 3.5 segundos
  const [sloganIndex, setSloganIndex] = useState(() =>
    Math.floor(Math.random() * SLOGANS.length),
  );
  const [sloganVisible, setSloganVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setSloganVisible(false);
      setTimeout(() => {
        setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
        setSloganVisible(true);
      }, 250);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // Determina o texto de status do updater em português (pt-BR)
  let statusLabel = "VERIFICANDO ATUALIZAÇÕES...";
  if (customStatus) {
    statusLabel = customStatus;
  } else if (storeStatusText) {
    statusLabel = storeStatusText;
  } else if (status === "downloading") {
    if (progress !== null && progress >= 0) {
      statusLabel = `BAIXANDO ATUALIZAÇÃO (${progress}%)...`;
    } else if (version) {
      statusLabel = `BAIXANDO ATUALIZAÇÃO (${version})...`;
    } else {
      statusLabel = "BAIXANDO ATUALIZAÇÃO...";
    }
  } else if (status === "ready") {
    statusLabel = "REINICIANDO O ECHO...";
  } else if (status === "idle") {
    statusLabel = "INICIANDO O ECHO...";
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0D1017] select-none z-50 overflow-hidden font-ui">
      {/* Janela compacta do updater (312px x 380px) com identidade visual Echo */}
      <div
        className="w-[312px] h-[380px] bg-[#0D1017] flex flex-col justify-between items-center relative overflow-hidden rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85),0_0_24px_rgba(15,185,168,0.14)] border border-[#2A3546]"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0) void startDraggingAppWindow();
        }}
      >
        {/* Brilho suave de fundo */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#0FB9A8]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Barra superior com controles de janela */}
        <div
          className="w-full h-8 px-3.5 pt-3 flex items-center gap-2 cursor-grab active:cursor-grabbing z-10"
          data-tauri-drag-region
        >
          {/* Botão Vermelho: Fechar */}
          <button
            type="button"
            title="Fechar"
            onClick={(e) => {
              e.stopPropagation();
              void closeAppWindow();
            }}
            className="w-3 h-3 rounded-full bg-[#EF4444] hover:brightness-125 active:brightness-90 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
              ✕
            </span>
          </button>

          {/* Botão Amarelo: Minimizar */}
          <button
            type="button"
            title="Minimizar"
            onClick={(e) => {
              e.stopPropagation();
              void minimizeAppWindow();
            }}
            className="w-3 h-3 rounded-full bg-[#F59E0B] hover:brightness-125 active:brightness-90 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
              –
            </span>
          </button>

          {/* Indicador Echo verde-água */}
          <div
            title="Echo"
            className="w-3 h-3 rounded-full bg-[#0FB9A8] opacity-80 cursor-default shadow-[0_0_6px_rgba(15,185,168,0.5)]"
          />
        </div>

        {/* Área central com vórtice animado verde-água Echo */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Anel externo com rotação reversa suave */}
          <svg
            className="absolute w-[156px] h-[156px] animate-[spin_6s_linear_infinite_reverse] pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            <defs>
              <linearGradient id="echoOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0FB9A8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.1" />
              </linearGradient>
            </defs>
            <path
              d="M 25 15 A 42 42 0 0 1 75 15"
              stroke="url(#echoOuterGrad)"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M 75 85 A 42 42 0 0 1 25 85"
              stroke="url(#echoOuterGrad)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Vórtice dinâmico Echo */}
          <svg
            className="absolute w-[138px] h-[138px] animate-[spin_1.8s_linear_infinite] pointer-events-none drop-shadow-[0_0_10px_rgba(15,185,168,0.45)]"
            viewBox="0 0 100 100"
            fill="none"
          >
            <defs>
              <linearGradient id="echoVortexGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0FB9A8" />
                <stop offset="50%" stopColor="#14DAA6" />
                <stop offset="100%" stopColor="#2DD4BF" />
              </linearGradient>
            </defs>
            <path
              d="M 50 10 A 40 40 0 0 1 88 32"
              stroke="url(#echoVortexGrad)"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d="M 82 74 A 40 40 0 0 1 40 90"
              stroke="url(#echoVortexGrad)"
              strokeWidth="5.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            <path
              d="M 18 68 A 40 40 0 0 1 14 36"
              stroke="url(#echoVortexGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>

          {/* Pedestal central com o logo transparente oficial Echo */}
          <div className="relative w-22 h-22 rounded-full flex items-center justify-center bg-[#171B24]/90 border border-[#2A3546] shadow-[inset_0_2px_8px_rgba(0,0,0,0.6),0_0_20px_rgba(15,185,168,0.2)] backdrop-blur-md z-10">
            <img
              src="/echo-logo.png"
              width={54}
              height={54}
              alt="Echo"
              className="drop-shadow-[0_0_12px_rgba(15,185,168,0.6)] select-none pointer-events-none object-contain animate-[pulse_3s_ease-in-out_infinite]"
            />
          </div>
        </div>

        {/* Rodapé: Slogan + Status */}
        <div className="w-full pb-7 px-4 flex flex-col items-center justify-center text-center z-10">
          {/* Slogan em português com a fonte Space Grotesk do Echo */}
          <p
            className={`font-display text-[#E9EDF2] font-bold italic text-base tracking-wide select-none transition-opacity duration-300 h-6 flex items-center justify-center ${
              sloganVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            {SLOGANS[sloganIndex]}
          </p>

          {/* Indicador de status em destaque verde-água em pt-BR */}
          <p
            role="status"
            aria-live="polite"
            className="text-[11px] font-semibold tracking-wider text-[#0FB9A8] uppercase select-none mt-2 transition-colors duration-200"
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
