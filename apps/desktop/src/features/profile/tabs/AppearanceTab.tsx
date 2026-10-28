"use client";

import { useState } from "react";
import { Palette, Monitor, CircleHalf, PaintBrush } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

export function AppearanceTab() {
  const [darkMode, setDarkMode] = useState(true);
  const [syncSystem, setSyncSystem] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [largerText, setLargerText] = useState(false);

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={20} className="text-acc" />
            Tema
          </CardTitle>
          <CardDescription>Personalize a aparência do Echo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Modo escuro</p>
              <p className="text-sm text-mut">Usar tema escuro em todo o aplicativo</p>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Sincronizar com sistema</p>
              <p className="text-sm text-mut">Seguir a configuração do sistema operacional</p>
            </div>
            <Switch checked={syncSystem} onCheckedChange={setSyncSystem} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaintBrush size={20} className="text-acc" />
            Cores de destaque
          </CardTitle>
          <CardDescription>Escolha a cor principal da interface</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-5 gap-3">
            {[
              { name: "Padrão", color: "bg-acc" },
              { name: "Azul", color: "bg-blue-500" },
              { name: "Roxo", color: "bg-purple-500" },
              { name: "Verde", color: "bg-green-500" },
              { name: "Laranja", color: "bg-orange-500" },
            ].map((accent) => (
              <button
                key={accent.name}
                type="button"
                className={`relative h-12 rounded-lg border-2 transition-all ${accent.color}`}
                title={accent.name}
              >
                <span className="sr-only">{accent.name}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor size={20} className="text-acc" />
            Densidade de exibição
          </CardTitle>
          <CardDescription>Controle o espaçamento dos elementos</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-4">
            {["Compacta", "Padrão", "Confortável"].map((density) => (
              <Button key={density} type="button" variant="outline" className="flex-1">
                {density}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleHalf size={20} className="text-acc" />
            Acessibilidade
          </CardTitle>
          <CardDescription>Opções para melhorar a legibilidade</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Reduzir movimento</p>
              <p className="text-sm text-mut">Desativar animações e transições</p>
            </div>
            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Alto contraste</p>
              <p className="text-sm text-mut">Aumentar contraste para melhor legibilidade</p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-txt">Fonte maior</p>
              <p className="text-sm text-mut">Aumentar tamanho do texto em todo o app</p>
            </div>
            <Switch checked={largerText} onCheckedChange={setLargerText} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}