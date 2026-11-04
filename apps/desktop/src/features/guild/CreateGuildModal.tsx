import { useState, useRef } from "react";
import { X, Plus, Camera, Trash, Sparkle } from "@phosphor-icons/react";
import ImageEditor from "@/components/media/ImageEditor";
import { useEchoApi } from "@/lib/api/echoApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CreateGuildModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (
    data: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => Promise<{ guildId: string; name: string; avatarUrl?: string | null; bannerUrl?: string | null }>;
  onCreated: (guild: { guildId: string; name: string; avatarUrl?: string | null; bannerUrl?: string | null }) => void;
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "E";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function CreateGuildModal({ open, onClose, onCreate, onCreated }: CreateGuildModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

  // Editor modal state
  const [iconEditorOpen, setIconEditorOpen] = useState(false);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [rawIconUrl, setRawIconUrl] = useState<string | null>(null);
  const [rawBannerUrl, setRawBannerUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const echoApi = useEchoApi();

  const handleIconSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    setRawIconUrl(url);
    setIconEditorOpen(true);
    e.target.value = "";
  };

  const handleIconConfirm = (croppedFile: File) => {
    setIconFile(croppedFile);
    if (iconPreview) URL.revokeObjectURL(iconPreview);
    setIconPreview(URL.createObjectURL(croppedFile));
    setIconEditorOpen(false);
  };

  const handleBannerSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem válido.");
      return;
    }
    const url = URL.createObjectURL(file);
    setRawBannerUrl(url);
    setBannerEditorOpen(true);
    e.target.value = "";
  };

  const handleBannerConfirm = (croppedFile: File) => {
    setBannerFile(croppedFile);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(URL.createObjectURL(croppedFile));
    setBannerEditorOpen(false);
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a guilda.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let iconUrl: string | null = null;
      let bannerUrl: string | null = null;

      if (iconFile) {
        iconUrl = await echoApi.uploadChatMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await echoApi.uploadChatMedia(bannerFile);
      }

      const guild = await onCreate({
        name: trimmed,
        iconUrl,
        bannerUrl,
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setIconFile(null);
      setIconPreview(null);
      setBannerFile(null);
      setBannerPreview(null);
      onCreated({
        ...guild,
        avatarUrl: (guild as any).avatarUrl ?? iconUrl,
        bannerUrl: (guild as any).bannerUrl ?? bannerUrl,
      });
      onClose();
    } catch {
      setError("Não foi possível criar a guilda. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
        >
          {/* Header Superior Limpo */}
          <div className="relative p-6 pb-4 border-b border-white/[0.04] flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
                <Plus size={20} weight="bold" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-semibold text-txt">
                  Criar guilda
                </DialogTitle>
                <DialogDescription className="text-xs text-mut/80 mt-0.5">
                  Crie um novo espaço para reunir sua comunidade.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="cursor-pointer rounded-xl p-1.5 text-mut hover:bg-white/[0.06] hover:text-txt active:scale-95 transition-all -mr-1 -mt-1"
            >
              <X size={18} weight="bold" />
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Live Hero Preview (Banner + Avatar Sobreposto) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-mut/80 px-0.5">
                <span>Personalização Visual</span>
                <span className="text-[10px] font-normal lowercase tracking-normal text-mut/50">
                  Clique para alterar
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0d1017] shadow-inner group/hero">
                {/* Área do Banner (16:9) */}
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className="relative h-32 w-full bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-slate-950 cursor-pointer overflow-hidden group/banner flex items-center justify-center transition-all"
                >
                  {bannerPreview ? (
                    <img
                      src={bannerPreview}
                      alt="Banner da guilda"
                      className="w-full h-full object-cover group-hover/banner:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-mut/60 gap-1.5 transition-colors group-hover/banner:text-txt">
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm group-hover/banner:bg-white/[0.08] group-hover/banner:border-acc/40 transition-all">
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

                {/* Avatar Flutuante e Título Dinâmico */}
                <div className="px-5 pb-3.5 -mt-9 flex items-end justify-between relative z-10">
                  <div
                    onClick={() => iconInputRef.current?.click()}
                    className="relative h-20 w-20 rounded-2xl border-4 border-[#12161f] bg-[#161c28] cursor-pointer shadow-xl overflow-hidden group/avatar flex items-center justify-center shrink-0"
                  >
                    {iconPreview ? (
                      <img
                        src={iconPreview}
                        alt="Ícone da guilda"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-acc/20 to-acc/5 text-acc">
                        <span className="font-display text-2xl font-bold tracking-wider">
                          {getInitials(name)}
                        </span>
                      </div>
                    )}

                    {/* Overlay do Avatar no Hover */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-1 text-white transition-opacity">
                      <Camera size={18} />
                      <span className="text-[9px] font-bold uppercase tracking-wider">
                        {iconPreview ? "Trocar" : "Ícone"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right pb-1 max-w-[240px] truncate">
                    <p className="font-semibold text-sm text-txt truncate">
                      {name.trim() || "Nova Guilda"}
                    </p>
                    <p className="text-[11px] text-mut/70 truncate flex items-center justify-end gap-1">
                      <Sparkle size={12} className="text-acc" /> Espaço da comunidade
                    </p>
                  </div>
                </div>
              </div>

              {/* Inputs de arquivo ocultos acionados pelo clique no preview */}
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconSelected}
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

            {/* Nome da Guilda */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="guild-name" className="text-xs font-semibold uppercase tracking-wider text-mut">
                  Nome da guilda
                </Label>
                <span className="text-[11px] text-mut font-mono">{name.length}/100</span>
              </div>
              <Input
                id="guild-name"
                type="text"
                value={name}
                maxLength={100}
                disabled={loading}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !loading) void handleSubmit();
                }}
                placeholder="Ex: Minha comunidade"
                autoFocus
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="guild-desc" className="text-xs font-semibold uppercase tracking-wider text-mut">
                  Descrição (opcional)
                </Label>
                <span className="text-[11px] text-mut font-mono">{description.length}/280</span>
              </div>
              <Textarea
                id="guild-desc"
                value={description}
                maxLength={280}
                disabled={loading}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (error) setError(null);
                }}
                rows={3}
                placeholder="Descreva o propósito da sua comunidade…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] resize-none transition-all"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 font-medium animate-in fade-in-50 duration-150">
                {error}
              </p>
            )}

            {/* Botões de Ação */}
            <div className="mt-6 flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] text-txt hover:bg-white/[0.08] hover:border-white/[0.15] active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={loading}
                className="cursor-pointer flex-1 rounded-xl bg-acc text-bg font-semibold shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Criando…</span>
                  </>
                ) : (
                  "Criar guilda"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor/Cropper de Ícone */}
      {rawIconUrl && (
        <ImageEditor
          open={iconEditorOpen}
          imageSrc={rawIconUrl}
          title="Recortar ícone da guilda"
          aspect={1}
          outputWidth={512}
          outputHeight={512}
          onConfirm={handleIconConfirm}
          onClose={() => setIconEditorOpen(false)}
        />
      )}

      {/* Editor/Cropper de Banner */}
      {rawBannerUrl && (
        <ImageEditor
          open={bannerEditorOpen}
          imageSrc={rawBannerUrl}
          title="Recortar banner da guilda"
          aspect={16 / 9}
          outputWidth={1280}
          outputHeight={720}
          onConfirm={handleBannerConfirm}
          onClose={() => setBannerEditorOpen(false)}
        />
      )}
    </>
  );
}
