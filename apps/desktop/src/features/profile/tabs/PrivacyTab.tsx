"use client";

import { useState } from "react";
import { Lock, Eye, Shield, Trash } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function PrivacyTab() {
  const [readReceipts, setReadReceipts] = useState(true);
  const [typingIndicator, setTypingIndicator] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [lastSeen, setLastSeen] = useState(false);

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock size={20} className="text-acc" />
            Privacidade de leitura
          </CardTitle>
          <CardDescription>Controle o que os outros veem sobre sua atividade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Confirmações de leitura</p>
              <p className="text-sm text-mut">Mostrar quando você leu as mensagens</p>
            </div>
            <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Indicador de digitação</p>
              <p className="text-sm text-mut">Mostrar quando você está digitando</p>
            </div>
            <Switch checked={typingIndicator} onCheckedChange={setTypingIndicator} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye size={20} className="text-acc" />
            Visibilidade do perfil
          </CardTitle>
          <CardDescription>Quem pode ver seu perfil e informações</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Perfil público</p>
              <p className="text-sm text-mut">Permitir que qualquer um veja seu perfil</p>
            </div>
            <Switch checked={publicProfile} onCheckedChange={setPublicProfile} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Mostrar status online</p>
              <p className="text-sm text-mut">Exibir quando você está online</p>
            </div>
            <Switch checked={showOnline} onCheckedChange={setShowOnline} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Mostrar último acesso</p>
              <p className="text-sm text-mut">Exibir quando você esteve online pela última vez</p>
            </div>
            <Switch checked={lastSeen} onCheckedChange={setLastSeen} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} className="text-acc" />
            Segurança da conta
          </CardTitle>
          <CardDescription>Gerencie a segurança da sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Autenticação de dois fatores</p>
              <p className="text-sm text-mut">Adicionar uma camada extra de segurança</p>
            </div>
            <Button variant="outline" size="sm">
              Configurar
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Sessões ativas</p>
              <p className="text-sm text-mut">Ver e gerenciar dispositivos conectados</p>
            </div>
            <Button variant="outline" size="sm">
              Ver sessões
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Chaves de criptografia</p>
              <p className="text-sm text-mut">Gerenciar chaves de criptografia de ponta a ponta</p>
            </div>
            <Button variant="outline" size="sm">
              Gerenciar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg border-err/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-err">
            <Trash size={20} />
            Zona de perigo
          </CardTitle>
          <CardDescription>Ações irreversíveis</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start">
                <Trash size={14} className="mr-2" />
                Excluir conta permanentemente
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é irreversível. Todos os seus dados, mensagens, servidores e configurações serão
                  permanentemente excluídos. Tem certeza que deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction>Excluir conta</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </section>
  );
}
