"use client";

import { useState } from "react";
import { Fingerprint, Trash, Copy, Check, SignOut, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { triggerFullAccountReset } from "@/lib/onboarding";
import { performLogout } from "@/features/auth/logout";
import { useEchoApi } from "@/lib/api/echoApi";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";

export function SecurityTab() {
  const echoApi = useEchoApi();
  const { username } = useProfileStore();
  const myUserId = useUiStore((s) => s.myUserId) ?? username ?? "";
  const [copied, setCopied] = useState(false);

  const handleCopyId = () => {
    if (!myUserId) return;
    navigator.clipboard.writeText(myUserId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const domain = myUserId.includes(":") ? myUserId.split(":")[1] : "litteris.online";

  return (
    <section className="space-y-6 max-w-2xl">
      {/* Informações da Conta e Identidade */}
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-acc" />
            Identidade da Conta
          </CardTitle>
          <CardDescription>Dados de autenticação federada e identificador único</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-mut">ID de Usuário Echo / Matrix</p>
              <p className="font-mono text-sm font-medium text-txt mt-0.5">{myUserId || "Carregando…"}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyId}
              className="cursor-pointer gap-1.5 text-xs hover:bg-surf2"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-online" /> Copiado
                </>
              ) : (
                <>
                  <Copy size={14} /> Copiar ID
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-bd bg-surf">
              <p className="text-xs font-semibold uppercase tracking-wider text-mut">Servidor Residencial</p>
              <p className="font-mono text-xs font-medium text-txt mt-1">{domain}</p>
            </div>
            <div className="p-3 rounded-xl border border-bd bg-surf">
              <p className="text-xs font-semibold uppercase tracking-wider text-mut">Autenticação</p>
              <p className="text-xs font-medium text-txt mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-online" />
                Google Workspace SSO
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessão Atual e Conectividade */}
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fingerprint size={20} className="text-acc" />
            Sessão Atual
          </CardTitle>
          <CardDescription>Dispositivo autenticado e controle de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-bd bg-surf">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-acc/10 text-acc">
                <Fingerprint size={18} />
              </div>
              <div>
                <p className="font-medium text-sm text-txt">Echo Desktop (Windows)</p>
                <p className="text-xs text-mut">Ativo agora • Criptografia habilitada</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-online/10 text-online border border-online/20">
              <span className="w-1.5 h-1.5 rounded-full bg-online" />
              Sessão ativa
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => performLogout()}
            className="w-full text-sm font-medium border-bd hover:bg-surf2 text-txt hover:text-err transition-colors cursor-pointer"
          >
            <SignOut size={16} className="mr-2" />
            Encerrar sessão neste dispositivo
          </Button>
        </CardContent>
      </Card>

      {/* Zona de Perigo: Apagar Conta & Reiniciar Onboarding */}
      <Card className="border-err/40 dark:bg-[#160D12] bg-red-500/[0.04]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <Trash size={20} />
            Apagar Conta & Reiniciar Onboarding
          </CardTitle>
          <CardDescription>
            Exclui seu perfil no servidor, desconecta a sessão atual e limpa todas as configurações para você poder refazer o login e o onboarding do zero.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full justify-start bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer">
                <Trash size={16} className="mr-2" />
                Apagar dados da conta e reiniciar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card-bg border border-bd-glass text-txt">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-400 font-bold">Apagar conta e reiniciar?</AlertDialogTitle>
                <AlertDialogDescription className="text-mut">
                  Esta ação excluirá seu perfil do banco de dados, limpará todas as sessões salvas neste dispositivo e resetará o processo de onboarding. Você voltará para a tela inicial de login com Google.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-surf border-bd text-txt hover:bg-surf2">
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => triggerFullAccountReset(echoApi)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold"
                >
                  Sim, apagar e reiniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </section>
  );
}
