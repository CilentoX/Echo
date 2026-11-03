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
  } else if (status === "checking" || status === "idle") {
    statusLabel = "VERIFICANDO ATUALIZAÇÕES...";
  }

  const isCheckingOrBusy =
    statusLabel.includes("VERIFICANDO") ||
    statusLabel.includes("BAIXANDO") ||
    statusLabel.includes("INICIANDO");

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0D1017] select-none z-50 overflow-hidden font-ui">
      {/* Janela compacta do updater (312px x 380px) com identidade visual Echo */}
      <div
        className="w-[312px] h-[380px] bg-[#0D1017] flex flex-col justify-between items-center relative overflow-hidden rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(15,185,168,0.22)] border border-[#232D3D]"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0) void startDraggingAppWindow();
        }}
      >
        {/* Brilho atmosférico superior e inferior */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-52 h-44 bg-[#0FB9A8]/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-52 h-36 bg-[#0FB9A8]/15 rounded-full blur-2xl pointer-events-none" />

        {/* Linha tecnológica sutil de varredura na borda inferior */}
        <div className="absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#14DAA6] to-transparent opacity-80 animate-pulse pointer-events-none" />

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

          {/* Indicador Echo verde-água vibrante */}
          <div
            title="Echo"
            className="w-3 h-3 rounded-full bg-[#0FB9A8] cursor-default shadow-[0_0_8px_rgba(15,185,168,0.7)]"
          />
        </div>

        {/* Área central com vórtice animado verde-água Echo */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Concentração de luz atrás do pedestal central */}
          <div className="absolute w-44 h-44 rounded-full bg-radial from-[#14DAA6]/25 via-[#0FB9A8]/10 to-transparent blur-xl pointer-events-none" />

          {/* Anel externo com rotação reversa suave */}
          <svg
            className="absolute w-[156px] h-[156px] animate-[spin_6s_linear_infinite_reverse] pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            <defs>
              <linearGradient id="echoOuterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0FB9A8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0.25" />
              </linearGradient>
            </defs>
            <path
              d="M 25 15 A 42 42 0 0 1 75 15"
              stroke="url(#echoOuterGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <path
              d="M 75 85 A 42 42 0 0 1 25 85"
              stroke="url(#echoOuterGrad)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Vórtice dinâmico Echo de alta definição */}
          <svg
            className="absolute w-[138px] h-[138px] animate-[spin_1.8s_linear_infinite] pointer-events-none drop-shadow-[0_0_14px_rgba(20,218,166,0.65)]"
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
              opacity="1"
            />
            <path
              d="M 82 74 A 40 40 0 0 1 40 90"
              stroke="url(#echoVortexGrad)"
              strokeWidth="5.5"
              strokeLinecap="round"
              opacity="0.95"
            />
            <path
              d="M 18 68 A 40 40 0 0 1 14 36"
              stroke="url(#echoVortexGrad)"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.95"
            />
          </svg>

          {/* Pedestal central com o logo transparente oficial Echo */}
          <div className="relative w-22 h-22 rounded-full flex items-center justify-center bg-[#131722] border border-[#0FB9A8]/40 shadow-[0_0_24px_rgba(15,185,168,0.35),inset_0_2px_8px_rgba(0,0,0,0.8)] backdrop-blur-md z-10">
            <img
              src="/echo-logo.png"
              width={54}
              height={54}
              alt="Echo"
              className="drop-shadow-[0_0_16px_rgba(20,218,166,0.85)] select-none pointer-events-none object-contain"
            />
          </div>
        </div>

        {/* Rodapé: Slogan + Status */}
        <div className="w-full pb-7 px-4 flex flex-col items-center justify-center text-center z-10">
          {/* Slogan em português com a fonte Space Grotesk do Echo */}
          <p
            className={`font-display text-[#F1F5F9] font-bold italic text-base tracking-wide select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-opacity duration-300 h-6 flex items-center justify-center ${
              sloganVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            {SLOGANS[sloganIndex]}
          </p>

          {/* Indicador de status em destaque verde-água em pt-BR com dot pulsante */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {isCheckingOrBusy && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14DAA6] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0FB9A8] shadow-[0_0_8px_#0FB9A8]"></span>
              </span>
            )}
            <p
              role="status"
              aria-live="polite"
              className="text-[11px] font-bold tracking-wider text-[#14DAA6] uppercase select-none drop-shadow-[0_0_8px_rgba(20,218,166,0.5)] transition-colors duration-200"
            >
              {statusLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
