"use client"

import { useState, useCallback } from "react"
import { matrixService } from "@/lib/matrix/instance"
import { uploadImage } from "@/lib/api/storage"
import { useProfileStore } from "@/stores/profileStore"

export interface UseImageUploadWithMatrixReturn {
  uploadAvatar: (file: File) => Promise<string>
  uploadBanner: (file: File) => Promise<string>
  uploading: boolean
  error: string | null
}

/**
 * Hook para upload de imagem com sincronização completa:
 * 1. Upload no Appwrite (CDN/backup)
 * 2. Download do Appwrite
 * 3. Upload no Matrix (mxc:// URI)
 * 4. Atualiza avatar_url/banner_url no perfil Matrix via account API
 * 5. Atualiza profileStore local
 */
export function useImageUploadWithMatrix(): UseImageUploadWithMatrixReturn {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { setAvatarUrl, setBannerUrl, setAppwriteAvatarUrl, setAppwriteBannerUrl } = useProfileStore()

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    setUploading(true)
    setError(null)
    try {
      console.log("[ImageUpload] Enviando avatar para Appwrite:", file.name, file.size, "bytes")
      const appwriteUrl = await uploadImage(file)
      console.log("[ImageUpload] Appwrite upload OK:", appwriteUrl)

      // Salva URL do Appwrite como fonte principal (persiste entre recarregamentos)
      setAppwriteAvatarUrl(appwriteUrl)

      // 2. Tentar upload no Matrix (best-effort: não bloqueia se falhar)
      try {
        const response = await fetch(appwriteUrl)
        if (!response.ok) {
          throw new Error(`Falha ao baixar do Appwrite: ${response.status}`)
        }
        const blob = await response.blob()
        const fileForMatrix = new File([blob], file.name, { type: file.type })

        // 3. Upload no Matrix (gera mxc:// URI)
        const mxcUri = await matrixService.uploadMedia(fileForMatrix)
        console.log("[ImageUpload] Matrix upload OK:", mxcUri)

        // 4. Atualiza avatar no Matrix via Account API
        await matrixService.setAvatarUrl(mxcUri)
        console.log("[ImageUpload] setAvatarUrl OK")

        // 5. Atualiza store local com mxc:// URI (fallback apenas)
        setAvatarUrl(mxcUri)

        console.log("[ImageUpload] Avatar sincronizado:", mxcUri)
      } catch (matrixErr) {
        console.warn("[ImageUpload] Matrix upload falhou (não bloqueia):", matrixErr)
        // Não define avatarUrl para mxc:// — mantém apenas appwriteAvatarUrl
      }

      return appwriteUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload do avatar"
      console.error("[ImageUpload] Erro no avatar:", err)
      setError(msg)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  const uploadBanner = useCallback(async (file: File): Promise<string> => {
    setUploading(true)
    setError(null)
    try {
      console.log("[ImageUpload] Enviando banner para Appwrite:", file.name, file.size, "bytes")
      const appwriteUrl = await uploadImage(file)
      console.log("[ImageUpload] Appwrite upload OK:", appwriteUrl)

      // Salva URL do Appwrite como fonte principal (persiste entre recarregamentos)
      setAppwriteBannerUrl(appwriteUrl)

      // 2. Tentar upload no Matrix (best-effort: não bloqueia se falhar)
      // Nota: banner não tem suporte global no Matrix ainda, só Appwrite
      try {
        const response = await fetch(appwriteUrl)
        if (!response.ok) {
          throw new Error(`Falha ao baixar do Appwrite: ${response.status}`)
        }
        const blob = await response.blob()
        const fileForMatrix = new File([blob], file.name, { type: file.type })

        // 3. Upload no Matrix (gera mxc:// URI) - guardado como fallback
        const mxcUri = await matrixService.uploadMedia(fileForMatrix)
        console.log("[ImageUpload] Matrix upload OK:", mxcUri)

        // 4. Atualiza store local com mxc:// (fallback apenas)
        setBannerUrl(mxcUri)

        console.log("[ImageUpload] Banner sincronizado (fallback Matrix):", mxcUri)
      } catch (matrixErr) {
        console.warn("[ImageUpload] Matrix upload falhou (não bloqueia):", matrixErr)
        // Não define bannerUrl para mxc:// — mantém apenas appwriteBannerUrl
      }

      return appwriteUrl
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha no upload do banner"
      console.error("[ImageUpload] Erro no banner:", err)
      setError(msg)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  return { uploadAvatar, uploadBanner, uploading, error }
}

// Alias para compatibilidade
export const useImageUpload = useImageUploadWithMatrix

export interface UseImageUploadReturn {
  uploadAvatar: (file: File) => Promise<string>
  uploadBanner: (file: File) => Promise<string>
  uploading: boolean
  error: string | null
}