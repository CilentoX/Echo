"use client";

import { useEffect, useCallback, useMemo } from "react";
import { Pencil, X, Camera, Image, Trash, User, At, Hash, Calendar } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProfileEditor } from "../hooks/useProfileEditor";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit";
import { useImageUploadWithMatrix } from "@/lib/appwrite/useImageUploadWithMatrix";

interface ProfileTabProps {
  onClose: () => void;
}

export function ProfileTab({ onClose }: ProfileTabProps) {
  const {
    displayName,
    username,
    nickname,
    bio,
    role,
    joinedAt,
    appwriteAvatarUrl,
    appwriteBannerUrl,
    setAppwriteAvatarUrl,
    setAppwriteBannerUrl,
  } = useProfileStore();

  const { uploadAvatar, uploadBanner } = useImageUploadWithMatrix();

  const initials = useMemo(() => {
    const name = displayName || username;
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [displayName, username]);

  const {
    isEditing,
    editDisplayName,
    editNickname,
    editBio,
    editAvatarUrl,
    editBannerUrl,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    setEditDisplayName,
    setEditNickname,
    setEditBio,
    setEditAvatarUrl,
    setEditBannerUrl,
    saveChanges,
  } = useProfileEditor();

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

  const handleAvatarChange = useCallback(
    async (file: File) => {
      try {
        const appwriteUrl = await uploadAvatar(file);
        setEditAvatarUrl(appwriteUrl);
        setAppwriteAvatarUrl(appwriteUrl);
      } catch {
        // erro silencioso: upload falhou, mantém estado anterior
      }
    },
    [uploadAvatar, setEditAvatarUrl, setAppwriteAvatarUrl]
  );

  const handleAvatarRemove = useCallback(() => {
    setEditAvatarUrl(null);
    setAppwriteAvatarUrl(null);
  }, [setEditAvatarUrl, setAppwriteAvatarUrl]);

  const handleBannerChange = useCallback(
    async (file: File) => {
      try {
        const appwriteUrl = await uploadBanner(file);
        setEditBannerUrl(appwriteUrl);
        setAppwriteBannerUrl(appwriteUrl);
      } catch {
        // erro silencioso
      }
    },
    [uploadBanner, setEditBannerUrl, setAppwriteBannerUrl]
  );

  const handleBannerRemove = useCallback(() => {
    setEditBannerUrl(null);
    setAppwriteBannerUrl(null);
  }, [setEditBannerUrl, setAppwriteBannerUrl]);

  const isOwnProfile = true;

  return (
    <div className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      {/* Banner Section */}
      <div className="relative">
        {appwriteBannerUrl ? (
          <div className="relative h-40 w-full rounded-xl overflow-hidden">
            <img
              src={appwriteBannerUrl}
              alt="Banner do perfil"
              className="w-full h-full object-cover transition-opacity duration-300"
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => document.getElementById("banner-upload")?.click()}
                  className="text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
                >
                  <Camera size={20} className="mr-2" />
                  Alterar banner
                </Button>
              </div>
            )}
            {isEditing && editBannerUrl && (
              <button
                type="button"
                onClick={handleBannerRemove}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors backdrop-blur-sm"
                aria-label="Remover banner"
              >
                <Trash size={16} />
              </button>
            )}
            <input
              id="banner-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleBannerChange(file);
                e.target.value = "";
              }}
              disabled={isSaving}
            />
          </div>
        ) : isEditing ? (
          <div className="relative h-40 w-full rounded-xl border-2 border-dashed border-bd/50 flex items-center justify-center bg-surf/50 transition-colors hover:border-acc/50">
            <label
              htmlFor="banner-upload"
              className="cursor-pointer flex flex-col items-center gap-2 text-mut hover:text-txt transition-colors p-4"
            >
              <Image size={28} className="opacity-50" />
              <span className="font-medium">Adicionar banner</span>
              <input
                id="banner-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleBannerChange(file);
                  e.target.value = "";
                }}
                disabled={isSaving}
              />
            </label>
          </div>
        ) : null}
      </div>

      {/* Profile Header - Avatar + Info */}
      <div className="relative -mt-10 flex flex-col items-center gap-4 px-6">
        <div className="relative z-10">
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-surf2 flex items-center justify-center ring-4 ring-rail shadow-xl">
            {editAvatarUrl || appwriteAvatarUrl ? (
              <>
                <img
                  src={editAvatarUrl ?? appwriteAvatarUrl ?? undefined}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
                {isEditing && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-full">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById("avatar-upload")?.click()}
                      className="text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-3"
                    >
                      <Camera size={14} className="mr-1" />
                      Alterar
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <span className="font-display text-2xl font-bold text-txt">{initials}</span>
            )}
            {isEditing && (editAvatarUrl || appwriteAvatarUrl) && (
              <button
                type="button"
                onClick={handleAvatarRemove}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-err/90 hover:bg-err flex items-center justify-center text-white transition-colors shadow-lg"
                aria-label="Remover avatar"
              >
                <Trash size={12} />
              </button>
            )}
          </div>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAvatarChange(file);
              e.target.value = "";
            }}
            disabled={isSaving}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center w-full">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-txt truncate max-w-xs">
              {displayName || username}
            </h1>
            {role && (
              <span className="flex-shrink-0 px-2.5 py-0.5 text-xs font-medium rounded-full bg-acc/10 text-acc border border-acc/20 whitespace-nowrap">
                {role}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-mut">
            <span className="h-2 w-2 rounded-full bg-online" aria-hidden="true" />
            <span>Online</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">@{nickname || username.replace(/^@/, "")}</span>
          </div>
          {joinedAt && (
            <p className="text-xs text-mut flex items-center gap-1">
              <Calendar size={12} aria-hidden="true" />
              Membro desde {new Date(joinedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>

        {/* Edit Button */}
        {isOwnProfile && !isEditing && (
          <Button
            variant="secondary"
            size="sm"
            onClick={startEditing}
            className="mt-2 gap-2 px-4 py-2"
            aria-label="Editar perfil"
          >
            <Pencil size={14} />
            Editar perfil
          </Button>
        )}
      </div>

      {/* Bio Section */}
      {bio && !isEditing && (
        <div className="px-6 max-w-2xl mx-auto text-center">
          <p className="text-txt text-base leading-relaxed">{bio}</p>
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
            <h2 className="font-display text-lg font-semibold text-txt">Editar perfil</h2>
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
            {/* Display Name */}
            <div className="space-y-1.5">
              <Label htmlFor="displayName" className="text-sm font-medium text-txt">
                Nome de exibição
              </Label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" aria-hidden="true" />
                <Input
                  id="displayName"
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={64}
                  required
                  disabled={isSaving}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-1.5">
              <Label htmlFor="nickname" className="text-sm font-medium text-txt">
                Apelido
              </Label>
              <div className="relative">
                <At size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" aria-hidden="true" />
                <Input
                  id="nickname"
                  type="text"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  placeholder="Seu apelido"
                  maxLength={32}
                  disabled={isSaving}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-mut">Esse é o nome que aparecerá para outros usuários.</p>
            </div>

            {/* Bio */}
            <div className="space-y-1.5">
              <Label htmlFor="bio" className="text-sm font-medium text-txt">
                Sobre você
              </Label>
              <Textarea
                id="bio"
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Conte um pouco sobre você…"
                maxLength={500}
                rows={4}
                disabled={isSaving}
                className="resize-none"
              />
              <p className="text-xs text-mut text-right">{editBio.length}/500</p>
            </div>

            <Separator />

            {/* Avatar Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-txt flex items-center gap-2">
                <Camera size={16} className="text-mut" aria-hidden="true" />
                Foto do perfil
              </Label>
              <ImageUploadWithEdit
                value={editAvatarUrl}
                label=""
                placeholder="Foto do perfil (PNG/JPG, até 2 MB)"
                onChange={handleAvatarChange}
                onRemove={handleAvatarRemove}
                aspect={1}
                previewHeight="h-24"
                editTitle="Editar foto do perfil"
                disabled={isSaving}
                maxSizeMB={2}
                appwriteUrl={editAvatarUrl}
              />
            </div>

            {/* Banner Upload */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-txt flex items-center gap-2">
                <Image size={16} className="text-mut" aria-hidden="true" />
                Banner do perfil
              </Label>
              <ImageUploadWithEdit
                value={editBannerUrl}
                label=""
                placeholder="Banner do perfil (PNG/JPG, até 5 MB)"
                onChange={handleBannerChange}
                onRemove={handleBannerRemove}
                aspect={16 / 9}
                previewHeight="h-32"
                editTitle="Editar banner do perfil"
                disabled={isSaving}
                maxSizeMB={5}
                appwriteUrl={editBannerUrl}
              />
            </div>

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
      {!isEditing && (
        <div className="px-6 max-w-2xl mx-auto w-full space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<User size={18} />}
              label="Nome de exibição"
              value={displayName || username}
            />
            <InfoCard
              icon={<At size={18} />}
              label="Apelido"
              value={`@${nickname || username.replace(/^@/, "")}`}
            />
            {joinedAt && (
              <InfoCard
                icon={<Calendar size={18} />}
                label="Membro desde"
                value={new Date(joinedAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}
              />
            )}
            {role && (
              <InfoCard
                icon={<Hash size={18} />}
                label="Cargo"
                value={role}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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