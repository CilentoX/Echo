import { useState, useRef, useEffect } from "react";
import { X, Trash, Camera, Gear, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { matrixService } from "@/lib/matrix/instance";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import ImageEditor from "@/components/media/ImageEditor";
import { useEchoApi } from "@/lib/api/echoApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EditGuildModalProps {
  open: boolean;
  onClose: () => void;
  guild: { guildId: string; name: string; avatarUrl?: string | null; description?: string | null; bannerUrl?: string | null };
  onSave: (
    updates: { name: string; iconUrl?: string | null; bannerUrl?: string | null; description?: string | null },
  ) => Promise<void>;
}

function getInitials(name: string): string {
  const clean = name.trim();
  if (!clean) return "E";
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function EditGuildModal({ open, onClose, guild, onSave }: EditGuildModalProps) {
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? "");

  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(guild.avatarUrl ?? null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(guild.bannerUrl ?? null);

  // Editor states
  const [iconEditorOpen, setIconEditorOpen] = useState(false);
  const [bannerEditorOpen, setBannerEditorOpen] = useState(false);
  const [rawIconUrl, setRawIconUrl] = useState<string | null>(null);
  const [rawBannerUrl, setRawBannerUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const setActiveGuild = useUiStore((state) => state.setActiveGuild);
  const setActiveChannel = useUiStore((state) => state.setActiveChannel);
  const setGuilds = useSyncStore((state) => state.setGuilds);

  const echoApi = useEchoApi();

  useEffect(() => {
    if (open) {
      setName(guild.name);
      setDescription(guild.description ?? "");
      setIconPreview(guild.avatarUrl ?? null);
      setBannerPreview(guild.bannerUrl ?? null);
      setIconFile(null);
      setBannerFile(null);
      setError(null);
    }
  }, [open, guild]);

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
    if (iconPreview && iconPreview.startsWith("blob:")) URL.revokeObjectURL(iconPreview);
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
    if (bannerPreview && bannerPreview.startsWith("blob:")) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(URL.createObjectURL(croppedFile));
    setBannerEditorOpen(false);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Dê um nome para a guilda.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let iconUrl: string | undefined = iconPreview === null ? undefined : guild.avatarUrl ?? undefined;
      let bannerUrl: string | undefined = bannerPreview === null ? undefined : guild.bannerUrl ?? undefined;

      if (iconFile) {
        iconUrl = await echoApi.uploadChatMedia(iconFile);
      }
      if (bannerFile) {
        bannerUrl = await echoApi.uploadChatMedia(bannerFile);
      }

      await onSave({
        name: trimmed,
        iconUrl,
        bannerUrl,
        description: description.trim() || undefined,
      });
      onClose();
    } catch {
      setError("Não foi possível salvar as alterações. Tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await matrixService.deleteGuild(guild.guildId);
      const current = useSyncStore.getState().guilds;
      setGuilds(current.filter((g) => g.guildId !== guild.guildId));
      const ui = useUiStore.getState();
      if (ui.activeGuildId === guild.guildId) {
        setActiveGuild(null);
        setActiveChannel(null);
      }
      setConfirmDeleteOpen(false);
      onClose();
    } catch {
      setError("Não foi possível excluir a guilda. Tente de novo.");
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="w-full sm:max-w-[480px] max-h-[90vh] overflow-y-auto scrollbar-thin rounded-2xl border border-white/[0.08] bg-[#12161f] p-0 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-0"
          onPointerDownOutside={(e) => {
            if (iconEditorOpen || bannerEditorOpen) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (iconEditorOpen || bannerEditorOpen) e.preventDefault();
          }}
        >
          {/* Header Superior Padrão Guild Modal */}
          <div className="relative p-6 pb-4 border-b border-white/[0.04] flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-acc text-bg flex items-center justify-center font-display font-bold text-sm shadow-md shadow-acc/20">
                <Gear size={20} weight="bold" />
              </div>
              <div>
                <DialogTitle className="font-display text-lg font-semibold text-txt">
                  Editar guilda
                </DialogTitle>
                <DialogDescription className="text-xs text-mut/80 mt-0.5">
                  Atualize nome, ícone, banner e detalhes da guilda.
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

                  {/* Nome Dinâmico ao Vivo */}
                  <div className="ml-3 flex-1 min-w-0 pb-1">
                    <h4 className="font-display font-bold text-base text-txt truncate">
                      {name.trim() || guild.name}
                    </h4>
                    <p className="text-[11px] text-acc flex items-center gap-1 font-medium">
                      <Sparkle size={12} weight="fill" />
                      Visualização ao vivo
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Inputs de Upload Ocultos */}
            <input
              type="file"
              ref={iconInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleIconSelected}
            />
            <input
              type="file"
              ref={bannerInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleBannerSelected}
            />

            {/* Nome da Guilda */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-mut">
                  Nome da guilda
                </label>
                <span className="font-mono text-[11px] text-mut">
                  {name.length}/100
                </span>
              </div>
              <input
                type="text"
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ex: Minha comunidade"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] transition-all"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-mut">
                  Descrição
                </label>
                <span className="font-mono text-[11px] text-mut">
                  {description.length}/280
                </span>
              </div>
              <textarea
                value={description}
                maxLength={280}
                rows={3}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Descreva o propósito da sua comunidade..."
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-txt outline-none placeholder:text-mut/50 focus:border-acc/50 focus:bg-white/[0.05] focus:ring-1 focus:ring-acc/30 hover:border-white/[0.15] resize-none transition-all"
              />
            </div>

            {error && (
              <p role="alert" className="text-xs text-err flex items-center gap-1.5 mt-2">
                <WarningCircle size={14} weight="bold" />
                {error}
              </p>
            )}

            {/* Zona de Perigo - Excluir Guilda */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={deleting}
                className="cursor-pointer w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:border-red-500/40 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Trash size={14} weight="bold" />
                Excluir guilda permanentemente
              </button>
            </div>
          </div>

          {/* Rodapé Padrão */}
          <div className="p-6 pt-2 border-t border-white/[0.04] flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-txt hover:bg-white/[0.08] active:scale-95 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={loading || !name.trim()}
              className="cursor-pointer flex-1 rounded-xl bg-acc py-2.5 text-sm font-semibold text-bg shadow-lg shadow-acc/20 hover:bg-acc-press active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      {confirmDeleteOpen && (
        <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
          <DialogContent
            showCloseButton={false}
            className="w-full sm:max-w-[400px] rounded-2xl border border-white/[0.08] bg-[#12161f] p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 gap-4 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mx-auto shadow-md">
              <Trash size={24} weight="bold" />
            </div>
            <div>
              <DialogTitle className="font-display text-lg font-bold text-txt">
                Excluir guilda?
              </DialogTitle>
              <DialogDescription className="text-xs text-mut/80 mt-1.5 leading-relaxed">
                Tem certeza que deseja excluir permanentemente a guilda <strong className="text-txt">"{guild.name}"</strong>? Esta ação não pode ser desfeita.
              </DialogDescription>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="cursor-pointer flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2.5 text-sm font-medium text-txt hover:bg-white/[0.08] active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="cursor-pointer flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {deleting ? "Excluindo…" : "Sim, excluir"}
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Edição de Imagem do Ícone */}
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

      {/* Modal de Edição de Imagem do Banner */}
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
