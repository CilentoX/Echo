"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Trash, Camera, Crop } from "@phosphor-icons/react"
import ImageEditor from "@/components/media/ImageEditor"
import { useUiStore } from "@/stores/uiStore"
import { mxcToHttp } from "@/lib/media/mxc"
import { getImageSize } from "@/lib/media/imagePresets"
import { UploadIcon } from "lucide-react"

export interface ImageUploadWithEditProps {
  value: string | null
  label: string
  placeholder?: string
  initials?: string
  onChange: (file: File) => void
  onRemove?: () => void
  /** Tipo de imagem - define aspect ratio e tamanho de saída */
  type?: "avatar" | "banner" | "guild"
  /** Preset de tamanho (ex: "large", "xlarge") */
  preset?: string
  /** Aspect ratio override (width / height). Se não informado, calculado a partir do type/preset. */
  aspect?: number
  /** Altura do preview (classes Tailwind, ex: "h-24", "h-40") */
  previewHeight?: string
  /** Largura do preview (classes Tailwind, ex: "w-24", "w-full") */
  previewW?: string
  editTitle?: string
  /** Se true, permite editar (hover mostra controles, click abre crop editor) */
  editable?: boolean
  /** Se true, mostra loading e bloqueia interações */
  uploading?: boolean
  /** Se true, desabilita o componente */
  disabled?: boolean
  /** Mensagem de erro de upload (ex: falha no Appwrite) */
  uploadError?: string | null
  maxSizeMB?: number
  accept?: string
  /** URL do Appwrite usada como exibição principal (evita requisição ao Matrix) */
  appwriteUrl?: string | null
}

const ImageUploadWithEdit = function ImageUploadWithEdit({
  value,
  label,
  placeholder,
  initials,
  onChange,
  onRemove,
  type = "avatar",
  preset,
  aspect,
  previewHeight = "h-24",
  previewW,
  editTitle,
  editable = false,
  uploading = false,
  disabled = false,
  uploadError = null,
  maxSizeMB = 5,
  accept = "image/*",
  appwriteUrl = null,
}: ImageUploadWithEditProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "")
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewObjUrl, setPreviewObjUrl] = useState<string | null>(null)
  const [rawOriginalUrl, setRawOriginalUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Resolve aspect ratio e tamanho de saída baseado no tipo/preset (garante resolução mínima de 512px)
  const outputSize = useMemo(() => {
    const size = getImageSize(type, preset ?? "large")
    return size ?? { width: 512, height: 512 }
  }, [type, preset])
  const resolvedAspect = useMemo(() => {
    if (aspect !== undefined) return aspect
    return outputSize.width / outputSize.height
  }, [aspect, outputSize])

  useEffect(() => {
    return () => {
      if (previewObjUrl && previewObjUrl !== rawOriginalUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }
      if (rawOriginalUrl) {
        URL.revokeObjectURL(rawOriginalUrl)
      }
    }
  }, [previewObjUrl, rawOriginalUrl])

  const maxSizeBytes = maxSizeMB * 1024 * 1024

  // Cores estilo Discord para o círculo de fallback (iniciais)
  const FALLBACK_COLORS = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500",
    "bg-lime-500", "bg-green-500", "bg-emerald-500", "bg-teal-500",
    "bg-cyan-500", "bg-blue-500", "bg-indigo-500", "bg-violet-500",
    "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500",
  ]

  /// Gera uma classe de cor baseada no hash do texto (iniciais).
  /// Sempre retorna a mesma cor para o mesmo texto.
  const fallbackColorClass = useMemo(() => {
    if (!initials) return FALLBACK_COLORS[0]
    let hash = 0
    for (let i = 0; i < initials.length; i++) {
      hash = initials.charCodeAt(i) + ((hash << 5) - hash)
    }
    const index = Math.abs(hash) % FALLBACK_COLORS.length
    return FALLBACK_COLORS[index]
  }, [initials])

  const displaySrc = useMemo(() => {
    if (previewObjUrl) return previewObjUrl
    // Prioridade: URL do Appwrite (direta, sem requisição ao Matrix)
    if (appwriteUrl) return appwriteUrl
    if (value) {
      if (value.startsWith("mxc://")) {
        return mxcToHttp(value) ?? value
      }
      return value
    }
    return null
  }, [previewObjUrl, value, appwriteUrl])

  const hasImage = useMemo(() => Boolean(displaySrc), [displaySrc])

  // Força reset do preview quando a URL do Appwrite muda (novo upload externo)
  useEffect(() => {
    if (appwriteUrl && !previewObjUrl) {
      setSelectedFile(null)
      setPreviewObjUrl(null)
      setRawOriginalUrl(null)
      setEditorOpen(false)
    }
  }, [appwriteUrl, previewObjUrl])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith("image/")) {
        setError("Selecione um arquivo de imagem válido.")
        return
      }
      if (file.size > maxSizeBytes) {
        setError(`Arquivo muito grande (máximo ${maxSizeMB} MB).`)
        return
      }

      if (previewObjUrl && previewObjUrl !== rawOriginalUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }
      if (rawOriginalUrl) {
        URL.revokeObjectURL(rawOriginalUrl)
      }

      setSelectedFile(file)
      setError(null)

      const url = URL.createObjectURL(file)
      // Mantém a imagem original de alta resolução para qualquer re-corte
      setRawOriginalUrl(url)
      setPreviewObjUrl(url)
      // Abre o editor automaticamente após selecionar o arquivo
      setEditorOpen(true)
      e.target.value = ""
    },
    [maxSizeBytes, maxSizeMB, previewObjUrl, rawOriginalUrl],
  )

  const handleSelectNewImage = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Selecione um arquivo de imagem válido.")
        return
      }
      if (file.size > maxSizeBytes) {
        setError(`Arquivo muito grande (máximo ${maxSizeMB} MB).`)
        return
      }
      if (rawOriginalUrl) {
        URL.revokeObjectURL(rawOriginalUrl)
      }
      const url = URL.createObjectURL(file)
      setRawOriginalUrl(url)
      setSelectedFile(file)
      setError(null)
    },
    [maxSizeBytes, maxSizeMB, rawOriginalUrl],
  )

  const handleEditorConfirm = useCallback(
    (croppedFile: File) => {
      if (previewObjUrl && previewObjUrl !== rawOriginalUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }
      const newUrl = URL.createObjectURL(croppedFile)
      setPreviewObjUrl(newUrl)
      setSelectedFile(croppedFile)
      onChange(croppedFile)
      setEditorOpen(false)
    },
    [onChange, previewObjUrl, rawOriginalUrl],
  )

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false)
  }, [])

  const handleRemove = useCallback(() => {
    if (previewObjUrl && previewObjUrl !== rawOriginalUrl) {
      URL.revokeObjectURL(previewObjUrl)
    }
    if (rawOriginalUrl) {
      URL.revokeObjectURL(rawOriginalUrl)
    }
    setRawOriginalUrl(null)
    setSelectedFile(null)
    setPreviewObjUrl(null)
    if (onRemove) onRemove()
  }, [onRemove, previewObjUrl, rawOriginalUrl])

  // Quando clicado no container da imagem:
  // Se não tem imagem, abre seletor de arquivo direto
  // Se tem imagem e editable=true, abre o editor de corte (usando original de alta resolução)
  const handleClick = useCallback(() => {
    if (!editable) {
      if (!hasImage) {
        inputRef.current?.click()
      }
      return
    }
    if (hasImage || selectedFile || previewObjUrl || rawOriginalUrl) {
      setEditorOpen(true)
    } else {
      inputRef.current?.click()
    }
  }, [editable, hasImage, selectedFile, previewObjUrl, rawOriginalUrl])

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mut">
          {label}
        </label>
      )}

      <div
        className={`relative border border-bd bg-surf2 flex items-center justify-center group overflow-hidden ${
          type === "avatar" ? "rounded-full" : "rounded-xl"
        } ${previewHeight} ${
          previewW ? previewW : type === "avatar" ? previewHeight.replace("h-", "w-") : "w-full"
        } ${editable ? "cursor-pointer" : "cursor-default"}`}
        onClick={handleClick}
        role={editable ? "button" : undefined}
        tabIndex={editable ? 0 : -1}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && editable) {
            e.preventDefault()
            handleClick()
          }
        }}
        aria-label={label}
      >
        {hasImage || previewObjUrl ? (
          <>
            <img
              src={displaySrc!}
              alt={label}
              className="absolute inset-0 w-full h-full object-cover object-center"
              onLoad={() => {
                console.log("[ImageUploadWithEdit] Imagem carregada com sucesso:", displaySrc)
              }}
              onError={(e) => {
                console.warn("[ImageUploadWithEdit] Falha ao carregar imagem:", e.currentTarget.src)
              }}
            />
            {/* Hover overlay com ações explícitas de troca e corte */}
            {editable && !uploading && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity z-10 p-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    inputRef.current?.click()
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer shadow-md"
                  title="Escolher outro arquivo"
                >
                  <Camera size={14} weight="bold" />
                  <span>Trocar</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditorOpen(true)
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/70 hover:bg-black/90 text-white text-[11px] font-medium flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer shadow-md"
                  title="Ajustar enquadramento e corte"
                >
                  <Crop size={14} weight="bold" />
                  <span>Recortar</span>
                </button>
              </div>
            )}
            {/* Botão remover - no canto superior */}
            {editable && onRemove && hasImage && !uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                disabled={uploading || disabled}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-600 flex items-center justify-center text-xs text-white transition-colors z-20 disabled:opacity-50 disabled:pointer-events-none drop-shadow-md cursor-pointer"
                title="Remover imagem"
                aria-label="Remover imagem"
              >
                <Trash size={13} weight="bold" />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 z-20">
                <span className="text-xs text-white animate-pulse font-medium drop-shadow-lg">Enviando…</span>
              </div>
            )}
          </>
        ) : (
          // Sem imagem - área de drop/upload + fallback de iniciais
          <>
            {initials && type === "avatar" && (
              <span
                className={`absolute inset-0 flex items-center justify-center ${fallbackColorClass} text-txt font-bold uppercase tracking-tighter leading-none select-none drop-shadow-lg`}
                style={{ fontSize: 24 }}
              >
                {initials.slice(0, 2).toUpperCase()}
              </span>
            )}
            {(!initials || type !== "avatar") && (
              <>
                {type === "banner" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-r from-acc/25 via-surf2 to-acc/10">
                    {editable && (
                      <div className="flex items-center gap-2 rounded-lg bg-black/40 px-3 py-1.5 text-xs font-medium text-txt backdrop-blur-sm group-hover:bg-black/60 transition-colors shadow-sm">
                        <UploadIcon size={16} />
                        <span>{placeholder || "Adicionar banner"}</span>
                      </div>
                    )}
                  </div>
                ) : editable ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-mut">
                    <UploadIcon size={24} className="opacity-70" />
                    <span className="text-xs font-medium">{placeholder || "Adicionar imagem"}</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-mut/50">
                    <UploadIcon size={24} />
                    <span className="text-xs font-medium">{placeholder || "Sem imagem"}</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Input de arquivo sempre montado no DOM para garantir que click() funcione em qualquer estado */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={uploading || disabled}
        onChange={handleFileSelect}
      />

      {/* Ações auxiliares diretas abaixo do preview quando editável e com imagem */}
      {editable && hasImage && !uploading && (
        <div className="flex items-center justify-center gap-3 text-[11px] text-mut pt-0.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="text-acc hover:underline flex items-center gap-1 cursor-pointer font-medium"
          >
            <Camera size={13} weight="bold" />
            <span>Trocar foto</span>
          </button>
          <span className="text-mut/40">·</span>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="text-mut hover:text-txt hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Crop size={13} weight="bold" />
            <span>Ajustar corte</span>
          </button>
          {onRemove && (
            <>
              <span className="text-mut/40">·</span>
              <button
                type="button"
                onClick={handleRemove}
                className="text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash size={13} weight="bold" />
                <span>Remover</span>
              </button>
            </>
          )}
        </div>
      )}

      {error || uploadError ? (
        <p className="text-xs text-err text-center">{error || uploadError}</p>
      ) : null}

      {uploading && <p className="text-xs text-mut italic animate-pulse text-center">Processando…</p>}

      <ImageEditor
        open={editorOpen}
        imageSrc={rawOriginalUrl || displaySrc || null}
        title={editTitle || `Editar ${label}`}
        aspect={resolvedAspect}
        outputWidth={outputSize.width}
        outputHeight={outputSize.height}
        onConfirm={handleEditorConfirm}
        onClose={handleEditorClose}
        userId={myUserId}
        onSelectNewImage={handleSelectNewImage}
      />
    </div>
  )
}

export default ImageUploadWithEdit
