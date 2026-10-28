"use client";

import { useState } from "react";
import { Shield, Key, LockKeyOpen, Fingerprint, Download } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

export function SecurityTab() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [passkeys, setPasskeys] = useState(false);

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield size={20} className="text-acc" />
            Autenticação de dois fatores (2FA)
          </CardTitle>
          <CardDescription>Adicione uma camada extra de segurança à sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">App autenticador</p>
              <p className="text-sm text-mut">Use Google Authenticator, Authy ou similar</p>
            </div>
            <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Códigos de backup</p>
              <p className="text-sm text-mut">Códigos de uso único para acesso de emergência</p>
            </div>
            <Button variant="outline" size="sm">
              Gerar códigos
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Chave de segurança</p>
              <p className="text-sm text-mut">Use uma chave física (YubiKey, etc.)</p>
            </div>
            <Button variant="outline" size="sm">
              Adicionar chave
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key size={20} className="text-acc" />
            Senha e chaves de acesso
          </CardTitle>
          <CardDescription>Gerencie suas credenciais de login</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Alterar senha</p>
              <p className="text-sm text-mut">Atualize sua senha regularmente</p>
            </div>
            <Button variant="outline" size="sm">
              Alterar
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Passkeys (Chaves de acesso)</p>
              <p className="text-sm text-mut">Login sem senha usando biometria ou PIN</p>
            </div>
            <Switch checked={passkeys} onCheckedChange={setPasskeys} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint size={20} className="text-acc" />
            Sessões ativas
          </CardTitle>
          <CardDescription>Dispositivos onde você está conectado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-between p-3 rounded-lg border border-bd bg-bg hover:bg-surf2/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-lg bg-surf2 text-acc">
                <Fingerprint size={14} />
              </div>
              <div>
                <p className="font-medium text-txt">Windows Desktop</p>
                <p className="text-xs text-mut">Ativo agora • Echo 0.1.4</p>
              </div>
            </div>
            <span className="text-xs text-online font-medium">Sessão atual</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-bd bg-bg hover:bg-surf2/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2 rounded-lg bg-surf2 text-mut">
                <Fingerprint size={14} />
              </div>
              <div>
                <p className="font-medium text-txt">iPhone 15 Pro</p>
                <p className="text-xs text-mut">Último acesso: 2 horas atrás</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-err hover:text-err-press">
              Encerrar
            </Button>
          </div>
          <Button variant="outline" size="sm" className="w-full">
            Encerrar todas as outras sessões
          </Button>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyOpen size={20} className="text-acc" />
            Criptografia de ponta a ponta
          </CardTitle>
          <CardDescription>Gerencie suas chaves de criptografia</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Verificação de dispositivos</p>
              <p className="text-sm text-mut">Verifique seus dispositivos para criptografia segura</p>
            </div>
            <Button variant="outline" size="sm">
              Verificar
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Chaves de recuperação</p>
              <p className="text-sm text-mut">Backup seguro das suas chaves de criptografia</p>
            </div>
            <Button variant="outline" size="sm">
              Fazer backup
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Exportar chaves</p>
              <p className="text-sm text-mut">Baixar arquivo com suas chaves de criptografia</p>
            </div>
            <Button variant="outline" size="sm">
              <Download size={14} className="mr-2" />
              Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg border-err/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-err">
            <Shield size={20} />
            Redefinir segurança
          </CardTitle>
          <CardDescription>Remover todos os dispositivos e chaves confiáveis</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start">
                <Shield size={14} className="mr-2" />
                Redefinir configurações de segurança
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Redefinir segurança?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso removerá todos os dispositivos confiáveis, chaves de criptografia e configurações de 2FA.
                  Você precisará configurar tudo novamente. Tem certeza?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction>Redefinir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </section>
  );
}