import { useState } from "react";
import {
  Bell,
  Eye,
  Keyboard,
  ShieldCheck,
  Clock,
  Lock,
  X,
} from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Sheet de configurações do app.
 * Aparência, notificações, voz/vídeo, privacidade, sessões e conta.
 */
export default function Settings({ open, onClose }: SettingsProps) {
  const {
    compactMode, setCompactMode,
    density, setDensity,
    nativeNotifications, setNativeNotifications,
    messageSound, setMessageSound,
    mentionOnly, setMentionOnly,
    microphoneEnabled, setMicrophoneEnabled,
    cameraEnabled, setCameraEnabled,
    headphonesEnabled, setHeadphonesEnabled,
    onlineStatusVisible, setOnlineStatusVisible,
    readReceipts, setReadReceipts,
    typingVisible, setTypingVisible,
  } = useSettingsStore();

  const [draftDensity, setDraftDensity] = useState(density);

  const handleSaveDensity = () => {
    setDensity(draftDensity);
  };

  const toggleRow = (
    label: string,
    desc: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    Icon: React.ComponentType<React.ComponentProps<typeof Bell>>
  ) => (
    <div className="border-b border-bd last:border-0 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
            <Icon size={16} weight="bold" />
          </div>
          <div>
            <div className="text-sm font-medium text-txt">{label}</div>
            <div className="text-xs text-mut">{desc}</div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex w-10 h-5 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${
            checked ? "bg-acc" : "bg-surf2 border border-bd"
          }`}
        >
          <span
            className={`block w-3 h-3 rounded-full bg-bg shadow transition-transform duration-200 ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
    </div>
  );

  // SVGs inline para ícones não disponíveis no @phosphor-icons/react v2.1.10
  const VolumeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19 5l12 7 12-7" />
    </svg>
  );
  const MicIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="19" />
    </svg>
  );
  const VideoIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
  const HeadphonesIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 9 9v0a9 9 0 0 1 9-9v6" />
      <path d="M20 22v-6a9 9 0 0 0-9-9v0a9 9 0 0 0-9 9v6" />
      <circle cx="12" cy="4" r="2" />
    </svg>
  );

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
          className="flex items-center rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors"
        >
          <span aria-hidden>✕</span>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-8">
        {/* Aparência */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Aparência</h3>
          {toggleRow(
            "Modo compacto",
            "Mensagens e lista de canais mais enxutas",
            compactMode,
            setCompactMode,
            Keyboard
          )}
          <div className="border-t border-bd pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                  <Keyboard size={16} weight="bold" />
                </div>
                <div>
                  <div className="text-sm font-medium text-txt">Densidade</div>
                  <div className="text-xs text-mut">Confortável ou compacto</div>
                </div>
              </div>
              <select
                value={draftDensity}
                onChange={(e) => setDraftDensity(e.target.value as any)}
                className="bg-bg border border-bd rounded-lg px-3 py-1.5 text-sm text-txt outline-none focus:border-acc"
              >
                <option value="confortavel">Confortável</option>
                <option value="compacto">Compacto</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleSaveDensity}
              className="mt-3 text-xs text-acc hover:text-acc-press underline underline-offset-4"
            >
              Aplicar
            </button>
          </div>
        </section>

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
            VolumeIcon
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
          {toggleRow(
            "Microfone",
            "Permitir uso do microfone em chamadas",
            microphoneEnabled,
            setMicrophoneEnabled,
            MicIcon
          )}
          {toggleRow(
            "Câmera",
            "Permitir uso da câmera em chamadas",
            cameraEnabled,
            setCameraEnabled,
            VideoIcon
          )}
          {toggleRow(
            "Fones de ouvido",
            "Usar fones de ouvido por padrão",
            headphonesEnabled,
            setHeadphonesEnabled,
            HeadphonesIcon
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
            ShieldCheck
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
                className="text-xs text-acc hover:text-acc-press underline underline-offset-4"
              >
                Ver detalhes
              </button>
            </div>
          </div>
          <div className="space-y-3">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors"
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
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors"
            >
              <span>Gerenciar conta Google (SSO)</span>
              <span className="text-mut text-xs">Login e senha são gerenciados pelo Google</span>
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors"
            >
              <span>Exportar meus dados</span>
              <span className="text-mut text-xs">Baixar histórico e configurações</span>
            </button>
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left text-sm text-err bg-bg border border-bd rounded-lg hover:bg-err/10 transition-colors"
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