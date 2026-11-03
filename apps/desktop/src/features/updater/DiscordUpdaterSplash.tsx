import { useEffect, useState } from "react";
import { useUpdateStore } from "@/stores/updateStore";
import {
  closeAppWindow,
  minimizeAppWindow,
  startDraggingAppWindow,
} from "@/lib/updater";

const SLOGANS: string[] = [
  "TOP DECKING LETHAL.",
  "CONNECTING TO THE MATRIX...",
  "TUNING FREQUENCIES...",
  "ROUTING QUANTUM PACKETS...",
  "WARPING REALITY...",
  "CHARGING CAPACITORS...",
  "CALIBRATING ECHO CHAMBERS...",
  "HOLD ON TO YOUR TRANSMITTERS...",
  "SYNCHRONIZING AUDIO CHANNELS...",
  "SPINNING UP SYNAPSE...",
];

export interface DiscordUpdaterSplashProps {
  customStatus?: string;
}

export default function DiscordUpdaterSplash({ customStatus }: DiscordUpdaterSplashProps) {
  const status = useUpdateStore((s) => s.status);
  const version = useUpdateStore((s) => s.version);
  const progress = useUpdateStore((s) => s.progress);
  const storeStatusText = useUpdateStore((s) => s.statusText);

  // Slogan rotation every 3.5 seconds
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

  // Compute status tracker text (estilo Discord: CHECKING FOR UPDATES, DOWNLOADING UPDATE (X%), etc.)
  let statusLabel = "CHECKING FOR UPDATES";
  if (customStatus) {
    statusLabel = customStatus;
  } else if (storeStatusText) {
    statusLabel = storeStatusText;
  } else if (status === "downloading") {
    if (progress !== null && progress >= 0) {
      statusLabel = `DOWNLOADING UPDATE (${progress}%)`;
    } else if (version) {
      statusLabel = `DOWNLOADING UPDATE (${version})`;
    } else {
      statusLabel = "DOWNLOADING UPDATE 1 OF 1";
    }
  } else if (status === "ready") {
    statusLabel = "RESTARTING ECHO...";
  } else if (status === "idle") {
    statusLabel = "STARTING ECHO...";
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#1e1f22] select-none z-50 overflow-hidden font-ui">
      {/* Splash Card (312px x 380px) */}
      <div
        className="w-[312px] h-[380px] bg-[#1e1f22] flex flex-col justify-between items-center relative overflow-hidden rounded-2xl shadow-2xl border border-[#2b2d31]/60"
        data-tauri-drag-region
        onMouseDown={(e) => {
          if (e.button === 0) void startDraggingAppWindow();
        }}
      >
        {/* Top Bar with Traffic Light Dots */}
        <div
          className="w-full h-8 px-3.5 pt-3 flex items-center gap-2 cursor-grab active:cursor-grabbing z-10"
          data-tauri-drag-region
        >
          {/* Red: Close */}
          <button
            type="button"
            title="Fechar"
            onClick={(e) => {
              e.stopPropagation();
              void closeAppWindow();
            }}
            className="w-3 h-3 rounded-full bg-[#ed4245] hover:brightness-125 active:brightness-90 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
              ✕
            </span>
          </button>

          {/* Yellow: Minimize */}
          <button
            type="button"
            title="Minimizar"
            onClick={(e) => {
              e.stopPropagation();
              void minimizeAppWindow();
            }}
            className="w-3 h-3 rounded-full bg-[#fee75c] hover:brightness-125 active:brightness-90 transition-transform hover:scale-110 flex items-center justify-center cursor-pointer shadow-sm group"
          >
            <span className="opacity-0 group-hover:opacity-100 text-[8px] font-bold text-black/70 leading-none">
              –
            </span>
          </button>

          {/* Green: Disabled/Cosmetic on Splash */}
          <div
            title="Echo"
            className="w-3 h-3 rounded-full bg-[#57f287] opacity-60 cursor-default shadow-sm"
          />
        </div>

        {/* Central Logo with Animated Swirling Vortex */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Outer subtle counter-rotating ring */}
          <svg
            className="absolute w-[148px] h-[148px] animate-[spin_5s_linear_infinite_reverse] pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            <path
              d="M 25 15 A 42 42 0 0 1 75 15"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.25"
            />
            <path
              d="M 75 85 A 42 42 0 0 1 25 85"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.25"
            />
          </svg>

          {/* Primary Discord-style brush swirl arcs */}
          <svg
            className="absolute w-[130px] h-[130px] animate-[spin_1.6s_linear_infinite] pointer-events-none"
            viewBox="0 0 100 100"
            fill="none"
          >
            {/* Brush Arc 1 */}
            <path
              d="M 50 10 A 40 40 0 0 1 88 32"
              stroke="white"
              strokeWidth="6"
              strokeLinecap="round"
              opacity="0.95"
            />
            {/* Brush Arc 2 */}
            <path
              d="M 82 74 A 40 40 0 0 1 40 90"
              stroke="white"
              strokeWidth="5.5"
              strokeLinecap="round"
              opacity="0.85"
            />
            {/* Brush Arc 3 */}
            <path
              d="M 18 68 A 40 40 0 0 1 14 36"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.9"
            />
          </svg>

          {/* Mascot / Logo Center Container */}
          <div className="relative w-20 h-20 rounded-full flex items-center justify-center bg-[#2b2d31]/80 backdrop-blur-sm shadow-inner z-10 transition-transform duration-300">
            <img
              src="/logo.png"
              width={56}
              height={56}
              alt="Echo"
              className="drop-shadow-md select-none pointer-events-none object-contain animate-[pulse_3s_ease-in-out_infinite]"
            />
          </div>
        </div>

        {/* Bottom Area: Rotating Slogan + Status Indicator */}
        <div className="w-full pb-7 px-4 flex flex-col items-center justify-center text-center z-10">
          {/* Witty Slogan */}
          <p
            className={`text-[#f2f3f5] font-bold italic text-base tracking-wide select-none transition-opacity duration-300 h-6 flex items-center justify-center ${
              sloganVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            {SLOGANS[sloganIndex]}
          </p>

          {/* Status Label (CHECKING FOR UPDATES, etc.) */}
          <p
            role="status"
            aria-live="polite"
            className="text-[11px] font-semibold tracking-wider text-[#949ba4] uppercase select-none mt-2 transition-colors duration-200"
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}

