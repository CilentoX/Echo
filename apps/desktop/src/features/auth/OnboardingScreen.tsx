import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle } from "lucide-react";
import { ArrowRight, User, Server as LucideServer } from "lucide-react";
import { ShieldCheck, Globe } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { markOnboardingCompleted } from "@/lib/onboarding";
import { useUiStore } from "@/stores/uiStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "@/components/onboarding/AvatarUpload";

/**
 * Onboarding de primeiro acesso com 3 etapas (estilo Discord):
 * 1. Welcome — boas-vindas ao Echo
 * 2. Servidor — escolher ou criar servidor
 * 3. Perfil — nickname e avatar
 *
 * Após salvar, a flag é persistida e não reapresenta.
 */
type Step = "welcome" | "server" | "profile";

export default function OnboardingScreen({
  onComplete,
}: {
  /** Chamado quando o onboarding é concluído com sucesso. */
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [nickname, setNickname] = useState("");
  const [serverName, setServerName] = useState("Meu servidor");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
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

  const handleSubmit = useCallback(async () => {
    if (!nickname.trim()) return;
    if (!myUserId) return;

    setIsLoading(true);
    setError(null);

    try {
      await matrixService.setDisplayName(nickname.trim());

      if (avatarFile) {
        const uploaded = await matrixService.uploadMedia(avatarFile);
        await matrixService.setAvatarUrl(uploaded);
      }

      markOnboardingCompleted(myUserId ?? undefined);
      useOnboardingStore.getState().setCompleted(true);
    } catch {
      setError("Não foi possível salvar o perfil. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [nickname, avatarFile, myUserId]);

  if (onboardingDone) {
    return null;
  }

  const canAdvance = step === "welcome" || (step === "server" && serverName.trim());

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui">
      <Card className="w-full max-w-md bg-bg border border-bd shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3 pt-8">
          {step === "welcome" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc text-bg">
                <CheckCircle size={32} />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-txt">Bem-vindo ao Echo</CardTitle>
              <CardDescription className="text-center text-mut">
                Seu novo espaço para conversar com a comunidade.
              </CardDescription>
            </>
          )}
          {step === "server" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc text-bg">
                <LucideServer size={32} />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-txt">Seu servidor</CardTitle>
              <CardDescription className="text-center text-mut">
                Dê um nome ao seu servidor. Você pode alterar depois.
              </CardDescription>
            </>
          )}
          {step === "profile" && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc text-bg">
                <User size={32} />
              </div>
              <CardTitle className="text-2xl font-display font-bold text-txt">Seu perfil</CardTitle>
              <CardDescription className="text-center text-mut">
                Escolha como você vai aparecer para os outros.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-6 p-8">
          {step === "welcome" && (
            <div className="flex flex-col items-center gap-6 text-center">
              <p className="text-txt">
                Conecte-se à sua rede Matrix e comece a conversar em
                tempo real, com privacidade e controle total.
              </p>
              <div className="flex items-center gap-4 text-sm text-mut">
                <ShieldCheck size={14} className="text-acc" />
                <span>Criptografia de ponta a ponta</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-mut">
                <Globe size={14} className="text-acc" />
                <span>Federado com a rede Matrix</span>
              </div>
            </div>
          )}
          {step === "server" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="server-name">Nome do servidor</Label>
                <Input
                  id="server-name"
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder="Meu servidor"
                  maxLength={64}
                />
              </div>
              <p className="text-xs text-mut">
                Este nome identifica seu servidor na rede.
              </p>
            </div>
          )}
          {step === "profile" && (
            <form
              className="flex flex-col gap-6 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="nickname">Nome de exibição</Label>
                <Input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={64}
                  required
                />
                <p className="text-xs text-mut">
                  Esse é o nome que aparecerá para outros usuários.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="avatar">Foto do perfil</Label>
                <AvatarUpload
                  src={avatarSrc}
                  onChange={(file) => {
                    setAvatarFile(file);
                    setAvatarSrc(URL.createObjectURL(file));
                  }}
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="rounded-lg bg-err/10 p-4 text-sm text-err border border-err/20">
                  {error}
                </div>
              )}
              <Button
                type="submit"
                className="w-full py-3.5 bg-acc text-bg font-semibold rounded-xl hover:bg-acc-press transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                disabled={isLoading || !nickname.trim()}
              >
                {isLoading ? "Salvando…" : "Concluir e entrar"}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between px-8 pb-8">
          {step !== "profile" && (
            <Button
              type="button"
              disabled={!canAdvance || isLoading}
              onClick={() => {
                if (step === "welcome") setStep("server");
                else if (step === "server") setStep("profile");
              }}
              className="bg-acc text-bg font-semibold rounded-xl hover:bg-acc-press transition-colors disabled:opacity-50 disabled:pointer-events-none px-6"
            >
              {step === "server" ? "Criar servidor" : "Avançar"} <ArrowRight size={18} />
            </Button>
          )}
          {step !== "welcome" && (
            <button
              type="button"
              onClick={() => {
                if (step === "server") setStep("welcome");
                else if (step === "profile") setStep("server");
              }}
              className="text-sm text-mut hover:text-txt underline underline-offset-4 transition-colors"
            >
              ← Voltar
            </button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}
