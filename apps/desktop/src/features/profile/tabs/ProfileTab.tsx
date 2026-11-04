"use client";

import { useEffect, useCallback, useMemo, useState } from "react";
import {
  Pencil,
  X,
  Camera,
  User,
  At,
  Hash,
  Calendar,
  Link as LinkIcon,
  Trash,
  Plus,
  ArrowSquareOut,
  ShieldCheck,
} from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useProfileEditor } from "../hooks/useProfileEditor";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit";
import { useEchoApi } from "@/lib/api/echoApi";

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
    avatarUrl,
    bannerUrl,
    appwriteAvatarUrl,
    appwriteBannerUrl,
    links,
    setAppwriteAvatarUrl,
    setAppwriteBannerUrl,
  } = useProfileStore();

  const echoApi = useEchoApi();

  const uploadAvatar = async (file: File): Promise<string> => {
    return echoApi.uploadChatMedia(file);
  };

  const uploadBanner = async (file: File): Promise<string> => {
    return echoApi.uploadChatMedia(file);
  };

  const effectiveDisplayName = displayName || nickname || (username ? username.replace(/^@/, "").split(":")[0] : "");
  const effectiveHandle = nickname || (username ? username.replace(/^@/, "").split(":")[0] : "");

  const initials = useMemo(() => {
    const name = effectiveDisplayName || "Usuário";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [effectiveDisplayName]);

  const {
    isEditing,
    editDisplayName,
    editNickname,
    editBio,
    editAvatarUrl,
    editBannerUrl,
    editLinks,
    isSaving,
    error,
    startEditing,
    cancelEditing,
    setEditDisplayName,
    setEditNickname,
    setEditBio,
    setEditAvatarUrl,
    setEditBannerUrl,
    addEditLink,
    removeEditLink,
    saveChanges,
  } = useProfileEditor();

  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
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

  const handleAvatarChange = useCallback(
    async (file: File) => {
      try {
        setAvatarError(null);
        const appwriteUrl = await uploadAvatar(file);
        setEditAvatarUrl(appwriteUrl);
        setAppwriteAvatarUrl(appwriteUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha no upload do avatar";
        setAvatarError(msg);
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
        setBannerError(null);
        const appwriteUrl = await uploadBanner(file);
        setEditBannerUrl(appwriteUrl);
        setAppwriteBannerUrl(appwriteUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha no upload do banner";
        setBannerError(msg);
      }
    },
    [uploadBanner, setEditBannerUrl, setAppwriteBannerUrl]
  );

  const handleBannerRemove = useCallback(() => {
    setEditBannerUrl(null);
    setAppwriteBannerUrl(null);
  }, [setEditBannerUrl, setAppwriteBannerUrl]);

  const isOwnProfile = true;

  // URLs atuais para exibição (edit state tem prioridade)
  const currentAvatarUrl = editAvatarUrl ?? appwriteAvatarUrl ?? avatarUrl;
  const rawBannerUrl = editBannerUrl ?? appwriteBannerUrl ?? bannerUrl;
  // Banner nunca deve herdar ou espelhar a foto de perfil por acidente
  const currentBannerUrl = rawBannerUrl === currentAvatarUrl && !editBannerUrl ? null : rawBannerUrl;

  return (
    <div className="flex flex-col gap-6" onKeyDown={handleKeyDown}>
      {/* Banner Section */}
      <div className="relative">
        <ImageUploadWithEdit
          value={currentBannerUrl}
          label=""
          placeholder="Banner do perfil (PNG/JPG, até 5 MB)"
          onChange={handleBannerChange}
          onRemove={handleBannerRemove}
          type="banner"
          preset="medium"
          previewHeight="h-40"
          editTitle="Editar banner do perfil"
          editable={isEditing && !isSaving}
          maxSizeMB={5}
          appwriteUrl={currentBannerUrl}
          uploadError={bannerError}
        />
      </div>

      {/* Profile Header - Avatar + Info */}
      <div className="relative -mt-10 flex flex-col items-center gap-4 px-6">
        <div className="relative z-10">
          <ImageUploadWithEdit
            value={currentAvatarUrl}
            label=""
            placeholder="Foto do perfil (PNG/JPG, até 2 MB)"
            onChange={handleAvatarChange}
            onRemove={handleAvatarRemove}
            type="avatar"
            preset="large"
            previewHeight="h-24 rounded-full"
            previewW="w-24"
            editTitle="Editar foto do perfil"
            editable={isEditing && !isSaving}
            maxSizeMB={2}
            appwriteUrl={currentAvatarUrl}
            initials={initials}
            uploadError={avatarError}
          />
        </div>

        <div className="flex flex-col items-center gap-1 text-center w-full">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-txt truncate max-w-xs">
              {effectiveDisplayName || "Usuário"}
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
            <span className="font-mono">@{effectiveHandle}</span>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="displayName" className="text-sm font-medium text-txt">
                  Nome de exibição
                </Label>
                <span className="text-[11px] text-acc font-medium">Sincroniza com a rede Matrix</span>
              </div>
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
              <p className="text-xs text-mut/80">
                Como você é visto no chat, amigos e salas. Ao salvar, é sincronizado imediatamente no Matrix.
              </p>
            </div>

            {/* Nickname / Handle */}
            <div className="space-y-1.5">
              <Label htmlFor="nickname" className="text-sm font-medium text-txt">
                Apelido (@handle)
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
              <p className="text-xs text-mut/80">Identificador único usado para menções e pedidos de amizade.</p>
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

            {/* Social Links Editing */}
            <div className="space-y-3">
              <Label className="text-sm font-medium text-txt flex items-center gap-2">
                <LinkIcon size={16} className="text-acc" />
                Links e Redes Sociais
              </Label>
              {editLinks.length > 0 && (
                <div className="space-y-2">
                  {editLinks.map((link, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-surf p-2.5 rounded-lg border border-bd">
                      <span className="text-xs font-semibold text-txt px-2 py-1 bg-surf2 rounded border border-bd">
                        {link.label}
                      </span>
                      <span className="text-xs text-mut truncate flex-1 font-mono">{link.url}</span>
                      <button
                        type="button"
                        onClick={() => removeEditLink(idx)}
                        disabled={isSaving}
                        className="cursor-pointer p-1.5 text-mut hover:text-err hover:bg-surf2 rounded transition-colors"
                        title="Remover link"
                        aria-label={`Remover ${link.label}`}
                      >
                        <Trash size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Nome (ex: GitHub, Site)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  disabled={isSaving}
                  className="w-1/3 text-xs"
                />
                <Input
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  disabled={isSaving}
                  className="flex-1 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSaving || !newLabel.trim() || !newUrl.trim()}
                  onClick={() => {
                    if (newLabel.trim() && newUrl.trim()) {
                      addEditLink(newLabel.trim(), newUrl.trim());
                      setNewLabel("");
                      setNewUrl("");
                    }
                  }}
                  className="cursor-pointer text-xs shrink-0"
                >
                  <Plus size={14} className="mr-1" /> Adicionar
                </Button>
              </div>
            </div>

            <Separator />

            {/* Dica: avatar e banner são editados clicando nas imagens acima */}
            <p className="text-xs text-mut flex items-center gap-2">
              <Camera size={14} aria-hidden="true" />
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
      {!isEditing && (
        <div className="px-6 max-w-2xl mx-auto w-full space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoCard
              icon={<User size={18} />}
              label="Nome de exibição"
              value={effectiveDisplayName}
            />
            <InfoCard
              icon={<At size={18} />}
              label="Apelido"
              value={`@${effectiveHandle}`}
            />
            <InfoCard
              icon={<ShieldCheck size={18} />}
              label="Endereço Matrix"
              value={username || `@${effectiveHandle}:litteris.online`}
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

          {links && links.length > 0 && (
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-mut mb-2.5 flex items-center gap-1.5">
                <LinkIcon size={14} className="text-acc" />
                Links e Redes
              </p>
              <div className="flex flex-wrap gap-2">
                {links.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-bd bg-surf hover:bg-surf2 text-xs font-medium text-txt transition-colors group cursor-pointer"
                  >
                    <span className="font-semibold text-acc">{link.label}</span>
                    <ArrowSquareOut size={12} className="text-mut group-hover:text-txt transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}
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