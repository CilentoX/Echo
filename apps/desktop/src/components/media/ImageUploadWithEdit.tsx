"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X, Upload, Pencil, Trash } from "@phosphor-icons/react"
import ImageEditor from "@/components/media/ImageEditor"
import { useUiStore } from "@/stores/uiStore"
import { mxcToHttp } from "@/lib/media/mxc"
import { getImageSize } from "@/lib/media/imagePresets"

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
  previewHeight?: string
  editTitle?: string
  /** Se true, permite editar (hover mostra controles, click abre crop editor) */
  editable?: boolean
  /** Se true, mostra loading e bloqueia interações */
  uploading?: boolean
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
  previewHeight = "h-24",
  editTitle,
  editable = false,
  uploading = false,
  maxSizeMB = 5,
  accept = "image/*",
  appwriteUrl = null,
}: ImageUploadWithEditProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "")
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewObjUrl, setPreviewObjUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Resolve aspect ratio e tamanho de saída baseado no tipo/preset
  const outputSize = useMemo(() => {
    const size = getImageSize(type, preset ?? "large")
    return size ?? { width: 512, height: 512 }
  }, [type, preset])
  const aspect = useMemo(() => outputSize.width / outputSize.height, [outputSize])

  useEffect(() => {
    return () => {
      if (previewObjUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }
    }
  }, [previewObjUrl])

  const maxSizeBytes = maxSizeMB * 1024 * 1024

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

  // Força reset do preview quando a URL do Appwrite muda (novo upload)
  useEffect(() => {
    if (appwriteUrl && !previewObjUrl) {
      setSelectedFile(null)
      setPreviewObjUrl(null)
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

      if (previewObjUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }

      setSelectedFile(file)
      setError(null)

      const url = URL.createObjectURL(file)
      setPreviewObjUrl(url)
      // Abre o editor automaticamente após selecionar o arquivo
      setEditorOpen(true)
    },
    [maxSizeBytes, maxSizeMB, previewObjUrl],
  )

  const handleEditorConfirm = useCallback(
    (croppedFile: File) => {
      onChange(croppedFile)
      setSelectedFile(null)
      setPreviewObjUrl(null)
      setEditorOpen(false)
    },
    [onChange],
  )

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false)
  }, [])

  const handleRemove = useCallback(() => {
    setSelectedFile(null)
    setPreviewObjUrl(null)
    if (onRemove) onRemove()
  }, [onRemove])

  // Quando editable=true: click abre crop editor
  // Quando editable=false e não tem imagem: click abre file picker
  const handleClick = useCallback(() => {
    if (!editable) {
      if (!hasImage) {
        inputRef.current?.click()
      }
      return
    }
    // Em modo editável, se tem imagem ou arquivo selecionado, abre crop editor
    if (hasImage || selectedFile || previewObjUrl) {
      setEditorOpen(true)
    } else {
      inputRef.current?.click()
    }
  }, [editable, hasImage, selectedFile, previewObjUrl])

  return (
    <div className="flex flex-col gap-2">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mut">
        {label}
      </label>

      <div
        className={`relative w-full rounded-xl border border-bd bg-surf2 flex items-center justify-center group overflow-hidden ${previewHeight} ${editable ? "cursor-pointer" : "cursor-default"}`}
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
            {/* Hover overlay - apenas escurece a imagem quando editable */}
            {editable && !uploading && (
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors duration-200" />
            )}
            {/* Botão remover - sempre no canto quando editable e tem imagem */}
            {editable && onRemove && hasImage && !uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                disabled={uploading}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-err/90 flex items-center justify-center text-sm text-bg hover:bg-err transition-colors z-20 disabled:opacity-50 disabled:pointer-events-none drop-shadow-lg"
                aria-label="Remover imagem"
              >
                <Trash size={14} weight="bold" />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 z-20">
                <span className="text-xs text-txt animate-pulse drop-shadow-lg">Enviando…</span>
              </div>
            )}
          </>
        ) : (
          // Sem imagem - área de drop/upload
          <>
            {initials && (
              <span className="flex items-center justify-center w-full h-full bg-surf text-txt font-medium text-xl uppercase tracking-tighter">
                {initials}
              </span>
            )}
            {!initials && (
              <>
                {editable ? (
                  <div className="flex flex-col items-center justify-center gap-2 text-mut">
                    <Upload size={24} className="opacity-70" />
                    <span className="text-xs font-medium">{placeholder || "Adicionar imagem"}</span>
                    <span className="text-[10px] opacity-50">Clique para escolher</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 text-mut/50">
                    <Upload size={24} />
                    <span className="text-xs font-medium">{placeholder || "Sem imagem"}</span>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {/* File input oculto - só usado quando não tem imagem e clica */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={!editable || uploading}
          onChange={handleFileSelect}
        />
      </div>

      {error && <p className="text-xs text-err">{error}</p>}

      {uploading && <p className="text-xs text-mut italic animate-pulse">Processando…</p>}

      <ImageEditor
        open={editorOpen}
        imageSrc={displaySrc || null}
        title={editTitle || `Editar ${label}`}
        aspect={aspect}
        outputWidth={outputSize.width}
        outputHeight={outputSize.height}
        onConfirm={handleEditorConfirm}
        onClose={handleEditorClose}
        userId={myUserId}
      />
    </div>
  )
}

export default ImageUploadWithEdit