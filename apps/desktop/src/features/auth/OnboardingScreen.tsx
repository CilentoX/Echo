import { useCallback, useEffect, useRef, useState } from "react";
import { User, Image as ImageIcon } from "lucide-react";
import { matrixService } from "@/lib/matrix/instance";
import { markOnboardingCompleted } from "@/lib/onboarding";
import { useUiStore } from "@/stores/uiStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { ProfileForm } from "@/components/onboarding/ProfileForm";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Onboarding de primeiro acesso: o usuário define nick e foto de perfil
 * antes de entrar no shell. Após salvar, a flag é persistida e não reapresenta.
 */
export default function OnboardingScreen({
  onComplete,
}: {
  /** Chamado quando o onboarding é concluído com sucesso. */
  onComplete: () => void;
}) {
  const [nickname, setNickname] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myUserId = useUiStore((s) => s.myUserId);
  const onboardingDone = useOnboardingStore((s) => s.completed);

  // Se já foi concluído, não renderizar (defensivo) — notifica o Gate via
  // effect (nunca durante o render) e apenas uma vez.
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
      // Define o nome de exibição no Matrix
      await matrixService.setDisplayName(nickname.trim());

      // Faz upload do avatar, se houver
      if (avatarFile) {
        const uploaded = await matrixService.uploadMedia(avatarFile);
        await matrixService.setAvatarUrl(uploaded);
      }

      // Marca onboarding como concluído (chaveado por userId); o effect
      // acima notifica o Gate.
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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg font-ui">
      <Card className="w-full max-w-md bg-bg border border-border shadow-lg">
        <CardHeader className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <User size={24} />
          </div>
          <CardTitle className="text-2xl">Bem-vindo ao Echo</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Antes de começar, configure seu perfil.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {error ? (
            <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <ProfileForm
            nickname={nickname}
            setNickname={setNickname}
            avatarSrc={avatarSrc}
            onAvatarChange={(file) => {
              setAvatarFile(file);
              setAvatarSrc(URL.createObjectURL(file));
            }}
            isLoading={isLoading}
            onSubmit={handleSubmit}
          />
        </CardContent>
        <CardFooter className="flex items-center gap-2 text-xs text-muted-foreground">
          <ImageIcon size={14} /> Seus dados ficam salvos no servidor Matrix da sua rede.
        </CardFooter>
      </Card>
    </main>
  );
}
