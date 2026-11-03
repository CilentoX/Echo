import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowLeft, CheckCircle, User } from "@phosphor-icons/react";
import { ShieldCheck, Globe } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { markOnboardingCompleted, triggerFullAccountReset } from "@/lib/onboarding";
import { useEchoApi } from "@/lib/api/echoApi";
import { useUiStore } from "@/stores/uiStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/onboarding/AvatarUpload";

/**
 * Onboarding de primeiro acesso com 2 etapas:
 * 1. Welcome — boas-vindas ao Echo
 * 2. Perfil — nickname e avatar
 *
 * Após salvar, a flag é persistida e não reapresenta.
 */
type Step = "welcome" | "profile";

export default function OnboardingScreen({
  onComplete,
}: {
  /** Chamado quando o onboarding é concluído com sucesso. */
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Pré-preenche o nickname com o displayName atual do Matrix
  // (ex: Google SSO preenche "Lucas Cilento", usuário pode alterar)
  useEffect(() => {
    const loadCurrentDisplayName = async () => {
      if (!myUserId) return;
      try {
        const currentName = await matrixService.getDisplayName(myUserId);
        if (currentName && !nickname.trim()) {
          setNickname(currentName);
        }
      } catch {
        // ignore falha ao carregar displayName atual
      }
    };
    loadCurrentDisplayName();
  }, [myUserId]);

  const handleSubmit = useCallback(async () => {
    if (!nickname.trim()) return;
    if (!myUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      await matrixService.setDisplayName(nickname.trim());

      if (avatarUrl) {
        await matrixService.setAvatarUrl(avatarUrl);
        // Sincroniza avatar com o Profile API (PostgreSQL)
        try {
          await matrixService.patchGlobalProfile({ avatarUrl });
        } catch (profileErr) {
          console.warn("[OnboardingScreen] Falha ao sincronizar profile Postgres:", profileErr);
        }
      }

      markOnboardingCompleted(myUserId ?? undefined);
      useOnboardingStore.getState().setCompleted(true);
    } catch {
      setError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [nickname, avatarUrl, myUserId]);

  const echoApi = useEchoApi();

  const handleAccountReset = useCallback(async () => {
    if (window.confirm("Deseja apagar os dados da sua conta e recomeçar o onboarding do zero?")) {
      await triggerFullAccountReset(echoApi);
    }
  }, [echoApi]);

  if (onboardingDone) {
    return null;
  }

  const canAdvance = step === "welcome";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0D1017] p-4 font-ui relative overflow-hidden select-none">
      {/* Brilho sutil de fundo */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] bg-[#0FB9A8]/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-md bg-[#131722] border border-[#242B3D] shadow-[0_16px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(15,185,168,0.06)] rounded-2xl relative z-10">
        <CardHeader className="flex flex-col items-center gap-3 pt-8 pb-4">
          {step === "welcome" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0FB9A8]/15 border border-[#0FB9A8]/30 text-[#0FB9A8] shadow-[0_0_20px_rgba(15,185,168,0.2)]">
                <CheckCircle size={32} weight="fill" />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-[#E9EDF2]">Bem-vindo ao Echo</CardTitle>
              <CardDescription className="text-center text-[#94A3B8]">
                Seu novo espaço para conversar com a comunidade.
              </CardDescription>
            </>
          )}
          {step === "profile" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0FB9A8]/15 border border-[#0FB9A8]/30 text-[#0FB9A8] shadow-[0_0_20px_rgba(15,185,168,0.2)]">
                <User size={32} weight="fill" />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-[#E9EDF2]">Seu perfil</CardTitle>
              <CardDescription className="text-center text-[#94A3B8]">
                Escolha como você vai aparecer para os outros.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-6 px-8 py-4">
          {step === "welcome" && (
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-[#CBD5E1] text-sm leading-relaxed">
                Conecte-se à sua rede Matrix e converse em tempo real,
                com privacidade absoluta, chamadas de voz e controle total.
              </p>
              <div className="flex flex-col gap-3 w-full max-w-xs pt-2">
                <div className="flex items-center gap-3 text-sm text-[#94A3B8] bg-[#1A202E] p-3 rounded-xl border border-[#242B3D]/70">
                  <ShieldCheck size={18} weight="bold" className="text-[#0FB9A8] shrink-0" />
                  <span className="text-left text-xs">Criptografia de ponta a ponta</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-[#94A3B8] bg-[#1A202E] p-3 rounded-xl border border-[#242B3D]/70">
                  <Globe size={18} weight="bold" className="text-[#0FB9A8] shrink-0" />
                  <span className="text-left text-xs">Protocolo aberto e federado Matrix</span>
                </div>
              </div>
            </div>
          )}
          {step === "profile" && (
            <form
              className="flex flex-col gap-5 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="nickname" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                  Nome de exibição
                </Label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Seu nome ou apelido"
                  maxLength={64}
                  required
                  className="h-11 bg-[#1A202E] border-[#242B3D] text-[#E9EDF2] placeholder:text-[#64748B] focus-visible:border-[#0FB9A8] focus-visible:ring-1 focus-visible:ring-[#0FB9A8]/40 rounded-xl px-3.5"
                />
                <p className="text-[11px] text-[#64748B]">
                  Esse é o nome visível para os outros usuários nos canais e chats.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="avatar" className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8] text-center">
                  Foto do perfil
                </Label>
                <AvatarUpload
                  src={avatarUrl}
                  onChange={(url) => {
                    setAvatarUrl(url);
                  }}
                  disabled={isLoading}
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-500/10 p-3.5 text-xs text-red-400 border border-red-500/20 text-center">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 bg-[#0FB9A8] text-[#0D1017] font-bold rounded-xl hover:bg-[#14DAA6] transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none shadow-md cursor-pointer mt-2"
                disabled={isLoading || !nickname.trim()}
              >
                {isLoading ? "Salvando perfil…" : "Concluir e entrar"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-8 pt-2 pb-7">
          {step === "welcome" ? (
            <Button
              type="button"
              disabled={!canAdvance || isLoading}
              onClick={() => setStep("profile")}
              className="w-full h-11 bg-[#0FB9A8] text-[#0D1017] font-bold rounded-xl hover:bg-[#14DAA6] transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center justify-center gap-2"
            >
              Avançar <ArrowRight size={18} weight="bold" />
            </Button>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setStep("welcome")}
                className="text-xs text-[#94A3B8] hover:text-[#E9EDF2] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>

              <button
                type="button"
                onClick={handleAccountReset}
                className="text-[11px] text-red-400/80 hover:text-red-300 transition-colors cursor-pointer hover:underline"
                title="Apaga os dados da conta e recomeça o login"
              >
                Redefinir conta
              </button>
            </div>
          )}

          {step === "welcome" && (
            <button
              type="button"
              onClick={handleAccountReset}
              className="text-[11px] text-red-400/70 hover:text-red-300 transition-colors cursor-pointer hover:underline self-center"
              title="Apaga os dados da conta e recomeça o login"
            >
              Redefinir conta e recomeçar
            </button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
