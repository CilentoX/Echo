import { useEffect, useState } from "react";
import { useUpdateStore } from "@/stores/updateStore";
import {
  closeAppWindow,
  minimizeAppWindow,
  startDraggingAppWindow,
} from "@/lib/updater";

const SLOGANS: string[] = [
  "Preparando seu espaço de conversa...",
  "Conectando você à sua comunidade...",
  "Criptografia e privacidade em primeiro lugar...",
  "Sincronizando seus canais e mensagens...",
  "Sua rede privada, segura e descentralizada...",
  "Construindo conexões seguras...",
  "Seu espaço. Suas conversas. Seu controle.",
  "Quase pronto para começar...",
];

export interface UpdaterSplashProps {
  customStatus?: string;
}

export default function UpdaterSplash({ customStatus }: UpdaterSplashProps) {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);
  const progress = useUpdateStore((s) => s.progress);
  const storeStatusText = useUpdateStore((s) => s.statusText);

  // Rotação dos slogans acolhedores da comunidade Echo
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
    <div className="fixed inset-0 flex items-center justify-center bg-bg select-none z-50 overflow-hidden font-ui">
      {/* Janela compacta do updater (312px x 380px) perfeitamente alinhada à identidade visual do Echo */}
      <div
        className="w-[312px] h-[380px] bg-bg flex flex-col justify-between items-center relative overflow-hidden rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-bd/70"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0) void startDraggingAppWindow();
        }}
      >
        {/* Barra superior nativa minimalista com drag e controles de janela */}
        <div
          className="w-full h-10 px-3.5 pt-3 flex items-center justify-between cursor-grab active:cursor-grabbing z-10"
          data-tauri-drag-region
        >
          {/* Controles de janela estilo macOS / Echo */}
          <div className="flex items-center gap-2">
            {/* Botão Fechar */}
            <button
              type="button"
              title="Fechar"
              onClick={(e) => {
                e.stopPropagation();
                void closeAppWindow();
              }}
              className="w-3 h-3 rounded-full bg-err/80 hover:bg-err transition-all hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
            >
              <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
                ✕
              </span>
            </button>

            {/* Botão Minimizar */}
            <button
              type="button"
              title="Minimizar"
              onClick={(e) => {
                e.stopPropagation();
                void minimizeAppWindow();
              }}
              className="w-3 h-3 rounded-full bg-idle/80 hover:bg-idle transition-all hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
            >
              <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
                –
              </span>
            </button>

            {/* Pílula decorativa de status verde Echo */}
            <div
              title="Echo"
              className="w-3 h-3 rounded-full bg-acc/80 cursor-default shadow-[0_0_6px_rgba(15,185,168,0.4)]"
            />
          </div>

          <span className="text-[11px] font-semibold text-mut/80 tracking-wide font-display pr-2">
            Echo
          </span>
        </div>

        {/* Bloco Central: Logo Echo com apresentação elegante e limpa */}
        <div className="relative flex flex-col items-center justify-center my-auto">
          {/* Suave brilho orgânico verde-água da identidade Echo */}
          <div className="absolute w-32 h-32 rounded-full bg-acc/10 blur-2xl pointer-events-none" />

          {/* Cartão de destaque do Logo */}
          <div className="relative w-24 h-24 rounded-2xl bg-surf/80 border border-bd/80 shadow-lg flex items-center justify-center p-4 transition-transform hover:scale-[1.02]">
            <img
              src="/echo-logo.png"
              width={56}
              height={56}
              alt="Echo"
              className="select-none pointer-events-none object-contain drop-shadow-[0_2px_10px_rgba(15,185,168,0.25)]"
            />
          </div>

          {/* Tipografia da Marca Echo */}
          <h1 className="font-display text-xl font-bold tracking-tight text-txt mt-3.5">
            Echo
          </h1>
          <p className="text-[11px] text-mut font-medium mt-0.5">
            Rede Segura & Descentralizada
          </p>
        </div>

        {/* Rodapé: Slogan da Comunidade + Barra de Progresso + Status */}
        <div className="w-full pb-6 px-4 flex flex-col items-center justify-center text-center z-10">
          {/* Slogan acolhedor com transição suave */}
          <p
            className={`font-ui text-txt/90 text-xs font-normal tracking-normal select-none transition-opacity duration-300 h-5 flex items-center justify-center ${
              sloganVisible ? "opacity-100" : "opacity-0"
            }`}
          >
            {SLOGANS[sloganIndex]}
          </p>

          {/* Barra de progresso para downloads de atualização */}
          {status === "downloading" && progress !== null && progress >= 0 && (
            <div className="w-48 h-1.5 bg-surf2 rounded-full overflow-hidden border border-bd/40 mt-2.5">
              <div
                className="h-full bg-acc transition-all duration-300 rounded-full"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
          )}

          {/* Status em português com dot pulsante elegante */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {isCheckingOrBusy && (
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-acc opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-acc shadow-[0_0_6px_rgba(15,185,168,0.7)]"></span>
              </span>
            )}
            <p
              role="status"
              aria-live="polite"
              className="text-[11px] font-semibold tracking-wider text-acc uppercase select-none transition-colors duration-200"
            >
              {statusLabel}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
