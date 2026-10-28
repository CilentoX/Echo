"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { X } from "@phosphor-icons/react"
import { mxcToHttp } from "@/lib/media/mxc"

export interface ImageEditorProps {
  open: boolean
  imageSrc: string | null
  title?: string
  aspect?: number
  /** Tamanho de saída final em pixels */
  outputWidth?: number
  outputHeight?: number
  onConfirm: (croppedFile: File) => void
  onClose: () => void
  userId?: string
}

interface DragState {
  isDragging: boolean
  startX: number
  startY: number
  translateX: number
  translateY: number
}

/**
 * Editor de imagem estilo WhatsApp/Discord:
 * - Frame fixo com aspect ratio
 * - Arraste a imagem (não o crop box)
 * - Zoom com scroll/pinch
 * - Grade de regra dos terços
 * - Rotação e flip
 */
const ImageEditor = memo(function ImageEditor({
  open,
  imageSrc,
  title = "Editar imagem",
  aspect = 1,
  outputWidth,
  outputHeight,
  onConfirm,
  onClose,
  userId,
}: ImageEditorProps) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    translateX: 0,
    translateY: 0,
  })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calcula o tamanho do frame fixo baseado no aspect ratio
  const frameSize = useMemo(() => {
    const maxW = isMaximized ? 900 : 500
    const maxH = isMaximized ? 700 : 500
    
    if (aspect >= 1) {
      // Landscape ou quadrado
      const width = Math.min(maxW, maxH * aspect)
      const height = width / aspect
      return { width, height }
    } else {
      // Portrait
      const height = Math.min(maxH, maxW / aspect)
      const width = height * aspect
      return { width, height }
    }
  }, [aspect, isMaximized])

  // URLs mxc:// do Matrix não são entendidas pelo navegador; converte para HTTP
  const httpSrc = useMemo(() => {
    if (!imageSrc) return null
    if (imageSrc.startsWith("mxc://")) return mxcToHttp(imageSrc) ?? imageSrc
    return imageSrc
  }, [imageSrc])

  const resetTransform = useCallback(() => {
    setDragState({ isDragging: false, startX: 0, startY: 0, translateX: 0, translateY: 0 })
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
  }, [])

  useEffect(() => {
    if (!open || !imageSrc) {
      resetTransform()
      setImageLoaded(false)
      setError(null)
      setIsLoading(false)
      setIsMaximized(false)
    }
  }, [open, imageSrc, resetTransform])

  // Inicializa posição centralizada quando a imagem carrega
  useEffect(() => {
    if (imageLoaded && imgRef.current && containerRef.current) {
      const img = imgRef.current
      const container = containerRef.current
      
      // Calcula zoom inicial para preencher o frame
      const imgAspect = img.naturalWidth / img.naturalHeight
      let initialZoom = 1
      
      if (imgAspect > aspect) {
        // Imagem mais larga que o frame - ajusta pela altura
        initialZoom = frameSize.height / img.naturalHeight
      } else {
        // Imagem mais alta que o frame - ajusta pela largura
        initialZoom = frameSize.width / img.naturalWidth
      }
      
      // Garante zoom mínimo para cobrir todo o frame
      const minZoom = Math.max(
        frameSize.width / img.naturalWidth,
        frameSize.height / img.naturalHeight
      )
      setZoom(Math.max(initialZoom, minZoom))
      
      // Centraliza
      setDragState(prev => ({
        ...prev,
        translateX: 0,
        translateY: 0,
      }))
    }
  }, [imageLoaded, frameSize, aspect])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (e.button !== 0) return // Only left click
    e.preventDefault()
    setDragState(prev => ({
      ...prev,
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
    }))
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging) return
    e.preventDefault()
    const dx = (e.clientX - dragState.startX) / zoom
    const dy = (e.clientY - dragState.startY) / zoom
    setDragState(prev => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
      startX: e.clientX,
      startY: e.clientY,
    }))
  }, [dragState, zoom])

  const handleMouseUp = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }))
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(prev => Math.max(1, Math.min(5, prev + delta)))
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setDragState(prev => ({
        ...prev,
        isDragging: true,
        startX: touch.clientX,
        startY: touch.clientY,
      }))
    } else if (e.touches.length === 2) {
      // Pinch zoom - handled by wheel for now
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLImageElement>) => {
    if (!dragState.isDragging || e.touches.length !== 1) return
    e.preventDefault()
    const touch = e.touches[0]
    const dx = (touch.clientX - dragState.startX) / zoom
    const dy = (touch.clientY - dragState.startY) / zoom
    setDragState(prev => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
      startX: touch.clientX,
      startY: touch.clientY,
    }))
  }, [dragState, zoom])

  const handleTouchEnd = useCallback(() => {
    setDragState(prev => ({ ...prev, isDragging: false }))
  }, [])

  const toggleFlipH = useCallback(() => setFlipH(prev => !prev), [])
  const toggleFlipV = useCallback(() => setFlipV(prev => !prev), [])

  const confirmCrop = useCallback(async () => {
    if (!imageSrc || !imgRef.current) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const img = imgRef.current
      const container = containerRef.current
      
      if (!container) {
        throw new Error("Container não encontrado")
      }

      // Calcula a área do frame em pixels da imagem original
      const frameRect = container.getBoundingClientRect()
      const imgAspect = img.naturalWidth / img.naturalHeight
      
      // O frame tem tamanho fixo frameSize
      // A imagem está transformada com translateX, translateY, zoom, rotation, flip
      // Precisamos calcular qual parte da imagem original está visível no frame
      
      // Cria canvas do tamanho de saída
      const canvas = document.createElement("canvas")
      canvas.width = outputWidth ?? frameSize.width
      canvas.height = outputHeight ?? frameSize.height
      const ctx = canvas.getContext("2d")

      if (!ctx) {
        throw new Error("Não foi possível criar contexto do canvas")
      }

      ctx.save()

      // Centraliza o canvas
      ctx.translate(canvas.width / 2, canvas.height / 2)

      // Aplicar flip
      if (flipH || flipV) {
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      }

      // Aplicar rotação
      if (rotation !== 0) {
        const rad = (rotation * Math.PI) / 180
        ctx.rotate(rad)
      }

      // Calcula escala: zoom atual * (tamanho do canvas / tamanho do frame)
      const scaleX = zoom * (canvas.width / frameSize.width)
      const scaleY = zoom * (canvas.height / frameSize.height)

      // Desenha a imagem
      ctx.drawImage(
        img,
        -canvas.width / (2 * scaleX) - dragState.translateX / scaleX,
        -canvas.height / (2 * scaleY) - dragState.translateY / scaleY,
        img.naturalWidth / scaleX,
        img.naturalHeight / scaleY
      )

      ctx.restore()

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error("Falha ao gerar blob")
        }
        const userIdPart = userId ? `-${userId.replace(/[@:]/g, "")}` : ""
        const file = new File([blob], `edited-image${userIdPart}.png`, { type: "image/png" })
        onConfirm(file)
        onClose()
        setIsLoading(false)
      }, "image/png", 0.92)

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha desconhecida"
      console.error("[ImageEditor] Erro no confirmCrop:", msg)
      setError(msg)
      setIsLoading(false)
    }
  }, [
    imageSrc, 
    outputWidth, 
    outputHeight, 
    frameSize, 
    zoom, 
    dragState.translateX, 
    dragState.translateY, 
    rotation, 
    flipH, 
    flipV, 
    onConfirm, 
    onClose, 
    userId
  ])

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
              title="Redefinir (R)"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(prev => !prev)}
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
          <div 
            ref={containerRef}
            className="flex items-center justify-center bg-bg rounded-xl border border-bd relative overflow-hidden"
            style={{ width: frameSize.width, height: frameSize.height }}
          >
            {/* Grade de regra dos terços */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ 
                backgroundImage: `
                  linear-gradient(to right, transparent 33.33%, rgba(255,255,255,0.15) 33.33%, rgba(255,255,255,0.15) 33.34%, transparent 33.34%),
                  linear-gradient(to right, transparent 66.66%, rgba(255,255,255,0.15) 66.66%, rgba(255,255,255,0.15) 66.67%, transparent 66.67%),
                  linear-gradient(to bottom, transparent 33.33%, rgba(255,255,255,0.15) 33.33%, rgba(255,255,255,0.15) 33.34%, transparent 33.34%),
                  linear-gradient(to bottom, transparent 66.66%, rgba(255,255,255,0.15) 66.66%, rgba(255,255,255,0.15) 66.67%, transparent 66.67%)
                `
              }}
            />
            
            <img
              ref={imgRef}
              src={httpSrc ?? ""}
              alt="Imagem para edição"
              onLoad={handleImageLoad}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onWheel={handleWheel}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
                transform: `translate(${dragState.translateX}px, ${dragState.translateY}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                transformOrigin: "center",
                transition: isLoading ? "none" : "transform 0.1s ease-out",
                cursor: dragState.isDragging ? "grabbing" : "grab",
              }}
            />
            
            {/* Overlay de borda do frame */}
            <div className="absolute inset-0 border-2 border-acc/50 pointer-events-none" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom(prev => Math.max(1, prev - 0.1))}
              disabled={zoom <= 1}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              title="Zoom out (− / Scroll down)"
            >
              −
            </button>
            <span className="text-xs text-txt w-8 text-center">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}
              disabled={zoom >= 5}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              title="Zoom in (+ / Scroll up)"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRotation(prev => prev - 90)}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Rotacionar esquerda (←)"
            >
              ↺
            </button>
            <button
              type="button"
              onClick={() => setRotation(prev => prev + 90)}
              className="cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd text-mut hover:bg-surf hover:text-txt transition-colors active:scale-95"
              title="Rotacionar direita (→)"
            >
              ↻
            </button>
            <button
              type="button"
              onClick={toggleFlipH}
              className={`cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd ${flipH ? "bg-acc/20 text-acc" : "text-mut"} hover:bg-surf hover:text-txt transition-colors active:scale-95`}
              title="Espelhar horizontal (H)"
            >
              ↔
            </button>
            <button
              type="button"
              onClick={toggleFlipV}
              className={`cursor-pointer px-3 py-2 rounded-lg bg-surf2 border border-bd ${flipV ? "bg-acc/20 text-acc" : "text-mut"} hover:bg-surf hover:text-txt transition-colors active:scale-95`}
              title="Espelhar vertical (V)"
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
              disabled={isLoading}
              className="cursor-pointer px-3 py-2 rounded-lg bg-acc py-2.5 font-display font-semibold text-bg transition-colors hover:bg-acc-press active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Processando…" : "Confirmar"}
            </button>
          </div>
        </div>
        
        {/* Dicas de atalhos */}
        <p className="mt-3 text-xs text-mut text-center">
          Arraste a imagem • Scroll para zoom • R/Shift+R: rotacionar • H/V: espelhar • Esc: cancelar
        </p>
      </div>
    </div>
  )
})

export default ImageEditor