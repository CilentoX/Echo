"use client";

import { Link as LinkIcon, ShieldCheck, Globe, ArrowSquareOut, CheckCircle } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useProfileStore } from "@/stores/profileStore";
import { useUiStore } from "@/stores/uiStore";

export function ConnectionsTab() {
  const { username, links } = useProfileStore();
  const myUserId = useUiStore((s) => s.myUserId) ?? username ?? "";
  const domain = myUserId.includes(":") ? myUserId.split(":")[1] : "litteris.online";

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon size={20} className="text-acc" />
            Contas Conectadas
          </CardTitle>
          <CardDescription>Serviços vinculados à sua identidade no Echo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {/* Google SSO */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-bd bg-surf">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-acc/10 text-acc">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-txt">Google Workspace</p>
                <p className="text-xs text-mut">Provedor oficial de autenticação SSO</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-online/10 text-online border border-online/20">
              <CheckCircle size={14} weight="fill" /> Conectado
            </span>
          </div>

          {/* Matrix Network */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-bd bg-surf">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 p-2.5 rounded-lg bg-acc/10 text-acc">
                <Globe size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-txt">Rede Federada Echo ({domain})</p>
                <p className="text-xs text-mut font-mono">{myUserId || "Identidade conectada"}</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-online/10 text-online border border-online/20">
              <CheckCircle size={14} weight="fill" /> Ativo
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Links de Perfil */}
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe size={18} className="text-acc" />
            Links Públicos Cadastrados
          </CardTitle>
          <CardDescription>
            Links externos configurados na sua aba &quot;Perfil&quot; e exibidos para outros usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {links && links.length > 0 ? (
            <div className="space-y-2">
              {links.map((link, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-txt px-2 py-0.5 bg-surf2 rounded border border-bd">
                      {link.label}
                    </span>
                    <span className="text-xs text-mut font-mono truncate max-w-xs">{link.url}</span>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-mut hover:text-txt rounded hover:bg-surf2 transition-colors"
                    title={`Abrir ${link.label}`}
                  >
                    <ArrowSquareOut size={16} />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mut p-4 text-center border border-dashed border-bd rounded-xl">
              Nenhum link público adicionado. Você pode cadastrar redes sociais e links clicando em &quot;Editar perfil&quot; na aba Perfil.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
