"use client"

import { useState } from "react"
import { useEchoApi } from "@/lib/api/echoApi"
import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit"

interface AvatarUploadProps {
  src: string | null
  onChange: (url: string) => void
  onRemove?: () => void
  disabled?: boolean
}

export function AvatarUpload({ src, onChange, onRemove, disabled = false }: AvatarUploadProps) {
  const echoApi = useEchoApi()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleUploadFile = async (file: File) => {
    setUploading(true)
    setUploadError(null)
    try {
      const url = await echoApi.uploadChatMedia(file)
      onChange(url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao enviar foto do perfil"
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <ImageUploadWithEdit
        value={src}
        label=""
        type="avatar"
        placeholder="Foto"
        onChange={handleUploadFile}
        onRemove={onRemove}
        aspect={1}
        previewHeight="h-28"
        previewW="w-28"
        editTitle="Editar foto do perfil"
        editable={!disabled && !uploading}
        uploading={uploading}
        uploadError={uploadError}
        disabled={disabled}
        maxSizeMB={5}
      />
      <p className="text-xs text-mut text-center">
        Clique para escolher e recortar sua foto (até 5 MB)
      </p>
    </div>
  )
}
