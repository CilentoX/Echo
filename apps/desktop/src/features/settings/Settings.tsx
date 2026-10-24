import { useEffect, useState } from "react";
import { Bell, Clock, Eye, Lock, ShieldCheck, SpeakerHigh, Microphone, VideoCamera, Headphones, X, type Icon } from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";
import { performLogout } from "@/features/auth/logout";
import { FALLBACK_DEVICES, listRealDevices, type DeviceLists } from "@/lib/media/devices";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader } from "@/components/ui/dialog";

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
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-[640px] p-0 flex flex-col h-[90vh]">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-bd bg-surf/50 backdrop-blur flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-txt">Configurações</h2>
            <button
              type="button"
              aria-label="Fechar configurações"
              onClick={onClose}
              className="cursor-pointer rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt transition-colors active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
          <DialogDescription className="text-xs text-mut">
            Gerencie suas preferências de conta e aplicativo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Notificações */}
          <section className="border-b border-bd pb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                  <Bell size={16} weight="bold" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-txt">Notificações</h3>
                  <p className="text-xs text-mut">Banners e click-to-focus na área de trabalho</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <Bell size={16} weight="bold" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Notificações nativas do SO</div>
                    <div className="text-xs text-mut">Banners e click-to-focus na área de trabalho</div>
                  </div>
                </div>
                <Switch
                  checked={!!nativeNotifications}
                  onCheckedChange={setNativeNotifications}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <SpeakerHigh size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Som de mensagem</div>
                    <div className="text-xs text-mut">Tocar áudio ao receber mensagem</div>
                  </div>
                </div>
                <Switch
                  checked={!!messageSound}
                  onCheckedChange={setMessageSound}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <Clock size={16} weight="bold" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Apenas menções</div>
                    <div className="text-xs text-mut">Notificar somente quando alguém te marcar</div>
                  </div>
                </div>
                <Switch
                  checked={!!mentionOnly}
                  onCheckedChange={setMentionOnly}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
            </div>
          </section>

          {/* Voz e vídeo */}
          <section className="border-b border-bd pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-txt">Voz e vídeo</h3>
            </div>
            <div className="space-y-4">
              {DEVICE_KINDS.map(({ kind, label, icon: Icon }) => {
                const enabled = kind === "microphone" ? microphoneEnabled : kind === "camera" ? cameraEnabled : headphonesEnabled;
                const deviceId = kind === "microphone" ? microphoneDevice : kind === "camera" ? cameraDevice : headphonesDevice;
                const setDevice = kind === "microphone" ? setMicrophoneDevice : kind === "camera" ? setCameraDevice : setHeadphonesDevice;

                return (
                  <div key={kind} className="border-b border-bd last:border-0 py-4 group">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                          <Icon size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-txt">{label}</div>
                          <div className="text-xs text-mut">{enabled ? "Dispositivo ativo" : "Desativado"}</div>
                        </div>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(v) => {
                            if (kind === "microphone") setMicrophoneDevice(v ? microphoneDevice : null);
                            if (kind === "camera") setCameraDevice(v ? cameraDevice : null);
                            if (kind === "headphones") setHeadphonesDevice(v ? headphonesDevice : null);
                          }}
                          className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                        />
                      </div>
                      <Select
                        aria-label={`Dispositivo de ${label.toLowerCase()}`}
                        value={deviceId ?? ""}
                        disabled={!enabled}
                        onValueChange={(value) => setDevice(value || null)}
                      >
                        <SelectTrigger className="w-[200px] cursor-pointer rounded-lg border border-bd bg-bg px-3 py-1.5 text-sm text-txt outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                          <SelectValue placeholder="Padrão do sistema" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Padrão do sistema</SelectItem>
                          {deviceId &&
                            !devices[kind].some((d) => d.id === deviceId) && (
                              <SelectItem value={deviceId}>Dispositivo atual</SelectItem>
                            )}
                          {devices[kind].map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Privacidade */}
          <section className="border-b border-bd pb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base font-semibold text-txt">Privacidade</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <Eye size={16} weight="bold" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Status online visível</div>
                    <div className="text-xs text-mut">Outros membros veem se você está online</div>
                  </div>
                </div>
                <Switch
                  checked={!!onlineStatusVisible}
                  onCheckedChange={setOnlineStatusVisible}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <ShieldCheck size={16} weight="bold" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Confirmar leitura</div>
                    <div className="text-xs text-mut">Enviar recibos de leitura nas mensagens</div>
                  </div>
                </div>
                <Switch
                  checked={!!readReceipts}
                  onCheckedChange={setReadReceipts}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                    <Microphone size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-txt">Digitação visível</div>
                    <div className="text-xs text-mut">Mostrar 'está digitando…' para os outros</div>
                  </div>
                </div>
                <Switch
                  checked={!!typingVisible}
                  onCheckedChange={setTypingVisible}
                  className="peer data-[state=checked]:bg-acc data-[state=unchecked]:bg-bg"
                />
              </div>
            </div>
          </section>

          {/* Sessões */}
          <section className="border-b border-bd pb-6">
            <h3 className="font-display text-base font-semibold text-txt mb-4">Sessões</h3>
            <div className="border-b border-bd pb-4">
              <div className="flex items-center justify-between px-2">
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
      </DialogContent>
    </Dialog>
  );
}
