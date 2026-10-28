"use client"

import ImageUploadWithEdit from "@/components/media/ImageUploadWithEdit"
import { uploadImage } from "@/lib/appwrite/storage"

interface AvatarUploadProps {
  src: string | null
  onChange: (url: string) => void
  onRemove?: () => void
  disabled?: boolean
}

export function AvatarUpload({ src, onChange, onRemove, disabled = false }: AvatarUploadProps) {
  const handleUploadFile = async (file: File) => {
    try {
      const url = await uploadImage(file)
      onChange(url)
    } catch {
      // erro é gerenciado pelo ImageUploadWithEdit
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <ImageUploadWithEdit
        value={src}
        label=""
        placeholder="Foto do perfil (PNG/JPG, até 2 MB)"
        onChange={handleUploadFile}
        onRemove={onRemove}
        aspect={1}
        previewHeight="h-24"
        editTitle="Editar foto do perfil"
        disabled={disabled}
        maxSizeMB={2}
      />
    </div>
  )
}
