"use client";

import { useEffect, useState } from "react";
import { Palette, PaintBrush, Monitor, CircleHalf, Check } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const ACCENT_COLORS = [
  { name: "Padrão", hex: "#0FB9A8", press: "#0D9E8A", glow: "rgba(15, 185, 168, 0.2)", color: "bg-[#0FB9A8]" },
  { name: "Azul", hex: "#3B82F6", press: "#2563EB", glow: "rgba(59, 130, 246, 0.2)", color: "bg-blue-500" },
  { name: "Roxo", hex: "#A855F7", press: "#9333EA", glow: "rgba(168, 85, 247, 0.2)", color: "bg-purple-500" },
  { name: "Verde", hex: "#10B981", press: "#059669", glow: "rgba(16, 185, 129, 0.2)", color: "bg-emerald-500" },
  { name: "Laranja", hex: "#F59E0B", press: "#D97706", glow: "rgba(245, 158, 11, 0.2)", color: "bg-orange-500" },
];

export function AppearanceTab() {
  const [selectedAccent, setSelectedAccent] = useState("Padrão");
  const [density, setDensity] = useState("Padrão");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedAccent = localStorage.getItem("echo:accentColor");
    if (savedAccent) {
      try {
        const parsed = JSON.parse(savedAccent);
        if (parsed?.name) setSelectedAccent(parsed.name);
      } catch {}
    }
    const savedDensity = localStorage.getItem("echo:density");
    if (savedDensity) setDensity(savedDensity);
  }, []);

  const handleSelectAccent = (accent: typeof ACCENT_COLORS[0]) => {
    setSelectedAccent(accent.name);
    document.documentElement.style.setProperty("--acc", accent.hex);
    document.documentElement.style.setProperty("--acc-press", accent.press);
    document.documentElement.style.setProperty("--acc-glow", accent.glow);
    document.documentElement.style.setProperty("--acc-muted", `${accent.hex}20`);
    localStorage.setItem("echo:accentColor", JSON.stringify(accent));
  };

  const handleSelectDensity = (d: string) => {
    setDensity(d);
    localStorage.setItem("echo:density", d);
  };

  return (
    <section className="space-y-6 max-w-2xl">
      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette size={20} className="text-acc" />
            Tema Echo
          </CardTitle>
          <CardDescription>O Echo utiliza uma interface escura semântica desenhada para clareza e foco</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf">
            <div>
              <p className="font-medium text-txt text-sm">Tema Escuro Ativo</p>
              <p className="text-xs text-mut">Paleta otimizada para menor fadiga visual e contraste elevado</p>
            </div>
            <span className="text-xs text-acc font-semibold uppercase tracking-wider bg-acc/10 px-2.5 py-1 rounded-full border border-acc/20">
              Padrão
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaintBrush size={20} className="text-acc" />
            Cores de Destaque
          </CardTitle>
          <CardDescription>Personalize a cor de botões, tags ativas e indicadores em tempo real</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-5 gap-3">
            {ACCENT_COLORS.map((accent) => {
              const isSelected = selectedAccent === accent.name;
              return (
                <button
                  key={accent.name}
                  type="button"
                  onClick={() => handleSelectAccent(accent)}
                  className={`group relative h-12 rounded-xl border-2 transition-all duration-150 flex items-center justify-center cursor-pointer active:scale-95 ${accent.color} ${
                    isSelected ? "border-white ring-2 ring-white/30 scale-105 shadow-lg" : "border-transparent opacity-85 hover:opacity-100 hover:scale-105"
                  }`}
                  title={accent.name}
                >
                  {isSelected && <Check size={18} weight="bold" className="text-white drop-shadow" />}
                  <span className="sr-only">{accent.name}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-bd bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor size={20} className="text-acc" />
            Densidade de exibição
          </CardTitle>
          <CardDescription>Controle o espaçamento entre mensagens e canais</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-3">
            {["Compacta", "Padrão", "Confortável"].map((d) => (
              <Button
                key={d}
                type="button"
                variant={density === d ? "default" : "outline"}
                onClick={() => handleSelectDensity(d)}
                className={`flex-1 transition-all duration-150 cursor-pointer ${
                  density === d
                    ? "bg-acc text-bg font-semibold shadow-md shadow-acc/20"
                    : "border-bd hover:bg-surf2 text-txt"
                }`}
              >
                {d}
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
          <CardDescription>Ajustes visuais para conforto e foco</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-txt text-sm">Reduzir movimento</p>
              <p className="text-xs text-mut">Diminui animações de transição de telas</p>
            </div>
            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd bg-surf hover:bg-surf2/50 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-txt text-sm">Alto contraste</p>
              <p className="text-xs text-mut">Aumenta o contraste visual entre painéis</p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </label>
        </CardContent>
      </Card>
    </section>
  );
}
