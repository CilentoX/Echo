import * as React from "react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AvatarUpload } from "./AvatarUpload";

interface ProfileFormProps {
  nickname: string;
  setNickname: (value: string) => void;
  avatarSrc: string | null;
  onAvatarChange: (file: File) => void;
  isLoading: boolean;
  onSubmit?: (e: React.FormEvent) => void;
  disabled?: boolean;
}

export function ProfileForm({
  nickname,
  setNickname,
  avatarSrc,
  onAvatarChange,
  isLoading,
  onSubmit,
  disabled = false,
}: ProfileFormProps) {
  const [preview, setPreview] = useState<string | null>(avatarSrc);

  const handleAvatarFile = useCallback(
    (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem deve ter no máximo 2 MB.");
        return;
      }
      onAvatarChange(file);
      setPreview(URL.createObjectURL(file));
    },
    [onAvatarChange],
  );

  return (
    <form
      className="flex flex-col gap-6 w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.(e);
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
          disabled={disabled}
          required
        />
        <p className="text-xs text-muted-foreground">
          Esse é o nome que aparecerá para outros usuários.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="avatar">Foto do perfil</Label>
        <AvatarUpload
          src={preview ?? avatarSrc}
          onChange={handleAvatarFile}
          disabled={disabled}
        />
      </div>

      <Button
        type="submit"
        variant="default"
        className="w-full py-3"
        disabled={disabled || isLoading || !nickname.trim()}
      >
        {isLoading ? "Salvando…" : "Concluir e entrar"}
      </Button>
    </form>
  );
}
