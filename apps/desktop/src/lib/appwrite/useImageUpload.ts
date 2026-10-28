"use client"

import { useState } from "react"
import { uploadImage, deleteImage } from "./storage"

export interface UseAppwriteUploadReturn {
  upload: (file: File) => Promise<string>
  remove: (imageUrl: string) => Promise<void>
  uploading: boolean
  error: string | null
}

/** Hook para upload e remoção de imagens no Appwrite Storage. */
export function useAppwriteUpload(): UseAppwriteUploadReturn {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File): Promise<string> => {
    setUploading(true)
    setError(null)
    try {
      const url = await uploadImage(file)
      setUploading(false)
      return url
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload"
      setError(msg)
      setUploading(false)
      throw err
    }
  }

  const remove = async (imageUrl: string): Promise<void> => {
    setUploading(true)
    setError(null)
    try {
      await deleteImage(imageUrl)
      setUploading(false)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao remover imagem"
      setError(msg)
      setUploading(false)
      throw err
    }
  }

  return { upload, remove, uploading, error }
}
