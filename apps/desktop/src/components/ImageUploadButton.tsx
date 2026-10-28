"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Upload, Image as ImageIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useImageUploadWithMatrix } from "@/lib/appwrite/useImageUploadWithMatrix"
import ImageEditor from "@/components/media/ImageEditor"
import { mxcToHttp } from "@/lib/media/mxc"

export interface ImageUploadButtonProps {
  currentUrl?: string | null
  onUpload: (url: string) => void
  onRemove?: () => void
  label?: string
  accept?: string
  previewSize?: "sm" | "md" | "lg"
  className?: string
  disabled?: boolean
  aspect?: number
  editTitle?: string
}

const ImageUploadButton = memo(function ImageUploadButton({
  currentUrl,
  onUpload,
  onRemove,
  label,
  accept = "image/*",
  previewSize = "md",
  className,
  disabled = false,
  aspect = 1,
  editTitle,
}: ImageUploadButtonProps) {
  const { uploadAvatar, uploadBanner, uploading } = useImageUploadWithMatrix()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewObjUrl, setPreviewObjUrl] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const sizeConfig: Record<string, { w: string; h: string }> = {
    sm: { w: "w-12", h: "h-12" },
    md: { w: "w-24", h: "h-24" },
    lg: { w: "w-32", h: "h-32" },
  }
  const { w, h } = sizeConfig[previewSize]

  useEffect(() => {
    return () => {
      if (previewObjUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }
    }
  }, [previewObjUrl])

  const displaySrc = useMemo(() => {
    if (previewObjUrl) return previewObjUrl
    if (currentUrl) {
      // URLs mxc:// do Matrix não são entendidas pelo navegador; converte para HTTP
      if (currentUrl.startsWith("mxc://")) {
        return mxcToHttp(currentUrl) ?? currentUrl
      }
      return currentUrl
    }
    return null
  }, [previewObjUrl, currentUrl])

  const hasImage = useMemo(() => Boolean(displaySrc), [displaySrc])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!file.type.startsWith("image/")) {
        setEditError("Selecione um arquivo de imagem válido.")
        return
      }

      if (previewObjUrl) {
        URL.revokeObjectURL(previewObjUrl)
      }

      setSelectedFile(file)
      setEditError(null)

      const url = URL.createObjectURL(file)
      setPreviewObjUrl(url)
      setEditorOpen(true)
    },
    [],
  )

  const handleEditorConfirm = useCallback(
    async (croppedFile: File) => {
      setEditError(null)
      try {
        // Avatar (aspect 1) ou Banner (16:9)
        const isBanner = aspect !== 1
        const url = isBanner
          ? await uploadBanner(croppedFile)
          : await uploadAvatar(croppedFile)

        onUpload(url)
        setSelectedFile(null)
        setPreviewObjUrl(null)
        setEditorOpen(false)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Falha no upload"
        setEditError(msg)
      }
    },
    [onUpload],
  )

  const handleEditorClose = useCallback(() => {
    setEditorOpen(false)
    setSelectedFile(null)
    setPreviewObjUrl(null)
  }, [])

  const handleRemove = useCallback(async () => {
    if (currentUrl && onRemove) {
      try {
        // TODO: implementar remoção no Matrix se necessário
      } catch {
        // falha silenciosa na remoção
      }
      onRemove()
    }
    setSelectedFile(null)
    setPreviewObjUrl(null)
  }, [onRemove])

  const openEditor = useCallback(() => setEditorOpen(true), [])

  return (
    <div className={`relative inline-flex flex-col items-center gap-2 ${className ?? ""}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={handleFileSelect}
      />

      <div
        className={`relative group`}
        onClick={disabled ? undefined : openEditor}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !disabled) openEditor()
        }}
      >
        {hasImage ? (
          <>
            <img
              src={displaySrc!}
              alt="Prévia"
              className={`rounded-full object-cover border border-bd ${w} ${h} shrink-0`}
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />

            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors opacity-0 group-hover:opacity-100">
              <ImageIcon size={16} className="text-white mb-1" />
              <span className="text-[10px] text-white font-medium">
                {selectedFile ? "Confirmar edição" : "Editar imagem"}
              </span>
            </div>

            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                disabled={uploading}
                className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-err text-bg hover:bg-err/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Remover imagem"
              >
                <span className="text-[10px]">×</span>
              </button>
            )}

            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                <span className="text-xs text-txt animate-pulse">Enviando…</span>
              </div>
            )}
          </>
        ) : (
          <div className={`flex items-center justify-center rounded-full border-2 border-bd border-dashed bg-surf2 ${w} ${h} shrink-0 hover:border-acc transition-colors`}>
            <Upload size={14} className="text-mut" />
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading || disabled}
        className="text-mut hover:text-acc disabled:opacity-50"
      >
        <Upload size={14} />
      </Button>

      {editError && (
        <span className="text-[10px] text-err">{editError}</span>
      )}

      <ImageEditor
        open={editorOpen}
        imageSrc={previewObjUrl || currentUrl || null}
        title={editTitle || `Editar ${label || "imagem"}`}
        aspect={aspect}
        onConfirm={handleEditorConfirm}
        onClose={handleEditorClose}
      />
    </div>
  )
})

export default ImageUploadButton
