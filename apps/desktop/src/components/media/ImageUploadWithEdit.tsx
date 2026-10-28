"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X, Upload, Pencil } from "@phosphor-icons/react"
import ImageEditor from "@/components/media/ImageEditor"
import { useUiStore } from "@/stores/uiStore"
import { mxcToHttp } from "@/lib/media/mxc"

export interface ImageUploadWithEditProps {
  value: string | null
  label: string
  placeholder?: string
  initials?: string
  onChange: (file: File) => void
  onRemove?: () => void
  aspect?: number
  previewHeight?: string
  editTitle?: string
  disabled?: boolean
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
  aspect = 1,
  previewHeight = "h-24",
  editTitle,
  disabled = false,
  maxSizeMB = 5,
  accept = "image/*",
  appwriteUrl = null,
}: ImageUploadWithEditProps) {
  const myUserId = useUiStore((state) => state.myUserId ?? "")
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewObjUrl, setPreviewObjUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  console.log("[ImageUploadWithEdit] render:", { value, appwriteUrl, disabled, hasImage })

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
      setUploading(true)
      setError(null)
      onChange(croppedFile)
      setSelectedFile(null)
      setPreviewObjUrl(null)
      setEditorOpen(false)
      setUploading(false)
    },
    [onChange],
  )

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false)
    // Mantém o preview e o arquivo selecionado para o usuário confirmar direto
  }, [])

  const handleRemove = useCallback(() => {
    setSelectedFile(null)
    setPreviewObjUrl(null)
    if (onRemove) onRemove()
  }, [onRemove])

  const openEditor = useCallback(() => {
    if (disabled) return
    if (!previewObjUrl && !value) return
    setEditorOpen(true)
  }, [disabled, previewObjUrl, value])

  return (
    <div className="flex flex-col gap-2">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-mut">
        {label}
      </label>

      <div
        className={`relative w-full rounded-xl border border-bd bg-surf2 flex items-center justify-center group overflow-hidden ${previewHeight} ${disabled ? "cursor-default" : "cursor-pointer"}`}
        onClick={disabled ? undefined : () => inputRef.current?.click()}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label={label}
      >
        {hasImage ? (
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
            {!disabled && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100">
                <Pencil size={16} className="text-white mb-2" />
                <span className="text-xs text-white font-medium">
                  {selectedFile ? "Confirmar edição" : "Alterar imagem"}
                </span>
              </div>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                disabled={uploading}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-err/90 flex items-center justify-center text-sm text-bg hover:bg-err transition-colors z-20 disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Remover imagem"
              >
                <X size={14} weight="bold" />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 z-20">
                <span className="text-xs text-txt animate-pulse">Enviando…</span>
              </div>
            )}
          </>
        ) : (
          <>
            {initials && (
              <span className="flex items-center justify-center w-full h-full bg-surf text-txt font-medium text-xl uppercase tracking-tighter">
                {initials}
              </span>
            )}
            {!initials && (
              <>
                <Upload size={20} className="text-mut mb-2" />
                <span className="text-xs text-mut font-medium">{placeholder || "Adicionar imagem"}</span>
              </>
            )}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled}
          onChange={handleFileSelect}
        />
      </div>

      {/* Barra de ações quando há imagem existente (sem arquivo novo selecionado) */}
      {!selectedFile && value && !uploading && !disabled && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => openEditor()}
            disabled={disabled}
            className="flex-1 text-sm font-medium border border-bd bg-bg text-txt hover:bg-surf2 active:scale-95 min-h-[36px] rounded-lg"
          >
            Editar imagem
          </button>
        </div>
      )}

      {error && <p className="text-xs text-err">{error}</p>}

      {uploading && <p className="text-xs text-mut italic animate-pulse">Processando…</p>}

      <ImageEditor
        open={editorOpen}
        imageSrc={displaySrc || null}
        title={editTitle || `Editar ${label}`}
        aspect={aspect}
        onConfirm={handleEditorConfirm}
        onClose={handleEditorClose}
        userId={myUserId}
      />
    </div>
  )
}

export default ImageUploadWithEdit
