import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Pencil, Link, ShieldCheck, Users, Gift, Plus, Robot } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";
import { ImageUploadWithCrop } from "@/components/media/ImageUploadWithCrop";
import { matrixService } from "@/lib/matrix/instance";
import { uploadImage } from "@/lib/appwrite/storage";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUiStore } from "@/stores/uiStore";

export interface ProfileProps {
  open: boolean;
  onClose: () => void;
}

export default function Profile({ open, onClose }: ProfileProps) {
  const {
    displayName,
    username,
    nickname,
    avatarUrl,
    bannerUrl,
    bio,
    role,
    joinedAt,
    links,
    setDisplayName,
    setNickname,
    setBio,
    setRole,
    setAvatarUrl,
    setBannerUrl,
    setLinks,
  } = useProfileStore();

  const myUserId = useUiStore((state) => state.myUserId ?? "");

  const [tab, setTab] = useState<"profile" | "badges" | "connections">("profile");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [draftNickname, setDraftNickname] = useState(nickname ?? "");
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [draftRole, setDraftRole] = useState(role ?? "");
  const [draftLinks, setDraftLinks] = useState([...links]);
  const [draftBannerUrl, setDraftBannerUrl] = useState(bannerUrl);

  const initials = useMemo(() => {
    const name = displayName || username;
    return name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?";
  }, [displayName, username]);

  const PROFILE_TABS: Array<[string, string]> = [
    ["profile", "Perfil"],
    ["badges", "Conquistas"],
    ["connections", "Ligações"],
  ];

  const handleSave = useCallback(async () => {
    setDisplayName(draftName);
    setNickname(draftNickname || null);
    setBio(draftBio || null);
    setRole(draftRole || null);
    setLinks(draftLinks);
    setBannerUrl(draftBannerUrl);

    // Salvar banner no Matrix via estado custom echo.user.banner
    if (myUserId) {
      try {
        await matrixService.setUserBanner(myUserId, draftBannerUrl);
      } catch {
        // falha silenciosa - o banner ainda é exibido localmente
      }
    }

    setEditing(false);
  }, [draftName, draftNickname, draftBio, draftRole, draftLinks, draftBannerUrl, setDisplayName, setNickname, setBio, setRole, setLinks, setBannerUrl, myUserId]);

  const handleAddLink = useCallback(() => {
    setDraftLinks([...draftLinks, { label: "", url: "" }]);
  }, [draftLinks, setDraftLinks]);

  const handleRemoveLink = useCallback((index: number) => {
    setDraftLinks(draftLinks.filter((_, i) => i !== index));
  }, [draftLinks, setDraftLinks]);

  const handleLinkChange = useCallback((index: number, field: "label" | "url", value: string) => {
    const next = [...draftLinks];
    next[index] = { ...next[index], [field]: value };
    setDraftLinks(next);
  }, [draftLinks, setDraftLinks]);

  const handleBannerChange = async (file: File) => {
    if (file.size === 0) {
      setDraftBannerUrl(null);
      return;
    }
    try {
      const uri = await uploadImage(file);
      setDraftBannerUrl(uri);
    } catch {
      setDraftBannerUrl(null);
    }
  };

  const handleAvatarChange = async (file: File) => {
    if (!file) return;
    try {
      const uri = await uploadImage(file);
      setAvatarUrl(uri);
    } catch {
      setAvatarUrl(null);
    }
  };

  const handleCancel = useCallback(() => {
    setDraftName(displayName);
    setDraftNickname(nickname ?? "");
    setDraftBio(bio ?? "");
    setDraftRole(role ?? "");
    setDraftLinks([...links]);
    setDraftBannerUrl(bannerUrl);
    setEditing(false);
  }, [displayName, nickname, bio, role, links, bannerUrl, setDraftName, setDraftNickname, setDraftBio, setDraftRole, setDraftLinks, setDraftBannerUrl]);

  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onKeyDown]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-[640px] p-0 flex flex-col h-[90vh]">
        {/* Banner */}
        <div className="relative w-full h-48 rounded-xl bg-surf2 border border-bd overflow-hidden group">
          {draftBannerUrl ? (
            <img
              src={draftBannerUrl}
              alt="Banner"
              className="w-full h-full object-cover"
            />
          ) : null}
          <ImageUploadWithCrop
            label=""
            value={draftBannerUrl}
            placeholder="Adicionar banner de perfil"
            onChange={handleBannerChange}
            aspect={16 / 9}
            previewHeight="h-48"
            cropTitle="Recortar banner de perfil"
          />
        </div>

        {/* Avatar sobreposto */}
        <div className="relative -mt-20 flex justify-center">
          <div
            className={`relative w-32 h-32 rounded-full flex items-center justify-center font-display font-bold text-txt shadow-xl border-8 border-bg ${
              avatarUrl ? "bg-bg" : "bg-acc"
            }`}
            style={
              avatarUrl
                ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : undefined
            }
          >
            {avatarUrl ? null : initials}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="avatar-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAvatarChange(file);
              }}
            />
            {editing && (
              <button
                type="button"
                aria-label="Alterar avatar"
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-xs text-bg bg-acc shadow-md hover:bg-acc-press transition-all active:scale-95"
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById("avatar-input")?.click();
                }}
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "profile" | "badges" | "connections")}>
            <TabsList className="flex w-full border-b border-bd bg-surf/50">
              {PROFILE_TABS.map(([tabKey, label]) => (
                <TabsTrigger
                  key={tabKey}
                  value={tabKey}
                  className={
                    tab === tabKey
                      ? "flex-1 py-3 text-sm font-semibold text-acc border-b-2 border-acc"
                      : "flex-1 py-3 text-sm font-medium text-mut hover:text-txt transition-colors"
                  }
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Perfil */}
            <TabsContent value="profile" className="p-0 pt-6">
              {/* Nome, usuário, status, cargo */}
              <div className="mt-4 text-center space-y-2">
                <p className="font-display text-2xl font-bold text-txt truncate">
                  {displayName || username}
                </p>
                <div className="flex items-center justify-center gap-2 text-sm text-mut">
                  <span>@{nickname || username}</span>
                  <span className="h-3 w-3 rounded-full bg-online" />
                  <span>Online</span>
                </div>
                {role && (
                  <p className="mt-2 text-xs text-acc bg-acc/10 px-3 py-1 rounded-full border border-acc/30 inline-block">
                    {role}
                  </p>
                )}
              </div>

              {editing ? (
                <div className="mt-6 space-y-4">
                  <div>
                    <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                      Nome de exibição
                    </Label>
                    <Input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full rounded-lg border border-bd bg-bg px-3 py-2 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/40"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                      Apelido (nickname)
                    </Label>
                    <Input
                      value={draftNickname}
                      onChange={(e) => setDraftNickname(e.target.value)}
                      placeholder="Seu apelido"
                      className="w-full rounded-lg border border-bd bg-bg px-3 py-2 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/40"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                      Cargo
                    </Label>
                    <Input
                      value={draftRole}
                      onChange={(e) => setDraftRole(e.target.value)}
                      placeholder="Seu cargo"
                      className="w-full rounded-lg border border-bd bg-bg px-3 py-2 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/40"
                    />
                  </div>
                  <div>
                    <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-2">
                      Biografia
                    </Label>
                    <Textarea
                      value={draftBio}
                      onChange={(e) => setDraftBio(e.target.value)}
                      rows={4}
                      placeholder="Conte um pouco sobre você…"
                      className="w-full border border-bd rounded-lg p-3 text-sm text-txt focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc/40 resize-none transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-1">
                        Biografia
                      </Label>
                      <p className="text-sm text-txt leading-relaxed">
                        {bio || "Sem biografia ainda."}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-1">
                        Apelido (nickname)
                      </Label>
                      <p className="text-sm text-txt">{nickname || "—"}</p>
                    </div>
                    <div>
                      <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-1">
                        Cargo
                      </Label>
                      <p className="text-sm text-txt">{role || "—"}</p>
                    </div>
                    <div>
                      <Label className="block text-xs font-semibold uppercase tracking-wider text-mut mb-1">
                        Entrou em
                      </Label>
                      <p className="text-sm text-txt">{joinedAt || "—"}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ligações sociais */}
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <Label className="block text-xs font-semibold uppercase tracking-wider text-mut">
                    Ligações sociais
                  </Label>
                  {editing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddLink}
                      className="text-xs text-acc hover:text-acc-press underline underline-offset-4 flex items-center gap-1"
                    >
                      <Plus size={14} />
                      <span>Adicionar ligação</span>
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {draftLinks.length > 0 ? (
                    draftLinks.map((link, i) => (
                      <div key={i} className="flex items-center gap-2 bg-bg border border-bd rounded-lg p-2.5">
                        {editing ? (
                          <>
                            <Input
                              value={link.label}
                              onChange={(e) => handleLinkChange(i, "label", e.target.value)}
                              placeholder="Nome da ligação"
                              className="flex-1 text-sm text-txt placeholder:text-mut bg-transparent border-none focus:ring-0 focus:border-acc"
                            />
                            <Input
                              value={link.url}
                              onChange={(e) => handleLinkChange(i, "url", e.target.value)}
                              placeholder="https://"
                              className="flex-1 text-sm text-txt placeholder:text-mut bg-transparent border-none focus:ring-0 focus:border-acc"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(i)}
                              className="cursor-pointer p-1.5 text-err hover:bg-err/10 rounded transition-colors active:scale-95"
                              aria-label="Remover ligação"
                            >
                              <X size={14} weight="bold" />
                            </button>
                          </>
                        ) : link.url && (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-acc hover:text-acc-press transition-colors"
                          >
                            <Link size={14} />
                            <span className="truncate">{link.label || link.url}</span>
                          </a>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-mut italic">Nenhuma ligação adicionada</p>
                  )}
                </div>
              </div>

              {/* Ações */}
              {editing ? (
                <div className="mt-8 pt-4 border-t border-bd space-y-3">
                  <Button
                    type="button"
                    onClick={handleSave}
                    className="w-full py-3.5 rounded-xl font-display font-semibold shadow-lg shadow-acc/20 bg-acc text-bg hover:bg-acc-press transition-colors active:scale-95"
                  >
                    Salvar alterações
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full py-3.5 rounded-xl border border-bd bg-bg text-txt hover:bg-surf2 hover:border-acc active:scale-95"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <div className="mt-8 flex flex-col gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraftName(displayName);
                      setDraftNickname(nickname ?? "");
                      setDraftBio(bio ?? "");
                      setDraftRole(role ?? "");
                      setDraftLinks([...links]);
                      setDraftBannerUrl(bannerUrl);
                      setEditing(true);
                    }}
                    className="w-full py-3.5 text-sm font-medium border border-bd bg-bg text-txt hover:bg-surf2 hover:border-acc active:scale-95"
                  >
                    <Pencil size={16} className="mr-2" />
                    Editar perfil
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Conquistas */}
            <TabsContent value="badges" className="p-0 pt-6">
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-xs text-mut">Conquistas e badges do perfil</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: "Membro", icon: <Users size={16} className="text-acc" />, color: "text-acc" },
                    { label: "Iniciante", icon: <Gift size={16} className="text-mut" />, color: "text-mut" },
                    { label: "Verificado", icon: <ShieldCheck size={16} className="text-acc" />, color: "text-acc" },
                    { label: "Bot", icon: <Robot size={16} className="text-err" />, color: "text-err" },
                  ].map((badge, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center gap-2 p-3 rounded-lg bg-surf2 border border-bd/50 hover:border-acc/50 transition-colors group"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${badge.color} bg-bg/50`}>
                        {badge.icon}
                      </div>
                      <span className="text-xs text-txt">{badge.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-mut mt-2">Sem badges adicionais ainda.</p>
              </div>
            </TabsContent>

            {/* Ligações */}
            <TabsContent value="connections" className="p-0 pt-6">
              <div className="flex flex-col gap-4">
                <p className="text-xs text-mut">Conecte suas contas externas</p>
                <div className="space-y-3">
                  {[
                    { name: "Google", icon: <ShieldCheck size={16} className="text-acc" />, connected: true },
                    { name: "GitHub", icon: <Users size={16} className="text-mut" />, connected: false },
                    { name: "Twitch", icon: <Gift size={16} className="text-mut" />, connected: false },
                  ].map((conn, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-4 py-3 rounded-lg border border-bd bg-bg transition-colors hover:bg-surf2"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 p-1.5 rounded bg-surf2 text-mut">
                          {conn.icon}
                        </div>
                        <div className="text-sm text-txt">{conn.name}</div>
                      </div>
                      {conn.connected ? (
                        <span className="text-xs text-acc bg-acc/10 px-2 py-0.5 rounded border border-acc/20">
                          Conectado
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="cursor-pointer text-xs text-acc hover:text-acc-press underline underline-offset-4 transition-colors active:scale-95"
                        >
                          Conectar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
