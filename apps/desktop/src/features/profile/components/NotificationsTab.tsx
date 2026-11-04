"use client";

import { Bell, SpeakerHigh } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";

export function NotificationsTab() {
  const {
    nativeNotifications,
    setNativeNotifications,
    messageSound,
    setMessageSound,
    mentionOnly,
    setMentionOnly,
  } = useSettingsStore();

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} className="text-acc" />
            Preferências de Notificações
          </CardTitle>
          <CardDescription>Configure como o Echo alerta sobre novas mensagens e menções</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
              <Switch
                checked={nativeNotifications}
                onCheckedChange={setNativeNotifications}
              />
              <div className="flex-1">
                <p className="font-medium text-txt text-sm">Notificações nativas do sistema</p>
                <p className="text-xs text-mut">Exibir banners na área de trabalho e focar ao clicar</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
              <Switch
                checked={mentionOnly}
                onCheckedChange={setMentionOnly}
              />
              <div className="flex-1">
                <p className="font-medium text-txt text-sm">Notificar apenas menções e mensagens diretas</p>
                <p className="text-xs text-mut">Silencia o fluxo geral de canais da comunidade</p>
              </div>
            </label>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-mut mb-3 flex items-center gap-1.5">
              <SpeakerHigh size={14} className="text-acc" />
              Sons e Feedback Auditivo
            </p>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
                <Switch
                  checked={messageSound}
                  onCheckedChange={setMessageSound}
                />
                <div className="flex-1">
                  <p className="font-medium text-txt text-sm">Som de mensagem recebida</p>
                  <p className="text-xs text-mut">Tocar o chime característico do Echo ao receber mensagens</p>
                </div>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
