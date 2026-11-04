"use client";

import { useEffect, useState } from "react";
import {
  Palette,
  Monitor,
  CircleHalf,
  Check,
  Sun,
  Moon,
  Sparkle,
  Hash,
  House,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useThemeStore,
  THEME_PRESETS,
  type ThemeTokens,
} from "@/stores/themeStore";

export function AppearanceTab() {
  const { themeId, mode, setTheme, setMode } = useThemeStore();
  const [density, setDensity] = useState("Padrão");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  useEffect(() => {
    const savedDensity = localStorage.getItem("echo:density");
    if (savedDensity) setDensity(savedDensity);
  }, []);

  const handleSelectDensity = (d: string) => {
    setDensity(d);
    localStorage.setItem("echo:density", d);
  };

  return (
    <section className="space-y-6 max-w-3xl pb-8 text-txt select-none">
      {/* 1. Seleção de Modo (Escuro / Claro) */}
      <Card className="border-bd-glass bg-surf/40 shadow-xl overflow-hidden backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-display font-bold text-txt">
                <Sun size={18} className="text-acc" weight="bold" />
                Modo de Exibição
              </CardTitle>
              <CardDescription className="text-xs text-mut mt-0.5">
                Escolha a base de contraste que melhor se adapta ao seu ambiente de uso
              </CardDescription>
            </div>
            {/* Segmented Control */}
            <div className="flex items-center p-1 rounded-xl bg-bg/80 border border-bd-subtle">
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  mode === "dark"
                    ? "bg-acc text-bg shadow-md shadow-acc/20 scale-[1.02]"
                    : "text-mut hover:text-txt"
                }`}
              >
                <Moon size={14} weight="bold" />
                <span>Escuro</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("light")}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  mode === "light"
                    ? "bg-acc text-bg shadow-md shadow-acc/20 scale-[1.02]"
                    : "text-mut hover:text-txt"
                }`}
              >
                <Sun size={14} weight="bold" />
                <span>Claro</span>
              </button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 2. Temas Predefinidos Completos com Previews */}
      <Card className="border-bd-glass bg-surf/40 shadow-xl overflow-hidden backdrop-blur-md">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base font-display font-bold text-txt">
            <Palette size={18} className="text-acc" weight="bold" />
            Temas do Sistema
          </CardTitle>
          <CardDescription className="text-xs text-mut">
            Os temas transformam completamente a interface: fundos, barras laterais, botões, modais, painéis e dropdowns
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.values(THEME_PRESETS).map((preset) => {
              const isSelected = themeId === preset.id;
              const tokens = preset.modes[mode];

              return (
                <div
                  key={preset.id}
                  onClick={() => setTheme(preset.id)}
                  className={`cursor-pointer group relative flex flex-col rounded-2xl border transition-all duration-200 overflow-hidden text-left p-3.5 ${
                    isSelected
                      ? "border-acc bg-acc/[0.04] ring-2 ring-acc/30 shadow-xl shadow-acc/10 scale-[1.01]"
                      : "border-bd-subtle bg-bg/50 hover:border-bd-glass hover:bg-bg/80 hover:scale-[1.005]"
                  }`}
                >
                  {/* Cabeçalho do Card de Tema */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: tokens.acc }}
                      />
                      <h3 className="font-display font-bold text-sm text-txt">
                        {preset.name}
                      </h3>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider"
                        style={{
                          backgroundColor: `${tokens.acc}15`,
                          borderColor: `${tokens.acc}30`,
                          color: tokens.acc,
                        }}
                      >
                        {preset.badge}
                      </span>
                    </div>

                    {/* Indicador de Selecionado */}
                    {isSelected ? (
                      <div
                        className="flex items-center justify-center w-5 h-5 rounded-full text-bg shadow-md"
                        style={{ backgroundColor: tokens.acc }}
                      >
                        <Check size={12} weight="bold" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border border-bd-glass group-hover:border-acc/40 transition-colors" />
                    )}
                  </div>

                  <p className="text-xs text-mut mb-3 line-clamp-1">
                    {preset.tagline}
                  </p>

                  {/* PREVIEW INTERATIVO DO CLIENTE EM MINIATURA */}
                  <MiniClientPreview tokens={tokens} />

                  {/* Barra de Amostras de Cores (Swatches) */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-bd-subtle text-[11px] text-mut">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-mut/70">Paleta:</span>
                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          title="Rail"
                          style={{ backgroundColor: tokens.rail }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          title="Sidebar"
                          style={{ backgroundColor: tokens.surf }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          title="Fundo"
                          style={{ backgroundColor: tokens.bg }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          title="Card / Dropdown"
                          style={{ backgroundColor: tokens.cardBg }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-xs"
                          title="Acento / Botão"
                          style={{ backgroundColor: tokens.acc }}
                        />
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: tokens.acc }}
                    >
                      {isSelected ? "Ativo" : "Clique para aplicar"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 3. Densidade de Exibição */}
      <Card className="border-bd-glass bg-surf/40 shadow-xl overflow-hidden backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display font-bold text-txt">
            <Monitor size={18} className="text-acc" weight="bold" />
            Densidade da Interface
          </CardTitle>
          <CardDescription className="text-xs text-mut">
            Ajuste o espaçamento entre mensagens, canais e listas
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2.5">
            {["Compacta", "Padrão", "Confortável"].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleSelectDensity(d)}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 border ${
                  density === d
                    ? "bg-acc text-bg border-transparent shadow-md shadow-acc/20 scale-[1.01]"
                    : "border-bd-subtle bg-bg/50 hover:bg-bg/80 text-txt hover:border-bd-glass"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 4. Acessibilidade */}
      <Card className="border-bd-glass bg-surf/40 shadow-xl overflow-hidden backdrop-blur-md">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-display font-bold text-txt">
            <CircleHalf size={18} className="text-acc" weight="bold" />
            Acessibilidade Visual
          </CardTitle>
          <CardDescription className="text-xs text-mut">
            Preferências adicionais para maior conforto e foco
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd-subtle bg-bg/40 hover:bg-bg/70 transition-colors cursor-pointer">
            <div>
              <p className="font-semibold text-txt text-xs">Reduzir movimento</p>
              <p className="text-[11px] text-mut">Diminui animações de transição de telas e popups</p>
            </div>
            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
          </label>
          <label className="flex items-center justify-between p-3 rounded-xl border border-bd-subtle bg-bg/40 hover:bg-bg/70 transition-colors cursor-pointer">
            <div>
              <p className="font-semibold text-txt text-xs">Alto contraste de painéis</p>
              <p className="text-[11px] text-mut">Reforça as bordas e divisões entre trilho, sidebar e chat</p>
            </div>
            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
          </label>
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * Preview em miniatura do cliente Echo mostrando Rail, Sidebar, Chat, Bolhas e Botão.
 */
function MiniClientPreview({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div
      className="relative w-full h-28 rounded-xl overflow-hidden border border-black/20 shadow-md flex text-[9px] pointer-events-none select-none"
      style={{ backgroundColor: tokens.bg }}
    >
      {/* Mini Rail */}
      <div
        className="w-7 h-full flex flex-col items-center py-2 gap-1.5 border-r"
        style={{
          backgroundColor: tokens.rail,
          borderColor: tokens.bdSubtle,
        }}
      >
        {/* Home icon */}
        <div
          className="w-4 h-4 rounded-md flex items-center justify-center text-[8px]"
          style={{ backgroundColor: tokens.acc, color: tokens.bg }}
        >
          <House size={9} weight="bold" />
        </div>
        {/* Divider */}
        <div
          className="w-3 h-px opacity-30"
          style={{ backgroundColor: tokens.txt }}
        />
        {/* Guild icon with active indicator */}
        <div className="relative">
          <div
            className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[7px]"
            style={{
              backgroundColor: tokens.surf2,
              color: tokens.txt,
              border: `1px solid ${tokens.acc}`,
            }}
          >
            E
          </div>
          <span
            className="absolute -left-1 top-1 w-0.5 h-2 rounded-r"
            style={{ backgroundColor: tokens.acc }}
          />
        </div>
      </div>

      {/* Mini Sidebar */}
      <div
        className="w-20 h-full flex flex-col p-1.5 gap-1 border-r"
        style={{
          backgroundColor: tokens.surf,
          borderColor: tokens.bdSubtle,
        }}
      >
        <div
          className="font-bold truncate text-[8px] opacity-90 px-0.5"
          style={{ color: tokens.txt }}
        >
          Echo Guild
        </div>
        <div
          className="text-[7px] uppercase tracking-wider font-semibold opacity-50 px-0.5"
          style={{ color: tokens.mut }}
        >
          Canais
        </div>
        {/* Active channel */}
        <div
          className="flex items-center gap-1 px-1 py-0.5 rounded font-medium text-[8px]"
          style={{
            backgroundColor: `${tokens.acc}15`,
            color: tokens.acc,
          }}
        >
          <Hash size={7} weight="bold" />
          <span className="truncate">geral</span>
        </div>
        {/* Inactive channel */}
        <div
          className="flex items-center gap-1 px-1 py-0.5 rounded text-[8px] opacity-60"
          style={{ color: tokens.mut }}
        >
          <Hash size={7} />
          <span className="truncate">anúncios</span>
        </div>
      </div>

      {/* Mini Chat Pane */}
      <div
        className="flex-1 h-full flex flex-col justify-between p-1.5"
        style={{ backgroundColor: tokens.bg }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between pb-1 border-b"
          style={{ borderColor: tokens.bdSubtle }}
        >
          <div className="flex items-center gap-1">
            <Hash size={8} style={{ color: tokens.acc }} />
            <span className="font-bold text-[8px]" style={{ color: tokens.txt }}>
              geral
            </span>
          </div>
          <div
            className="h-3 px-1.5 rounded-full flex items-center text-[7px] font-semibold"
            style={{
              backgroundColor: `${tokens.acc}18`,
              color: tokens.acc,
              border: `1px solid ${tokens.acc}35`,
            }}
          >
            Online
          </div>
        </div>

        {/* Message bubbles */}
        <div className="flex flex-col gap-1 py-1">
          {/* Receiver message */}
          <div className="flex items-start gap-1">
            <div
              className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center font-bold text-[7px]"
              style={{ backgroundColor: tokens.surf2, color: tokens.txt }}
            >
              U
            </div>
            <div
              className="rounded-md px-1.5 py-0.5 max-w-[80%]"
              style={{
                backgroundColor: tokens.bubbleReceiver,
                color: tokens.txt,
                border: `1px solid ${tokens.bdSubtle}`,
              }}
            >
              Olá! Como está o Echo?
            </div>
          </div>

          {/* Sender message (highlighted in theme) */}
          <div className="flex items-start justify-end gap-1">
            <div
              className="rounded-md px-1.5 py-0.5 max-w-[80%] text-right font-medium"
              style={{
                backgroundColor: tokens.bubbleSender,
                color: tokens.txt,
                border: `1px solid ${tokens.acc}40`,
              }}
            >
              Visual incrível e fluido! ✨
            </div>
          </div>
        </div>

        {/* Mini Composer / Dock */}
        <div
          className="h-4 rounded flex items-center justify-between px-1.5 border"
          style={{
            backgroundColor: tokens.cardBg,
            borderColor: tokens.bdGlass,
          }}
        >
          <span className="text-[7px] opacity-40" style={{ color: tokens.mut }}>
            Conversar em #geral...
          </span>
          <div
            className="w-2.5 h-2.5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: tokens.acc, color: tokens.bg }}
          >
            <Sparkle size={6} weight="fill" />
          </div>
        </div>
      </div>
    </div>
  );
}
