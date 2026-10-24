import { useEffect, useMemo, useState } from "react";
import { X, Pencil, Link, ShieldCheck, Users, Gift } from "@phosphor-icons/react";
import { useProfileStore } from "@/stores/profileStore";
import { ImageUploadWithCrop } from "@/components/media/ImageUploadWithCrop";
import MxcImage from "@/components/media/MxcImage";
import { matrixService } from "@/lib/matrix/instance";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

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

  const [tab, setTab] = useState<"profile" | "badges" | "connections">("profile");
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [draftNickname, setDraftNickname] = useState(nickname ?? "");
  const [draftBio, setDraftBio] = useState(bio ?? "");
  const [draftRole, setDraftRole] = useState(role ?? "");
  const [draftLinks, setDraftLinks] = useState([...links]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSave = () => {
    setDisplayName(draftName);
    setNickname(draftNickname || null);
    setBio(draftBio || null);
    setRole(draftRole || null);
    setLinks(draftLinks);
    setEditing(false);
  };

  const handleAddLink = () => {
    setDraftLinks([...draftLinks, { label: "", url: "" }]);
  };

  const handleRemoveLink = (index: number) => {
    setDraftLinks(draftLinks.filter((_, i) => i !== index));
  };

  const handleLinkChange = (index: number, field: "label" | "url", value: string) => {
    const next = [...draftLinks];
    next[index] = { ...next[index], [field]: value };
    setDraftLinks(next);
  };

  const handleBannerChange = async (file: File) => {
    if (file.size === 0) {
      setBannerUrl(null);
      return;
    }
    try {
      const uri = await matrixService.uploadMedia(file);
      setBannerUrl(uri);
    } catch {
      setBannerUrl(null);
    }
  };

  const handleAvatarChange = async (file: File) => {
    if (!file) return;
    try {
      const uri = await matrixService.uploadMedia(file);
      setAvatarUrl(uri);
    } catch {
      setAvatarUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-[640px] p-0">
        <DialogHeader className="p-6 border-b border-bd bg-surf/50 backdrop-blur">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <MxcImage mxcUrl={avatarUrl} className="w-10 h-10 rounded-full" alt="Avatar" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-acc text-bg flex items-center justify-center font-display font-bold text-sm">
                {initials}
              </div>
            )}
            <div>
              <DialogTitle className="font-display text-lg font-semibold text-txt">Perfil</DialogTitle>
              <DialogDescription className="text-xs text-mut">{username}</DialogDescription>
            </div>
            <button
              type="button"
              aria-label="Fechar perfil"
              onClick={onClose}
              className="cursor-pointer rounded p-1.5 text-mut hover:bg-surf2 hover:text-txt active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "profile" | "badges" | "connections")}>
            <TabsList className="grid w-full grid-cols-3 border-b border-bd bg-surf/50">
              {PROFILE_TABS.map(([tabKey, label]) => (
                <TabsTrigger key={tabKey} value={tabKey} className="px-4 py-3 text-sm font-medium transition-colors">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Perfil */}
            <TabsContent value="profile" className="p-0 pt-6">
              <Card className="border-bd">
                <CardContent className="px-0 py-0">
                  <div className="relative w-full h-32 rounded-xl bg-surf2 border border-bd overflow-hidden">
                    <ImageUploadWithCrop
                      label="Banner"
                      value={bannerUrl}
                      placeholder="Adicionar banner de perfil"
                      onChange={handleBannerChange}
                      aspect={16 / 9}
                      cropTitle="Recortar banner de perfil"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="relative -mt-20 flex justify-center">
                <div
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center font-display font-bold text-txt shadow-lg border-4 border-surf ${
                    avatarUrl ? "bg-bg" : "bg-acc"
                  }`}
                  style={avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
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
                      className="absolute bottom-1 right-1 w-8 h-8 rounded-full flex items-center justify-center text-sm text-bg bg-acc shadow-lg hover:bg-acc-press transition-all active:scale-95"
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

              <div className="mt-4 text-center">
                <p className="font-display text-2xl font-bold text-txt truncate">
                  {displayName || username}
                </p>
                {nickname && (
                  <p className="text-sm text-acc font-medium mt-1">@{nickname}</p>
                )}
                {!nickname && (
                  <p className="text-sm text-mut mt-1">{username}</p>
                )}
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
                      className="w-full"
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
                      className="w-full"
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
                      className="w-full"
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
                      className="w-full"
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
                  <div className="grid grid-cols-2 gap-4">
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
                      className="text-xs text-acc hover:text-acc-press underline underline-offset-4"
                    >
                      <span className="text-[10px]">+</span> Adicionar ligação
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {draftLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2 bg-bg border border-bd rounded-lg p-2.5">
                      {editing ? (
                        <>
                          <Input
                            value={link.label}
                            onChange={(e) => handleLinkChange(i, "label", e.target.value)}
                            placeholder="Nome da ligação"
                            className="flex-1 text-sm text-txt placeholder:text-mut"
                          />
                          <Input
                            value={link.url}
                            onChange={(e) => handleLinkChange(i, "url", e.target.value)}
                            placeholder="https://"
                            className="flex-1 text-sm text-txt placeholder:text-mut"
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
                  ))}
                </div>
              </div>

              {editing ? (
                <div className="mt-8 pt-4 border-t border-bd space-y-3">
                  <Button
                    type="button"
                    onClick={handleSave}
                    className="w-full py-3.5 rounded-xl font-display font-semibold shadow-lg shadow-acc/20"
                  >
                    Salvar alterações
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDraftName(displayName);
                      setDraftNickname(nickname ?? "");
                      setDraftBio(bio ?? "");
                      setDraftRole(role ?? "");
                      setDraftLinks([...links]);
                      setEditing(false);
                    }}
                    className="w-full py-3.5 rounded-xl"
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setDraftName(displayName);
                    setDraftNickname(nickname ?? "");
                    setDraftBio(bio ?? "");
                    setDraftRole(role ?? "");
                    setDraftLinks([...links]);
                    setEditing(true);
                  }}
                  className="w-full py-3.5 text-sm font-medium"
                >
                  <Pencil size={16} className="mr-2" />
                  Editar perfil
                </Button>
              )}
            </TabsContent>

            {/* Conquistas */}
            <TabsContent value="badges" className="p-0 pt-6">
              <div className="flex flex-col items-center gap-4 py-4">
                <p className="text-xs text-mut">Conquistas e badges do perfil</p>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Membro", icon: <Users size={16} className="text-acc" />, color: "text-acc" },
                    { label: "Iniciante", icon: <Gift size={16} className="text-mut" />, color: "text-mut" },
                    { label: "Verificado", icon: <ShieldCheck size={16} className="text-acc" />, color: "text-acc" },
                    { label: "Bot", icon: <ShieldCheck size={16} className="text-err" />, color: "text-err" },
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
