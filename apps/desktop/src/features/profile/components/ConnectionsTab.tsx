"use client";

import { LinkIcon, PlusIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CONNECTION_OPTIONS } from "../constants";

export function ConnectionsTab() {
  return (
    <section className="space-y-6 max-w-2xl">
      <h3 className="font-display text-lg font-semibold text-txt flex items-center gap-2">
        <LinkIcon size={16} className="text-acc" />
        Conexões
      </h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">Contas conectadas</Label>
          <div className="space-y-3">
            {CONNECTION_OPTIONS.map((conn) => (
              <div key={conn.id} className="flex items-center justify-between p-3 rounded-xl border border-bd bg-bg hover:bg-surf2/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 p-2 rounded-lg bg-surf2 ${conn.color}`}>
                    {conn.icon}
                  </div>
                  <div>
                    <p className="font-medium text-txt">{conn.name}</p>
                    <p className="text-xs text-mut">Conta conectada</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-xs text-acc hover:text-acc-press">
                  Desconectar
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="pt-4 border-t border-bd">
          <p className="text-xs text-mut mb-2">Adicione uma nova conta clicando no botão abaixo.</p>
          <Button variant="outline" size="sm" className="w-full">
            <PlusIcon size={14} className="mr-2" />
            Adicionar conta
          </Button>
        </div>
      </div>
    </section>
  );
}