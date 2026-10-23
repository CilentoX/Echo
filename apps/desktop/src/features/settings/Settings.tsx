import { useEffect, useState } from "react";
import {
  Bell,
  Clock,
  Eye,
  Lock,
  ShieldCheck,
  SpeakerHigh,
  Microphone,
  VideoCamera,
  Headphones,
  X,
} from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";
import { performLogout } from "@/features/auth/logout";
import { FALLBACK_DEVICES, listRealDevices, type DeviceLists } from "@/lib/media/devices";

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Sheet de configurações do app.
 * Notificações, voz/vídeo, privacidade, sessões e conta.
 */
export default function Settings({ open, onClose }: SettingsProps) {
  const {
    nativeNotifications, setNativeNotifications,
    messageSound, setMessageSound,
    mentionOnly, setMentionOnly,
    microphoneEnabled, setMicrophoneEnabled, microphoneDevice, setMicrophoneDevice,
    cameraEnabled, setCameraEnabled, cameraDevice, setCameraDevice,
    headphonesEnabled, setHeadphonesEnabled, headphonesDevice, setHeadphonesDevice,
    onlineStatusVisible, setOnlineStatusVisible,
    readReceipts, setReadReceipts,
    typingVisible, setTypingVisible,
  } = useSettingsStore();

  // Dispositivos reais da máquina (enumerateDevices); fallback quando o
  // navegador não expõe ou nada é enumerado.
  const [devices, setDevices] = useState<DeviceLists>(FALLBACK_DEVICES);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    listRealDevices()
      .then((d) => {
        if (alive) setDevices(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open]);

  // Fecha a sheet ao pressionar Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /** Switch alinhado: track 40×20, knob 16px centrado (items-center). */
  const Toggle = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer items-center rounded-full px-0.5 transition-colors duration-300 ${
        checked ? "bg-acc" : "border border-bd bg-surf2"
      }`}
    >
      <span
        className={`block h-4 w-4 rounded-full bg-bg shadow-md transition-transform duration-300 ease-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  const toggleRow = (
    label: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    Icon: React.ComponentType<{ size?: number; weight?: "bold" }>
  ) => (
    <div className="border-b border-bd last:border-0 py-4 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut group-hover:bg-surf group-hover:text-txt transition-colors">
            <Icon size={16} weight="bold" />
          </div>
          <div>
            <div className="text-sm font-medium text-txt">{label}</div>
            <div className="text-xs text-mut">{desc}</div>
          </div>
        </div>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
    </div>
  );

  // Ícones de dispositivo usam ícones Phosphor (Microphone, VideoCamera, Headphones).

  /** Select de dispositivo de áudio/vídeo com os dispositivos reais da máquina. */
  const deviceSelect = (
    label: string,
    enabled: boolean,
    setEnabled: (v: boolean) => void,
    deviceId: string | null,
    setDevice: (id: string | null) => void,
    kind: "microphone" | "camera" | "headphones"
  ) => {
    const options = devices[kind];
    const iconMap: Record<string, React.ComponentType<{ size?: number }>> = {
      microphone: Microphone,
      camera: VideoCamera,
      headphones: Headphones,
    };
    const DeviceIcon = iconMap[kind];
    return (
      <div className="border-b border-bd last:border-0 py-4 group">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut group-hover:bg-surf group-hover:text-txt transition-colors">
              <DeviceIcon size={16} />
            </div>
            <div>
              <div className="text-sm font-medium text-txt">{label}</div>
              <div className="text-xs text-mut">
                {enabled ? "Dispositivo ativo" : "Desativado"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select
              aria-label={`Dispositivo de ${label.toLowerCase()}`}
              value={deviceId ?? ""}
              disabled={!enabled}
              onChange={(e) => setDevice(e.target.value || null)}
              className={`max-w-[180px] rounded-lg border px-3 py-1.5 text-sm text-txt outline-none transition-all duration-200 focus:border-acc disabled:cursor-not-allowed disabled:opacity-50 ${
                enabled ? "border-bd bg-bg" : "border-mut/50 bg-surf2"
              }`}
            >
              <option value="">Padrão do sistema</option>
              {options.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Toggle
              checked={enabled}
              label={label}
              onChange={(next) => {
                setEnabled(next);
                if (!next) setDevice(null);
              }}
            />
          </div>
        </div>
      </div>
    );
  };

  if (!open) return null;

  return (
    <aside
      data-column="settings"
      aria-label="Configurações"
      className="fixed inset-y-0 right-0 z-50 w-[560px] bg-surf border-l border-bd flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-bd px-5 py-4 bg-surf/50 backdrop-blur">
        <h2 className="font-display text-lg font-semibold text-txt">Configurações</h2>
        <button
          type="button"
          aria-label="Fechar configurações"
          onClick={onClose}
          className="flex items-center rounded p-1.5 cursor-pointer text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
        {/* Notificações */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Notificações</h3>
          {toggleRow(
            "Notificações nativas do SO",
            "Banners e click-to-focus na área de trabalho",
            nativeNotifications,
            setNativeNotifications,
            Bell
          )}
          {toggleRow(
            "Som de mensagem",
            "Tocar áudio ao receber mensagem",
            messageSound,
            setMessageSound,
            SpeakerHigh
          )}
          {toggleRow(
            "Apenas menções",
            "Notificar somente quando alguém te marcar",
            mentionOnly,
            setMentionOnly,
            Clock
          )}
        </section>

        {/* Voz e vídeo */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Voz e vídeo</h3>
          {deviceSelect(
            "Microfone",
            microphoneEnabled,
            setMicrophoneEnabled,
            microphoneDevice,
            setMicrophoneDevice,
            "microphone"
          )}
          {deviceSelect(
            "Câmera",
            cameraEnabled,
            setCameraEnabled,
            cameraDevice,
            setCameraDevice,
            "camera"
          )}
          {deviceSelect(
            "Fones de ouvido",
            headphonesEnabled,
            setHeadphonesEnabled,
            headphonesDevice,
            setHeadphonesDevice,
            "headphones"
          )}
        </section>

        {/* Privacidade */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Privacidade</h3>
          {toggleRow(
            "Status online visível",
            "Outros membros veem se você está online",
            onlineStatusVisible,
            setOnlineStatusVisible,
            Eye
          )}
          {toggleRow(
            "Confirmar leitura",
            "Enviar recibos de leitura nas mensagens",
            readReceipts,
            setReadReceipts,
            ShieldCheck
          )}
          {toggleRow(
            "Digitação visível",
            "Mostrar 'está digitando…' para os outros",
            typingVisible,
            setTypingVisible,
            Microphone
          )}
        </section>

        {/* Sessões */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Sessões</h3>
          <div className="border-b border-bd pb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                  <Lock size={16} weight="bold" />
                </div>
                <div>
                  <div className="font-medium text-txt">Sessão atual</div>
                  <div className="text-xs text-mut">Desktop · Windows</div>
                </div>
              </div>
              <button
                type="button"
                className="cursor-pointer text-xs text-acc hover:text-acc-press underline underline-offset-4 transition-colors active:scale-95"
              >
                Ver detalhes
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors active:scale-95"
            >
              <span>Desconectar de outros dispositivos</span>
              <span className="text-mut text-xs">Encerrar todas as sessões exceto esta</span>
            </button>
          </div>
        </section>

        {/* Conta */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Conta</h3>
          <div className="space-y-3">
            <button
              type="button"
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors active:scale-95"
            >
              <span>Gerenciar conta Google (SSO)</span>
              <span className="text-mut text-xs">Login e senha são gerenciados pelo Google</span>
            </button>
            <button
              type="button"
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors active:scale-95"
            >
              <span>Exportar meus dados</span>
              <span className="text-mut text-xs">Baixar histórico e configurações</span>
            </button>
            <button
              type="button"
              onClick={performLogout}
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left text-sm text-err bg-bg border border-bd rounded-lg hover:bg-err/10 transition-colors active:scale-95"
            >
              <X size={14} weight="bold" className="mr-2" />
              <span>Sair da conta</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}
