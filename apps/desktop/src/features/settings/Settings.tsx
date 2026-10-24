import { useEffect, useState } from "react";
import { Bell, Clock, Eye, Lock, ShieldCheck, SpeakerHigh, Microphone, VideoCamera, Headphones, X, type Icon } from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";
import { performLogout } from "@/features/auth/logout";
import { FALLBACK_DEVICES, listRealDevices, type DeviceLists } from "@/lib/media/devices";

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

export default function Settings({ open, onClose }: SettingsProps) {
  const {
    nativeNotifications, setNativeNotifications,
    messageSound, setMessageSound,
    mentionOnly, setMentionOnly,
    microphoneEnabled, microphoneDevice, setMicrophoneDevice,
    cameraEnabled, cameraDevice, setCameraDevice,
    headphonesEnabled, headphonesDevice, setHeadphonesDevice,
    onlineStatusVisible, setOnlineStatusVisible,
    readReceipts, setReadReceipts,
    typingVisible, setTypingVisible,
  } = useSettingsStore();

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const DEVICE_KINDS: Array<{ kind: "microphone" | "camera" | "headphones"; label: string; icon: Icon }> = [
    { kind: "microphone", label: "Microfone", icon: Microphone },
    { kind: "camera", label: "Câmera", icon: VideoCamera },
    { kind: "headphones", label: "Fones de ouvido", icon: Headphones },
  ];

  if (!open) return null;

  return (
    <aside
      data-column="settings"
      aria-label="Configurações"
      className="fixed inset-y-0 right-0 z-50 w-[560px] bg-surf border-l border-bd flex flex-col"
    >
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
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <Bell size={16} weight="bold" />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Notificações nativas do SO</div>
                <div className="text-xs text-mut">Banners e click-to-focus na área de trabalho</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={nativeNotifications}
                  onChange={(e) => setNativeNotifications(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <SpeakerHigh size={16} />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Som de mensagem</div>
                <div className="text-xs text-mut">Tocar áudio ao receber mensagem</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={messageSound}
                  onChange={(e) => setMessageSound(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <Clock size={16} weight="bold" />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Apenas menções</div>
                <div className="text-xs text-mut">Notificar somente quando alguém te marcar</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={mentionOnly}
                  onChange={(e) => setMentionOnly(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Voz e vídeo */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Voz e vídeo</h3>
          <div className="space-y-4">
            {DEVICE_KINDS.map(({ kind, label, icon: Icon }) => {
              const enabled = kind === "microphone" ? microphoneEnabled : kind === "camera" ? cameraEnabled : headphonesEnabled;
              const deviceId = kind === "microphone" ? microphoneDevice : kind === "camera" ? cameraDevice : headphonesDevice;
              const setDevice = kind === "microphone" ? setMicrophoneDevice : kind === "camera" ? setCameraDevice : setHeadphonesDevice;

              return (
                <div key={kind} className="border-b border-bd last:border-0 py-4 group">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-txt">{label}</div>
                      <div className="text-xs text-mut">{enabled ? "Dispositivo ativo" : "Desativado"}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Dispositivo de ${label.toLowerCase()}`}
                        value={deviceId ?? ""}
                        disabled={!enabled}
                        onChange={(e) => setDevice(e.target.value || null)}
                        className="w-[200px] cursor-pointer rounded-lg border border-bd bg-bg px-3 py-1.5 text-sm text-txt outline-none transition-colors focus:border-acc disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Padrão do sistema</option>
                        {deviceId &&
                          !devices[kind].some((d) => d.id === deviceId) && (
                            <option value={deviceId}>Dispositivo atual</option>
                          )}
                        {devices[kind].map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Privacidade */}
        <section>
          <h3 className="font-display text-base font-semibold text-txt mb-4">Privacidade</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <Eye size={16} weight="bold" />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Status online visível</div>
                <div className="text-xs text-mut">Outros membros veem se você está online</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={onlineStatusVisible}
                  onChange={(e) => setOnlineStatusVisible(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <ShieldCheck size={16} weight="bold" />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Confirmar leitura</div>
                <div className="text-xs text-mut">Enviar recibos de leitura nas mensagens</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={readReceipts}
                  onChange={(e) => setReadReceipts(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                <Microphone size={16} />
              </div>
              <div>
                <div className="text-sm font-medium text-txt">Digitação visível</div>
                <div className="text-xs text-mut">Mostrar 'está digitando…' para os outros</div>
              </div>
              <div className="flex-shrink-0">
                <input
                  type="checkbox"
                  checked={typingVisible}
                  onChange={(e) => setTypingVisible(e.target.checked)}
                  className="w-4 h-4 rounded border border-bd bg-bg text-acc focus:ring-2 focus:ring-acc"
                />
              </div>
            </div>
          </div>
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
              <span className="text-xs text-mut">Encerrar todas as sessões exceto esta</span>
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
              <span className="text-xs text-mut">Login e senha são gerenciados pelo Google</span>
            </button>
            <button
              type="button"
              className="cursor-pointer w-full flex items-center justify-between px-4 py-3 text-left text-sm text-txt bg-bg border border-bd rounded-lg hover:bg-surf2 transition-colors active:scale-95"
            >
              <span>Exportar meus dados</span>
              <span className="text-xs text-mut">Baixar histórico e configurações</span>
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
