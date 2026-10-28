"use client";

import { useState } from "react";
import { Bell } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

interface NotificationOptions {
  messages: boolean;
  mentions: boolean;
  reactions: boolean;
  threads: boolean;
  guilds: boolean;
}

interface SoundOptions {
  sound: boolean;
  desktop: boolean;
  preview: boolean;
}

interface DndOptions {
  dnd: boolean;
  schedule: boolean;
}

const notificationOptions = [
  { id: "messages" as const, label: "Mensagens diretas", desc: "Notificar quando receber mensagens diretas", defaultChecked: true },
  { id: "mentions" as const, label: "Menções", desc: "Notificar quando for mencionado", defaultChecked: true },
  { id: "reactions" as const, label: "Reações", desc: "Notificar quando reagirem às suas mensagens", defaultChecked: false },
  { id: "threads" as const, label: "Tópicos", desc: "Notificar sobre respostas em tópicos que você segue", defaultChecked: true },
  { id: "guilds" as const, label: "Servidores", desc: "Notificar sobre atividades nos servidores", defaultChecked: false },
] as const;

const soundOptions = [
  { id: "sound" as const, label: "Som de notificação", desc: "Reproduzir som ao receber notificações", defaultChecked: true },
  { id: "desktop" as const, label: "Notificações do sistema", desc: "Mostrar notificações nativas do sistema operacional", defaultChecked: true },
  { id: "preview" as const, label: "Pré-visualização", desc: "Mostrar prévia da mensagem na notificação", defaultChecked: true },
] as const;

const dndOptions = [
  { id: "dnd" as const, label: "Não perturbar global", desc: "Silenciar todas as notificações", defaultChecked: false },
  { id: "schedule" as const, label: "Agendar não perturbar", desc: "Ativar automaticamente em horários definidos", defaultChecked: false },
] as const;

export function NotificationsTab() {
  const [notifications, setNotifications] = useState<NotificationOptions>({
    messages: true,
    mentions: true,
    reactions: false,
    threads: true,
    guilds: false,
  });
  const [sounds, setSounds] = useState<SoundOptions>({
    sound: true,
    desktop: true,
    preview: true,
  });
  const [dnd, setDnd] = useState<DndOptions>({
    dnd: false,
    schedule: false,
  });

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell size={20} className="text-acc" />
            Notificações
          </CardTitle>
          <CardDescription>Configure como e quando você recebe notificações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-mut">Configurações de notificação</p>
            <div className="space-y-3">
              {notificationOptions.map((item) => (
                <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-bg hover:bg-surf2/50 transition-colors">
                  <Switch
                    checked={notifications[item.id]}
                    onCheckedChange={(checked) => setNotifications((prev) => ({ ...prev, [item.id]: checked }))}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-txt">{item.label}</p>
                    <p className="text-xs text-mut">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-mut">Som e aparência</p>
            <div className="space-y-3">
              {soundOptions.map((item) => (
                <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-bg hover:bg-surf2/50 transition-colors">
                  <Switch
                    checked={sounds[item.id]}
                    onCheckedChange={(checked) => setSounds((prev) => ({ ...prev, [item.id]: checked }))}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-txt">{item.label}</p>
                    <p className="text-xs text-mut">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-mut">Não perturbar</p>
            <div className="space-y-3">
              {dndOptions.map((item) => (
                <label key={item.id} className="flex items-center gap-3 p-3 rounded-xl border border-bd bg-bg hover:bg-surf2/50 transition-colors">
                  <Switch
                    checked={dnd[item.id]}
                    onCheckedChange={(checked) => setDnd((prev) => ({ ...prev, [item.id]: checked }))}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-txt">{item.label}</p>
                    <p className="text-xs text-mut">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}