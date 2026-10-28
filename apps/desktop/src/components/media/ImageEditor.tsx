"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { X } from "@phosphor-icons/react"
import ReactCrop, { Crop, PixelCrop, PercentCrop } from "react-image-crop"
import { mxcToHttp } from "@/lib/media/mxc"

export interface ImageEditorProps {
  open: boolean
  imageSrc: string | null
  title?: string
  aspect?: number
  minZoom?: number
  maxZoom?: number
  onConfirm: (croppedFile: File) => void
  onClose: () => void
  userId?: string
}

function getCroppedImg(
  imageSrc: string,
  crop: Crop,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  zoom: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // URLs mxc:// do Matrix não são entendidas pelo navegador; converte para HTTP
    const src = imageSrc.startsWith("mxc://") ? mxcToHttp(imageSrc) ?? imageSrc : imageSrc
    image.src = src
    if (!src.startsWith("blob:") && !src.startsWith("data:")) {
      image.crossOrigin = "anonymous"
    }
    image.onload = () => {
      const canvas = document.createElement("canvas")
      const scaleX = image.naturalWidth / image.width
      const scaleY = image.naturalHeight / image.height
      void scaleX
      void scaleY
      
      // O crop vem em % ou px; converter para pixels da imagem original
      let cropX: number, cropY: number, cropW: number, cropH: number
      if (crop.unit === "%") {
        cropX = (crop.x / 100) * image.naturalWidth
        cropY = (crop.y / 100) * image.naturalHeight
        cropW = (crop.width / 100) * image.naturalWidth
        cropH = (crop.height / 100) * image.naturalHeight
      } else {
        cropX = crop.x * (image.naturalWidth / image.width)
        cropY = crop.y * (image.naturalHeight / image.height)
        cropW = crop.width * (image.naturalWidth / image.width)
        cropH = crop.height * (image.naturalHeight / image.height)
      }

      // Aplicar zoom inverso no crop (já que a imagem display está com zoom)
      const displayCropX = cropX / zoom
      const displayCropY = cropY / zoom
      const displayCropW = cropW / zoom
      const displayCropH = cropH / zoom

      canvas.width = displayCropW
      canvas.height = displayCropH
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        reject(new Error("Não foi possível criar contexto do canvas"))
        return
      }

      ctx.save()

      // Aplicar flip do display (visual)
      if (flipH || flipV) {
        ctx.translate(canvas.width, canvas.height)
        if (flipH) ctx.scale(-1, 1)
        if (flipV) ctx.scale(1, -1)
      }

      // Aplicar rotação
      if (rotation !== 0) {
        const rad = (rotation * Math.PI) / 180
        ctx.translate(canvas.width / 2, canvas.height / 2)
        ctx.rotate(rad)
        ctx.translate(-canvas.width / 2, -canvas.height / 2)
      }

      ctx.drawImage(
        image,
        displayCropX,
        displayCropY,
        displayCropW,
        displayCropH,
        0,
        0,
        canvas.width,
        canvas.height,
      )

      ctx.restore()

      resolve(canvas.toDataURL("image/png"))
    }
    image.onerror = () => reject(new Error("Falha ao carregar imagem para corte"))
  })
}

const ImageEditor = memo(function ImageEditor({
  open,
  imageSrc,
  title = "Editar imagem",
  aspect = 1,
  minZoom = 1,
  maxZoom = 3,
  onConfirm,
  onClose,
  userId,
}: ImageEditorProps) {
  const [crop, setCrop] = useState<Crop | undefined>({
    x: 10,
    y: 10,
    width: 80,
    height: 80,
    unit: "%"
  })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)

  const onChange = useCallback(
    (newCrop: Crop | null) => {
      if (newCrop) setCrop(newCrop)
    },
    [],
  )

const onComplete = useCallback(
    (croppedArea: PixelCrop, _percentageCrop: PercentCrop) => {
      if (croppedArea.unit === "px") {
        setCrop({ ...croppedArea, unit: "%" as const })
      }
    },
    [],
  )

  const toggleFlipH = useCallback(() => setFlipH((p) => !p), [])
  const toggleFlipV = useCallback(() => setFlipV((p) => !p), [])

  // URLs mxc:// do Matrix não são entendidas pelo navegador; converte para HTTP
  const httpSrc = useMemo(() => {
    if (!imageSrc) return null
    if (imageSrc.startsWith("mxc://")) return mxcToHttp(imageSrc) ?? imageSrc
    return imageSrc
  }, [imageSrc])

  const resetTransform = useCallback(() => {
    setCrop({ x: 10, y: 10, width: 80, height: 80, unit: "%" })
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }, [])

  useEffect(() => {
    if (!open || !imageSrc) {
      setCrop({ x: 10, y: 10, width: 80, height: 80, unit: "%" })
      setZoom(1)
      setRotation(0)
      setFlipH(false)
      setFlipV(false)
      setIsMaximized(false)
      setError(null)
      setIsLoading(false)
    }
  }, [open, imageSrc])

  const confirmCrop = useCallback(async () => {
    if (!imageSrc || !crop) {
      console.log("[ImageEditor] confirmCrop ignorado: imageSrc=", !!imageSrc, "crop=", !!crop)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log("[ImageEditor] confirmCrop iniciado para:", imageSrc, "crop:", crop)

      const croppedImg = await getCroppedImg(imageSrc, crop, rotation, flipH, flipV, zoom)
      const response = await fetch(croppedImg)
      const blob = await response.blob()
      const userIdPart = userId ? `-${userId.replace(/[@:]/g, "")}` : ""
      const file = new File([blob], `edited-image${userIdPart}.png`, { type: "image/png" })

      console.log("[ImageEditor] File criado:", file.name, file.size, "bytes", file.type)
      onConfirm(file)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha desconhecida"
      console.error("[ImageEditor] Erro no confirmCrop:", msg)
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [imageSrc, crop, rotation, flipH, flipV, onConfirm, onClose, userId])

  const aspectRatio = useMemo(() => (aspect > 0 ? aspect : 1), [aspect])

  if (!open || !imageSrc) return null

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center bg-black/80 ${isMaximized ? "" : "overflow-hidden"}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-2xl max-h-[85vh] rounded-xl border border-bd bg-surf p-6 shadow-2xl flex flex-col transition-all duration-300 ${isMaximized ? "max-w-full max-h-full" : ""}`}
      >
        <header className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-txt">{title}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={resetTransform}
              className="cursor-pointer px-2 py-1 rounded bg-surf2 border border-bd text-xs text-mut hover:bg-surf transition-colors"
              title="Redefinir"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((p) => !p)}
              className="cursor-pointer px-2 py-1 rounded bg-surf2 border border-bd text-xs text-mut hover:bg-surf transition-colors"
              title={isMaximized ? "Minimizar" : "Tela cheia"}
            >
              {isMaximized ? "⊖" : "⛶"}
            </button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="cursor-pointer rounded p-1 text-mut hover:bg-surf hover:text-txt active:scale-95"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center bg-bg rounded-xl border border-bd relative overflow-hidden min-h-[300px]">
          <div className="w-full max-w-[500px] max-h-[500px] flex items-center justify-center bg-bg rounded-xl border border-bd relative overflow-hidden">
            <ReactCrop
              crop={crop}
              aspect={aspectRatio}
              onChange={onChange}
              onComplete={onComplete}
              ruleOfThirds
              style={{ width: "100%", height: "100%" }}
            >
              <img
                src={httpSrc ?? ""}
                alt="Imagem para recorte"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  display: "block",
                  transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  transformOrigin: "center",
                }}
              />
            </ReactCrop>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(minZoom, z - 0.1))}
              disabled={zoom <= minZoom}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-xs text-txt w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(maxZoom, z + 0.1))}
              disabled={zoom >= maxZoom}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => r - 90)}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Rotacionar esquerda"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => r + 90)}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Rotacionar direita"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={toggleFlipH}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Espelhar horizontal"
            >
              ↔
            </button>
            <button
              type="button"
              onClick={toggleFlipV}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Espelhar vertical"
            >
              ↕
            </button>
          </div>

          <div className="flex-1" />

          {error && (
            <p className="text-xs text-err">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-3 py-2 rounded-lg bg-transparent border border-bd text-mut hover:bg-surf2 transition-colors active:scale-95"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={!crop || isLoading}
              className="cursor-pointer px-3 py-2 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Processando…" : "Confirmar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
})

export default ImageEditor