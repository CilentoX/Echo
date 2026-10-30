"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, X, Users, Hash, ShieldCheck, Calendar } from "@phosphor-icons/react";
import { useGuildProfileStore } from "@/stores/guildProfileStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useGuildProfileEditor } from "../hooks/useGuildProfileEditor";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit";
import { matrixService } from "@/lib/matrix/instance";

interface GuildProfileTabProps {
  guildId: string;
  guildName: string;
  guildAvatarUrl: string | null;
  guildDescription: string | null;
  onClose: () => void;
}

export function GuildProfileTab({
  guildId,
  guildName,
  guildAvatarUrl,
  guildDescription,
  onClose,
}: GuildProfileTabProps) {
  const { setGuildProfile } = useGuildProfileStore();
  const [isLoading, setIsLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    name: string;
    description: string | null;
    avatarUrl: string | null;
    bannerUrl: string | null;
    createdBy: string | null;
  } | null>(null);

  const initials = useMemo(() => {
    return guildName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "G";
  }, [guildName]);

  // Carrega o perfil da guilda do Appwrite
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await matrixService.getGuildProfile(guildId);
        if (!cancelled) {
          setProfileData(profile ?? {
            name: guildName,
            description: guildDescription,
            avatarUrl: guildAvatarUrl,
            bannerUrl: null,
            createdBy: null,
          });
          setGuildProfile({
            name: guildName,
            description: guildDescription,
            avatarUrl: guildAvatarUrl,
            bannerUrl: null,
          });
        }
      } catch {
        if (!cancelled) {
          setProfileData({
            name: guildName,
            description: guildDescription,
            avatarUrl: guildAvatarUrl,
            bannerUrl: null,
            createdBy: null,
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [guildId, guildName, guildAvatarUrl, guildDescription, setGuildProfile, matrixService]);

  const {
    isEditing,
    editName,
    editDescription,
    editAvatarUrl,
    editBannerUrl,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    setEditName,
    setEditDescription,
    setEditAvatarUrl,
    setEditBannerUrl,
    saveChanges,
  } = useGuildProfileEditor(guildId, profileData ?? {
    name: guildName,
    description: guildDescription,
    avatarUrl: guildAvatarUrl,
    bannerUrl: null,
  });

  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const userId = matrixService.getUserId();
  const isOwner = userId ? profileData?.createdBy === userId : false;

  // URLs atuais para exibição (edit state tem prioridade)
  const currentAvatarUrl = editAvatarUrl ?? profileData?.avatarUrl ?? guildAvatarUrl;
  const currentBannerUrl = editBannerUrl ?? profileData?.bannerUrl ?? null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-mut">
        <div className="flex h-8 w-8 rounded-full border-4 border-acc border-t-transparent rounded-full animate-spin" />
        <p>Carregando perfil da guilda…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      {/* Banner Section */}
      <div className="relative w-full">
        <ImageUploadWithEdit
          value={currentBannerUrl}
          label=""
          placeholder="Banner da guilda (PNG/JPG, até 5 MB)"
          onChange={async (file: File) => {
            try {
              setBannerError(null);
              const response = await fetch(
                `${import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1"}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET_ID ?? "profile-images"}/files`,
                {
                  method: "POST",
                  headers: {
                    "X-Appwrite-Project": import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "6ad904ff0035aa68066c",
                    "X-Appwrite-Key": import.meta.env.VITE_APPWRITE_API_KEY,
                  },
                  body: (() => {
                    const fd = new FormData();
                    fd.append("fileId", crypto.randomUUID());
                    fd.append("file", file);
                    return fd;
                  })(),
                }
              );
              if (!response.ok) throw new Error("Upload falhou");
              const data = await response.json();
              const appwriteUrl = `${import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1"}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET_ID ?? "profile-images"}/files/${data.\$id}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "6ad904ff0035aa68066c"}`;
              setEditBannerUrl(appwriteUrl);
            } catch (err) {
              const msg = err instanceof Error ? err.message : "Falha no upload do banner";
              setBannerError(msg);
            }
          }}
          onRemove={() => setEditBannerUrl(null)}
          type="banner"
          preset="medium"
          previewHeight="h-40"
          editTitle="Editar banner da guilda"
          editable={isOwner && isEditing && !isSaving}
          maxSizeMB={5}
          appwriteUrl={currentBannerUrl}
          initials={initials}
          uploadError={bannerError}
        />
      </div>

      {/* Guild Header - Avatar + Info */}
      <div className="relative -mt-10 flex flex-col items-center gap-4 px-6">
        <div className="relative z-10">
          <ImageUploadWithEdit
            value={currentAvatarUrl}
            label=""
            placeholder="Foto da guilda (PNG/JPG, até 2 MB)"
            onChange={async (file: File) => {
              try {
                setAvatarError(null);
                const response = await fetch(
                  `${import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1"}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET_ID ?? "profile-images"}/files`,
                  {
                    method: "POST",
                    headers: {
                      "X-Appwrite-Project": import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "6ad904ff0035aa68066c",
                      "X-Appwrite-Key": import.meta.env.VITE_APPWRITE_API_KEY,
                    },
                    body: (() => {
                      const fd = new FormData();
                      fd.append("fileId", crypto.randomUUID());
                      fd.append("file", file);
                      return fd;
                    })(),
                  }
                );
                if (!response.ok) throw new Error("Upload falhou");
                const data = await response.json();
                const appwriteUrl = `${import.meta.env.VITE_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1"}/storage/buckets/${import.meta.env.VITE_APPWRITE_BUCKET_ID ?? "profile-images"}/files/${data.\$id}/view?project=${import.meta.env.VITE_APPWRITE_PROJECT_ID ?? "6ad904ff0035aa68066c"}`;
                setEditAvatarUrl(appwriteUrl);
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Falha no upload da foto";
                setAvatarError(msg);
              }
            }}
            onRemove={() => setEditAvatarUrl(null)}
            type="avatar"
            preset="large"
            previewHeight="h-24 rounded-full"
            previewW="w-24"
            editTitle="Editar foto da guilda"
            editable={isOwner && isEditing && !isSaving}
            maxSizeMB={2}
            appwriteUrl={currentAvatarUrl}
            initials={initials}
            uploadError={avatarError}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center w-full">
          <h1 className="font-display text-2xl font-bold text-txt truncate max-w-xs">
            {editName ?? guildName}
          </h1>
          <div className="flex items-center gap-2 text-sm text-mut">
            <span className="h-2 w-2 rounded-full bg-online" aria-hidden="true" />
            <span>Ativo</span>
          </div>
        </div>

        {/* Edit Button */}
        {isOwner && !isEditing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={startEditing}
            className="mt-2 gap-2 px-4 py-2"
            aria-label="Editar guilda"
          >
            <Pencil size={14} />
            Editar guilda
          </Button>
        )}
      </div>

      {/* Description Section */}
      {profileData?.description && !isEditing && (
        <div className="px-6 max-w-2xl mx-auto text-center">
          <p className="text-txt text-base leading-relaxed">{profileData.description}</p>
        </div>
      )}

      <Separator className="mx-6" />

      {/* Edit Form */}
      {isEditing && (
        <form
          className="flex flex-col gap-6 px-6 max-w-2xl mx-auto w-full"
          onSubmit={(e) => {
            e.preventDefault();
            saveChanges();
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-txt">Editar guilda</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={cancelEditing}
              disabled={isSaving}
              aria-label="Cancelar edição"
            >
              <X size={16} />
            </Button>
          </div>

          <div className="space-y-5">
            {/* Nome da guilda */}
            <div className="space-y-1.5">
              <Label htmlFor="guildName" className="text-sm font-medium text-txt">
                Nome da guilda
              </Label>
              <div className="relative">
                <Hash size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" aria-hidden="true" />
                <Input
                  id="guildName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nome da guilda"
                  maxLength={64}
                  required
                  disabled={isSaving}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label htmlFor="guildDescription" className="text-sm font-medium text-txt">
                Descrição
              </Label>
              <Textarea
                id="guildDescription"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descreva sua guilda…"
                maxLength={500}
                rows={4}
                disabled={isSaving}
                className="resize-none"
              />
              <p className="text-xs text-mut text-right">{editDescription.length}/500</p>
            </div>

            <Separator />

            {/* Dica: avatar e banner são editados clicando nas imagens acima */}
            <p className="text-xs text-mut flex items-center gap-2">
              <Users size={14} aria-hidden="true" />
              Para alterar a foto ou o banner, clique nas imagens acima.
            </p>

            {error && (
              <div className="rounded-lg bg-err/10 p-4 text-sm text-err border border-err/20">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={cancelEditing}
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl font-medium transition-all hover:bg-surf2"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="flex-1 py-3 rounded-xl font-semibold bg-acc text-bg hover:bg-acc-press active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSaving ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Salvando…
                  </span>
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* View Mode - Additional Info Cards */}
      {!isEditing && profileData && (
        <div className="px-6 max-w-2xl mx-auto w-full space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<Users size={18} />}
              label="Nome da guilda"
              value={profileData.name}
            />
            <InfoCard
              icon={<Hash size={18} />}
              label="ID da guilda"
              value={guildId}
              copyable
            />
            <InfoCard
              icon={<Calendar size={18} />}
              label="Criado por"
              value={profileData.createdBy ? profileData.createdBy.split(":")[0].replace("@", "") : "—"}
            />
            {profileData.createdBy && (
              <InfoCard
                icon={<ShieldCheck size={18} />}
                label="Proprietário"
                value={isOwner ? "Você" : "Outro usuário"}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  copyable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
}) {
  return (
    <Card className="border-bd bg-surf hover:bg-surf2/50 transition-colors">
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-lg bg-acc/10 text-acc" aria-hidden="true">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-mut">{label}</p>
            <p className="text-txt truncate mt-0.5 font-medium">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
