import { useState } from "react";
import { Bell, Eye, Keyboard, ShieldCheck, Clock, Lock } from "@phosphor-icons/react";
import { useSettingsStore } from "@/stores/settingsStore";

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Sheet de configurações do app.
 * Aparência, notificações, privacidade, sessões e conta.
 */
export default function Settings({ open, onClose }: SettingsProps) {
  const {
    compactMode, setCompactMode,
    density, setDensity,
    nativeNotifications, setNativeNotifications,
    messageSound, setMessageSound,
    mentionOnly, setMentionOnly,
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
          className={`relative inline-flex w-10 h-5 shrink-0 cursor-pointer rounded-full border-bd ${checked ? "bg-acc" : ""} transition-colors`}
        >
          <span
            className={`block w-3 h-3 rounded-full bg-bg shadow ${checked ? "translate-x-5" : ""} transition-transform`}
          />
        </button>
      </div>
    </div>
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
            Bell
          )}
          {toggleRow(
            "Apenas menções",
            "Notificar somente quando alguém te marcar",
            mentionOnly,
            setMentionOnly,
            Clock
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
              <span style={{ display: "inline-block", width: "14px", height: "14px" }} aria-hidden>↗</span>
              <span>Sair da conta</span>
            </button>
          </div>
        </section>
      </div>
    </aside>
  );
}