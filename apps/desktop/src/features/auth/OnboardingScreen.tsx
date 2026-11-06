"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  User,
  ShieldCheck,
  Globe,
  Sparkle,
  Camera,
  Trash,
  Crop,
} from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { markOnboardingCompleted, triggerFullAccountReset } from "@/lib/onboarding";
import { useEchoApi } from "@/lib/api/echoApi";
import { useUiStore } from "@/stores/uiStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useProfileStore } from "@/stores/profileStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ImageEditor from "@/components/media/ImageEditor";

type Step = "welcome" | "profile";

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "E";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function OnboardingScreen({
  onComplete,
}: {
  /** Chamado quando o onboarding é concluído com sucesso. */
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [nickname, setNickname] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Avatar states
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [rawAvatarUrl, setRawAvatarUrl] = useState<string | null>(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);

  // Banner states
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [rawBannerUrl, setRawBannerUrl] = useState<string | null>(null);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const myUserId = useUiStore((s) => s.myUserId);
  const onboardingDone = useOnboardingStore((s) => s.completed);

  // Se já foi concluído, não renderizar (defensivo)
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (onboardingDone && !notifiedRef.current) {
      notifiedRef.current = true;
      onComplete();
    }
  }, [onboardingDone, onComplete]);

  // Pré-preenche o nickname e avatar caso já existam no Matrix ou Profile Store
  useEffect(() => {
    const loadCurrentProfile = async () => {
      if (!myUserId) return;
      try {
        const currentName = await matrixService.getDisplayName(myUserId);
        if (currentName && !nickname.trim()) {
          setNickname(currentName);
        }
        const storeAvatar = useProfileStore.getState().appwriteAvatarUrl ?? useProfileStore.getState().avatarUrl;
        if (storeAvatar && !avatarPreview) {
          setAvatarPreview(storeAvatar);
        }
      } catch {
        // ignore falha defensiva
      }
    };
    loadCurrentProfile();
  }, [myUserId, nickname, avatarPreview]);

  // Limpeza de Object URLs ao desmontar
  useEffect(() => {
    return () => {
      if (rawAvatarUrl) URL.revokeObjectURL(rawAvatarUrl);
      if (avatarPreview && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
      if (rawBannerUrl) URL.revokeObjectURL(rawBannerUrl);
      if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    };
  }, [rawAvatarUrl, avatarPreview, rawBannerUrl, bannerPreview]);

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (rawAvatarUrl) URL.revokeObjectURL(rawAvatarUrl);
    setRawAvatarUrl(url);
    setAvatarEditorOpen(true);
    e.target.value = "";
  };

  const handleAvatarConfirm = (croppedFile: File) => {
    setAvatarFile(croppedFile);
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(URL.createObjectURL(croppedFile));
    setAvatarEditorOpen(false);
  };

  const handleBannerSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    if (rawBannerUrl) URL.revokeObjectURL(rawBannerUrl);
    setRawBannerUrl(url);
    setBannerEditorOpen(true);
    e.target.value = "";
  };

  const handleBannerConfirm = (croppedFile: File) => {
    setBannerFile(croppedFile);
    if (bannerPreview && bannerPreview.startsWith("blob:")) {
      URL.revokeObjectURL(bannerPreview);
    }
    setBannerPreview(URL.createObjectURL(croppedFile));
    setBannerEditorOpen(false);
  };

  const echoApi = useEchoApi();

  const handleSubmit = useCallback(async () => {
    if (!nickname.trim()) return;
    if (!myUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      let finalAvatarUrl: string | null = avatarPreview && !avatarPreview.startsWith("blob:") ? avatarPreview : null;
      let finalBannerUrl: string | null = bannerPreview && !bannerPreview.startsWith("blob:") ? bannerPreview : null;

      if (avatarFile) {
        finalAvatarUrl = await echoApi.uploadChatMedia(avatarFile);
      }
      if (bannerFile) {
        finalBannerUrl = await echoApi.uploadChatMedia(bannerFile);
      }

      await matrixService.setDisplayName(nickname.trim());

      if (finalAvatarUrl) {
        await matrixService.setAvatarUrl(finalAvatarUrl);
      }

      // Sincroniza avatar e dados com Profile API (Postgres)
      try {
        await matrixService.patchGlobalProfile({
          avatarUrl: finalAvatarUrl ?? undefined,
          bannerUrl: finalBannerUrl ?? undefined,
          nickname: nickname.trim(),
        });
      } catch (profileErr) {
        console.warn("[OnboardingScreen] Falha ao sincronizar profile Postgres:", profileErr);
      }

      // Atualiza store imediatamente
      useProfileStore.getState().setDisplayName(nickname.trim());
      useProfileStore.getState().setNickname(nickname.trim());
      if (finalAvatarUrl) {
        useProfileStore.getState().setAvatarUrl(finalAvatarUrl);
        useProfileStore.getState().setAppwriteAvatarUrl(finalAvatarUrl);
      }
      if (finalBannerUrl) {
        useProfileStore.getState().setBannerUrl(finalBannerUrl);
        useProfileStore.getState().setAppwriteBannerUrl(finalBannerUrl);
      }
      await useProfileStore.getState().loadProfile();

      markOnboardingCompleted(myUserId ?? undefined);
      useOnboardingStore.getState().setCompleted(true);
    } catch {
      setError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [nickname, myUserId, avatarFile, avatarPreview, bannerFile, bannerPreview, echoApi]);

  const handleAccountReset = useCallback(async () => {
    if (window.confirm("Deseja apagar os dados da sua conta e recomeçar o onboarding do zero?")) {
      await triggerFullAccountReset(echoApi);
    }
  }, [echoApi]);

  if (onboardingDone) {
    return null;
  }

  const effectiveHandle = myUserId ? myUserId.replace(/^@/, "").split(":")[0] : "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0b0e14] p-4 font-ui relative overflow-hidden select-none">
      {/* Brilho sutil de fundo Echo Teal Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-[#0FB9A8]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Container Principal seguindo Padrão Guild Modal (GEMINI.md Seção 4) */}
      <div className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 p-0 gap-0 relative z-10 flex flex-col">
        {/* Cabeçalho Superior Fixo */}
        <div className="relative p-6 pb-4 border-b border-white/[0.06] flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20 shrink-0">
              {step === "welcome" ? (
                <Sparkle size={20} weight="bold" />
              ) : (
                <User size={20} weight="bold" />
              )}
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-txt">
                {step === "welcome" ? "Bem-vindo ao Echo" : "Configurar seu perfil"}
              </h1>
              <p className="text-xs text-mut/80 mt-0.5">
                {step === "welcome"
                  ? "Seu novo espaço seguro para conversar e reunir comunidades."
                  : "Escolha sua foto e como você vai aparecer para os outros."}
              </p>
            </div>
          </div>
        </div>

        {/* Conteúdo Dinâmico por Etapa */}
        <div className="p-6 space-y-5">
          {step === "welcome" && (
            <div className="space-y-4">
              <p className="text-txt/90 text-sm leading-relaxed">
                O Echo combina a ergonomia fluida e moderna com a segurança do protocolo aberto Matrix.
                Converse em tempo real, compartilhe mídias e crie guildas personalizadas.
              </p>

              <div className="grid grid-cols-1 gap-2.5 pt-2">
                <div className="flex items-center gap-3 text-sm text-mut bg-white/[0.03] p-3.5 rounded-xl border border-white/[0.06]">
                  <ShieldCheck size={20} weight="bold" className="text-acc shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-txt">Criptografia de ponta a ponta</p>
                    <p className="text-[11px] text-mut/70">Suas conversas e dados protegidos por padrão.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-mut bg-white/[0.03] p-3.5 rounded-xl border border-white/[0.06]">
                  <Globe size={20} weight="bold" className="text-acc shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-txt">Protocolo Descentralizado</p>
                    <p className="text-[11px] text-mut/70">Comunicação aberta, sem servidores monopolistas.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "profile" && (
            <div className="space-y-5">
              {/* Hero Preview Interativo (Banner + Avatar Sobreposto - Padrão Guild Modal) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-mut/80 px-0.5">
                  <span>Prévia do Perfil</span>
                  <span className="text-[10px] font-normal lowercase tracking-normal text-mut/50">
                    Clique na foto ou banner para alterar
                  </span>
                </div>

                <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0b0e14] shadow-inner group/hero">
                  {/* Área do Banner (16:9) */}
                  <div
                    onClick={() => bannerInputRef.current?.click()}
                    className="relative h-32 w-full bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950 cursor-pointer overflow-hidden group/banner flex items-center justify-center transition-all"
                    title="Clique para adicionar ou trocar banner"
                  >
                    {bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="Banner do perfil"
                        className="w-full h-full object-cover group-hover/banner:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-mut/60 gap-1.5 transition-colors group-hover/banner:text-txt">
                        <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-sm group-hover/banner:bg-white/[0.08] group-hover/banner:border-acc/40 transition-all">
                          <Camera size={18} className="group-hover/banner:text-acc transition-colors" />
                        </div>
                        <span className="text-[11px] font-medium">Adicionar banner (16:9)</span>
                      </div>
                    )}

                    {/* Overlay do Banner no Hover */}
                    {bannerPreview && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/banner:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                        <span className="px-3 py-1.5 rounded-xl bg-black/60 text-xs font-medium text-white backdrop-blur-md flex items-center gap-1.5 border border-white/10">
                          <Camera size={14} /> Trocar banner
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBannerFile(null);
                            setBannerPreview(null);
                          }}
                          className="cursor-pointer p-1.5 rounded-xl bg-red-500/20 text-red-300 hover:bg-red-500/40 transition-colors"
                          title="Remover banner"
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Avatar Sobreposto (-mt-9) com Iniciais Dinâmicas em Tempo Real */}
                  <div className="px-5 pb-3.5 -mt-9 flex items-end justify-between relative z-10">
                    <div
                      onClick={() => avatarInputRef.current?.click()}
                      className="relative h-20 w-20 rounded-2xl border-4 border-[#12161f] bg-[#161b26] cursor-pointer shadow-xl overflow-hidden group/avatar flex items-center justify-center shrink-0"
                      title="Clique para escolher e recortar sua foto"
                    >
                      {avatarPreview ? (
                        <img
                          src={avatarPreview}
                          alt="Foto do perfil"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-acc/20 to-acc/5 text-acc">
                          <span className="font-display text-2xl font-bold tracking-wider">
                            {getInitials(nickname)}
                          </span>
                        </div>
                      )}

                      {/* Overlay do Avatar no Hover */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-1 text-white transition-opacity">
                        <Camera size={18} weight="bold" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">
                          {avatarPreview ? "Trocar" : "Foto"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right pb-1 max-w-[240px] truncate">
                      <p className="font-semibold text-sm text-txt truncate">
                        {nickname.trim() || "Seu Nome"}
                      </p>
                      <p className="text-[11px] text-mut/70 truncate flex items-center justify-end gap-1">
                        @{effectiveHandle || "membro"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Ações Auxiliares Visíveis de Foto */}
                <div className="flex items-center justify-center gap-3 pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-acc hover:underline flex items-center gap-1.5 cursor-pointer font-medium"
                  >
                    <Camera size={14} weight="bold" />
                    <span>{avatarPreview ? "Alterar minha foto" : "Escolher foto"}</span>
                  </button>
                  {rawAvatarUrl && (
                    <>
                      <span className="text-mut/40">·</span>
                      <button
                        type="button"
                        onClick={() => setAvatarEditorOpen(true)}
                        className="text-mut hover:text-txt hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        <Crop size={14} weight="bold" />
                        <span>Ajustar recorte</span>
                      </button>
                    </>
                  )}
                  {avatarPreview && (
                    <>
                      <span className="text-mut/40">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarFile(null);
                          setAvatarPreview(null);
                        }}
                        className="text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Trash size={14} weight="bold" />
                        <span>Remover</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Inputs de arquivo ocultos acionados pelo clique no preview */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelected}
                  className="hidden"
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerSelected}
                  className="hidden"
                />
              </div>

              {/* Campo Nome de Exibição */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="nickname" className="text-xs font-semibold uppercase tracking-wider text-mut">
                    Nome de exibição
                  </Label>
                  <span className="text-[11px] text-mut font-mono">{nickname.length}/64</span>
                </div>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading && nickname.trim()) {
                      void handleSubmit();
                    }
                  }}
                  placeholder="Seu nome ou apelido"
                  maxLength={64}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
                />
                <p className="text-[11px] text-mut/70">
                  Como você será visto por outros membros nos canais, amigos e conversas.
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 font-medium animate-in fade-in-50 duration-150 text-center">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé de Ações seguindo Padrão Guild Modal */}
        <div className="p-6 pt-2 pb-6 border-t border-white/[0.06] flex items-center gap-3">
          {step === "welcome" ? (
            <>
              <button
                type="button"
                onClick={handleAccountReset}
                className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] text-mut hover:text-txt hover:bg-white/[0.08] active:scale-95 transition-all py-2.5 text-xs font-medium text-center"
                title="Apaga os dados locais e reinicia a sessão"
              >
                Redefinir conta
              </button>
              <button
                type="button"
                onClick={() => setStep("profile")}
                className="cursor-pointer flex-1 rounded-xl bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center justify-center gap-2 py-2.5 text-sm"
              >
                <span>Avançar</span>
                <ArrowRight size={16} weight="bold" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("welcome")}
                disabled={isLoading}
                className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] text-txt hover:bg-white/[0.08] active:scale-95 transition-all py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={16} weight="bold" />
                <span>Voltar</span>
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isLoading || !nickname.trim()}
                className="cursor-pointer flex-1 rounded-xl bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all flex items-center justify-center gap-2 py-2.5 text-sm disabled:opacity-50 disabled:pointer-events-none"
              >
                {isLoading ? "Salvando perfil…" : "Concluir e entrar"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Editor Modal de Avatar (Alta Resolução 512x512) */}
      <ImageEditor
        open={avatarEditorOpen}
        imageSrc={rawAvatarUrl}
        title="Recortar foto de perfil"
        aspect={1}
        outputWidth={512}
        outputHeight={512}
        onConfirm={handleAvatarConfirm}
        onClose={() => setAvatarEditorOpen(false)}
        onSelectNewImage={(newFile) => {
          const url = URL.createObjectURL(newFile);
          if (rawAvatarUrl) URL.revokeObjectURL(rawAvatarUrl);
          setRawAvatarUrl(url);
        }}
      />

      {/* Editor Modal de Banner (Alta Resolução 1280x720) */}
      <ImageEditor
        open={bannerEditorOpen}
        imageSrc={rawBannerUrl}
        title="Recortar banner de perfil"
        aspect={16 / 9}
        outputWidth={1280}
        outputHeight={720}
        onConfirm={handleBannerConfirm}
        onClose={() => setBannerEditorOpen(false)}
        onSelectNewImage={(newFile) => {
          const url = URL.createObjectURL(newFile);
          if (rawBannerUrl) URL.revokeObjectURL(rawBannerUrl);
          setRawBannerUrl(url);
        }}
      />
    </main>
  );
}
