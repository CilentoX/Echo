"use client";

import { Lock, Eye } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settingsStore";

export function PrivacyTab() {
  const {
    readReceipts,
    setReadReceipts,
    typingVisible,
    setTypingVisible,
    onlineStatusVisible,
    setOnlineStatusVisible,
  } = useSettingsStore();

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock size={20} className="text-acc" />
            Privacidade nas Conversas
          </CardTitle>
          <CardDescription>Controle o que os outros veem sobre suas interações de mensagem</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-txt text-sm">Confirmações de leitura</p>
              <p className="text-xs text-mut">Enviar e exibir comprovantes de leitura de mensagens</p>
            </div>
            <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-txt text-sm">Indicador de digitação</p>
              <p className="text-xs text-mut">Mostrar aviso de que você está digitando nos canais e DMs</p>
            </div>
            <Switch checked={typingVisible} onCheckedChange={setTypingVisible} />
          </label>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye size={20} className="text-acc" />
            Visibilidade de Presença
          </CardTitle>
          <CardDescription>Gerencie como seu status é exibido para amigos e guildas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-txt text-sm">Exibir status online</p>
              <p className="text-xs text-mut">Permitir que seus amigos e membros da guilda vejam quando você está conectado</p>
            </div>
            <Switch checked={onlineStatusVisible} onCheckedChange={setOnlineStatusVisible} />
          </label>
        </CardContent>
      </Card>
    </section>
  );
}
