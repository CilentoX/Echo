"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, ArrowsOutCardinal } from "@phosphor-icons/react"
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

interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

type DragMode =
  | null
  | { type: "move-box"; startX: number; startY: number; initialBox: CropBox }
  | { type: "resize"; handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e"; startX: number; startY: number; initialBox: CropBox }
  | { type: "pan-image"; startX: number; startY: number; initialPan: { x: number; y: number } }

/**
 * Editor de imagem profissional com sistema de resize das grades de corte (estilo Discord/WhatsApp):
 * - Grade de corte redimensionável com alças nos 4 cantos e 4 bordas
 * - Mantém aspect ratio configurado (ex: 1:1 para avatar) ou corte livre
 * - Grade interativa de regra dos terços (3x3)
 * - Máscara circular de enquadramento para avatares
 * - Área externa escurecida (dimmed vignette)
 * - Arraste da caixa de corte e pan da imagem
 * - Zoom por scroll e botões, rotação e espelhamento
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
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [dragMode, setDragMode] = useState<DragMode>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Tamanho da área do container
  const frameSize = useMemo(() => {
    const maxW = isMaximized ? 850 : 480
    const maxH = isMaximized ? 650 : 440

    if (aspect && aspect >= 1) {
      const width = Math.min(maxW, maxH * aspect)
      const height = width / aspect
      return { width, height }
    } else if (aspect && aspect < 1) {
      const height = Math.min(maxH, maxW / aspect)
      const width = height * aspect
      return { width, height }
    }
    return { width: Math.min(maxW, 480), height: Math.min(maxH, 440) }
  }, [aspect, isMaximized])

  // Estado do crop box redimensionável
  const [cropBox, setCropBox] = useState<CropBox>({
    x: 20,
    y: 20,
    width: 260,
    height: 260,
  })

  // URLs mxc:// do Matrix convertidas para HTTP
  const httpSrc = useMemo(() => {
    if (!imageSrc) return null
    if (imageSrc.startsWith("mxc://")) return mxcToHttp(imageSrc) ?? imageSrc
    return imageSrc
  }, [imageSrc])

  const isAvatar = aspect === 1

  // Inicializa a caixa de corte centralizada dentro do container
  const initCropBox = useCallback((containerW: number, containerH: number, targetAspect: number) => {
    const padding = 24
    const availW = Math.max(100, containerW - padding * 2)
    const availH = Math.max(100, containerH - padding * 2)

    let w = availW
    let h = targetAspect > 0 ? w / targetAspect : availH

    if (h > availH) {
      h = availH
      w = targetAspect > 0 ? h * targetAspect : availW
    }

    // Default: ocupa cerca de 85% do espaço disponível
    w = Math.round(w * 0.9)
    h = Math.round(h * 0.9)

    const x = Math.round((containerW - w) / 2)
    const y = Math.round((containerH - h) / 2)

    setCropBox({ x, y, width: w, height: h })
  }, [])

  const resetTransform = useCallback(() => {
    setPan({ x: 0, y: 0 })
    setZoom(1)
    setRotation(0)
    setFlipH(false)
    setFlipV(false)
    initCropBox(frameSize.width, frameSize.height, aspect)
  }, [frameSize, aspect, initCropBox])

  useEffect(() => {
    if (!open || !imageSrc) {
      resetTransform()
      setImageLoaded(false)
      setError(null)
      setIsLoading(false)
      setIsMaximized(false)
    } else {
      initCropBox(frameSize.width, frameSize.height, aspect)
    }
  }, [open, imageSrc, frameSize, aspect, initCropBox, resetTransform])

  // Centraliza e ajusta imagem ao carregar
  useEffect(() => {
    if (imageLoaded && imgRef.current) {
      const img = imgRef.current
      const imgAspect = img.naturalWidth / img.naturalHeight
      let initialZoom = 1

      if (aspect > 0) {
        if (imgAspect > aspect) {
          initialZoom = frameSize.height / img.naturalHeight
        } else {
          initialZoom = frameSize.width / img.naturalWidth
        }
      }
      setZoom(Math.max(1, Number(initialZoom.toFixed(2))))
      setPan({ x: 0, y: 0 })
      initCropBox(frameSize.width, frameSize.height, aspect)
    }
  }, [imageLoaded, frameSize, aspect, initCropBox])

  // Zoom nativo no container com scroll (sem warning de passive listener)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((prev) => Math.max(1, Math.min(5, Number((prev + delta).toFixed(2)))))
    }

    el.addEventListener("wheel", handleWheelNative, { passive: false })
    return () => {
      el.removeEventListener("wheel", handleWheelNative)
    }
  }, [open, imageSrc])

  // Início de arrasto de alça de resize
  const handleResizeStart = (
    handle: "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e",
    e: React.MouseEvent
  ) => {
    e.stopPropagation()
    e.preventDefault()
    setDragMode({
      type: "resize",
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
    })
  }

  // Início de movimento da caixa de corte
  const handleBoxMoveStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    setDragMode({
      type: "move-box",
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...cropBox },
    })
  }

  // Início de pan da imagem ao clicar fora da caixa
  const handleImagePanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setDragMode({
      type: "pan-image",
      startX: e.clientX,
      startY: e.clientY,
      initialPan: { ...pan },
    })
  }

  // Handler de movimento global (janela) enquanto arrasta
  useEffect(() => {
    if (!dragMode) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragMode.startX
      const dy = e.clientY - dragMode.startY

      if (dragMode.type === "pan-image") {
        setPan({
          x: dragMode.initialPan.x + dx,
          y: dragMode.initialPan.y + dy,
        })
        return
      }

      const { initialBox } = dragMode
      const minSize = 48
      const maxContainerW = frameSize.width
      const maxContainerH = frameSize.height

      if (dragMode.type === "move-box") {
        const newX = Math.max(0, Math.min(maxContainerW - initialBox.width, initialBox.x + dx))
        const newY = Math.max(0, Math.min(maxContainerH - initialBox.height, initialBox.y + dy))
        setCropBox((prev) => ({ ...prev, x: newX, y: newY }))
        return
      }

      if (dragMode.type === "resize") {
        const { handle } = dragMode

        if (aspect > 0) {
          // Redimensionamento proporcional (1:1 ou aspect fixo)
          let delta = 0
          if (handle === "se") {
            delta = Math.max(dx, dy * aspect)
            const maxW = Math.min(maxContainerW - initialBox.x, (maxContainerH - initialBox.y) * aspect)
            const newW = Math.max(minSize, Math.min(maxW, initialBox.width + delta))
            setCropBox({
              x: initialBox.x,
              y: initialBox.y,
              width: newW,
              height: newW / aspect,
            })
          } else if (handle === "nw") {
            delta = Math.min(dx, dy * aspect)
            const maxAllowed = Math.min(initialBox.x + initialBox.width, (initialBox.y + initialBox.height) * aspect)
            const newW = Math.max(minSize, Math.min(maxAllowed, initialBox.width - delta))
            const newH = newW / aspect
            setCropBox({
              x: initialBox.x + (initialBox.width - newW),
              y: initialBox.y + (initialBox.height - newH),
              width: newW,
              height: newH,
            })
          } else if (handle === "ne") {
            delta = dx
            const maxAllowedW = Math.min(maxContainerW - initialBox.x, (initialBox.y + initialBox.height) * aspect)
            const newW = Math.max(minSize, Math.min(maxAllowedW, initialBox.width + delta))
            const newH = newW / aspect
            setCropBox({
              x: initialBox.x,
              y: initialBox.y + (initialBox.height - newH),
              width: newW,
              height: newH,
            })
          } else if (handle === "sw") {
            delta = -dx
            const maxAllowedW = Math.min(initialBox.x + initialBox.width, (maxContainerH - initialBox.y) * aspect)
            const newW = Math.max(minSize, Math.min(maxAllowedW, initialBox.width + delta))
            const newH = newW / aspect
            setCropBox({
              x: initialBox.x + (initialBox.width - newW),
              y: initialBox.y,
              width: newW,
              height: newH,
            })
          } else if (handle === "e" || handle === "s") {
            const d = handle === "e" ? dx : dy * aspect
            const maxW = Math.min(maxContainerW - initialBox.x, (maxContainerH - initialBox.y) * aspect)
            const newW = Math.max(minSize, Math.min(maxW, initialBox.width + d))
            setCropBox({
              x: initialBox.x,
              y: initialBox.y,
              width: newW,
              height: newW / aspect,
            })
          } else if (handle === "w" || handle === "n") {
            const d = handle === "w" ? -dx : -dy * aspect
            const maxAllowed = Math.min(initialBox.x + initialBox.width, (initialBox.y + initialBox.height) * aspect)
            const newW = Math.max(minSize, Math.min(maxAllowed, initialBox.width + d))
            const newH = newW / aspect
            setCropBox({
              x: initialBox.x + (initialBox.width - newW),
              y: initialBox.y + (initialBox.height - newH),
              width: newW,
              height: newH,
            })
          }
        } else {
          // Redimensionamento livre
          let newX = initialBox.x
          let newY = initialBox.y
          let newW = initialBox.width
          let newH = initialBox.height

          if (handle.includes("e")) newW = Math.max(minSize, Math.min(maxContainerW - initialBox.x, initialBox.width + dx))
          if (handle.includes("s")) newH = Math.max(minSize, Math.min(maxContainerH - initialBox.y, initialBox.height + dy))
          if (handle.includes("w")) {
            const candidateW = initialBox.width - dx
            if (candidateW >= minSize && initialBox.x + dx >= 0) {
              newW = candidateW
              newX = initialBox.x + dx
            }
          }
          if (handle.includes("n")) {
            const candidateH = initialBox.height - dy
            if (candidateH >= minSize && initialBox.y + dy >= 0) {
              newH = candidateH
              newY = initialBox.y + dy
            }
          }

          setCropBox({ x: newX, y: newY, width: newW, height: newH })
        }
      }
    }

    const handleMouseUp = () => {
      setDragMode(null)
    }

    window.addEventListener("mousemove", handleMouseMove)
    window.addEventListener("mouseup", handleMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleMouseUp)
    }
  }, [dragMode, aspect, frameSize])

  // Atalhos de teclado (R: girar, H/V: flip, Esc: fechar, Enter: confirmar)
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      else if (e.key === "r" || e.key === "R") setRotation((prev) => (e.shiftKey ? prev - 90 : prev + 90))
      else if (e.key === "h" || e.key === "H") setFlipH((prev) => !prev)
      else if (e.key === "v" || e.key === "V") setFlipV((prev) => !prev)
      else if (e.key === "Enter" && !isLoading) confirmCrop()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, isLoading, onClose])

  const confirmCrop = useCallback(async () => {
    if (!imageSrc || !imgRef.current) return

    setIsLoading(true)
    setError(null)

    try {
      const img = imgRef.current
      const container = containerRef.current
      if (!container) throw new Error("Container não encontrado")

      // Cria canvas com resolução do tamanho final
      const outW = outputWidth ?? Math.round(cropBox.width)
      const outH = outputHeight ?? Math.round(cropBox.height)

      const canvas = document.createElement("canvas")
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext("2d")

      if (!ctx) throw new Error("Não foi possível criar contexto 2D")

      ctx.save()

      // Escala entre a caixa de corte da tela e o canvas final
      const scaleX = canvas.width / cropBox.width
      const scaleY = canvas.height / cropBox.height
      ctx.scale(scaleX, scaleY)

      // Move o ponto (0, 0) para o canto superior-esquerdo da caixa de corte
      ctx.translate(-cropBox.x, -cropBox.y)

      // Posiciona o centro da imagem no container
      const imgCenterX = frameSize.width / 2 + pan.x
      const imgCenterY = frameSize.height / 2 + pan.y
      ctx.translate(imgCenterX, imgCenterY)

      // Rotação e flip
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180)
      }
      if (flipH || flipV) {
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
      }

      // Renderiza a imagem
      const displayedW = img.width * zoom
      const displayedH = img.height * zoom
      ctx.drawImage(img, -displayedW / 2, -displayedH / 2, displayedW, displayedH)

      ctx.restore()

      canvas.toBlob(
        async (blob) => {
          if (!blob) throw new Error("Falha ao gerar arquivo de imagem")
          const userIdPart = userId ? `-${userId.replace(/[@:]/g, "")}` : ""
          const file = new File([blob], `edited-image${userIdPart}.png`, { type: "image/png" })
          onConfirm(file)
          onClose()
          setIsLoading(false)
        },
        "image/png",
        0.95
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao processar imagem"
      console.error("[ImageEditor] Erro no confirmCrop:", msg)
      setError(msg)
      setIsLoading(false)
    }
  }, [imageSrc, outputWidth, outputHeight, cropBox, frameSize, pan, zoom, rotation, flipH, flipV, onConfirm, onClose, userId])

  if (!open || !imageSrc) return null

  const modalNode = (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/80 backdrop-blur-sm select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`w-full max-w-2xl max-h-[88vh] rounded-2xl border border-[#242B3D] bg-[#131722] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.85)] flex flex-col transition-all duration-200 ${
          isMaximized ? "max-w-full max-h-full h-full rounded-none" : ""
        }`}
      >
        {/* Cabeçalho */}
        <header className="flex items-center justify-between pb-3 border-b border-[#242B3D]">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-bold text-[#E9EDF2]">{title}</h2>
            <span className="text-[11px] text-[#0FB9A8] bg-[#0FB9A8]/10 px-2 py-0.5 rounded-full font-medium">
              {isAvatar ? "Avatar 1:1" : `${Math.round(cropBox.width)} × ${Math.round(cropBox.height)}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetTransform}
              className="px-2.5 py-1 rounded-lg bg-[#1A202E] border border-[#242B3D] text-xs text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer"
              title="Redefinir corte e zoom (R)"
            >
              ↺ Redefinir
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="px-2 py-1 rounded-lg bg-[#1A202E] border border-[#242B3D] text-xs text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer"
              title={isMaximized ? "Restaurar tamanho" : "Maximizar"}
            >
              {isMaximized ? "⊖" : "⛶"}
            </button>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#242B3D] hover:text-[#E9EDF2] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Viewport de Edição com Grade Interativa de Corte */}
        <div className="flex-1 flex items-center justify-center bg-[#090C12] rounded-xl border border-[#242B3D]/70 relative overflow-hidden my-3 min-h-[320px]">
          <div
            ref={containerRef}
            className="relative overflow-hidden cursor-crosshair select-none"
            style={{ width: frameSize.width, height: frameSize.height }}
            onMouseDown={handleImagePanStart}
          >
            {/* Imagem Sendo Editada */}
            <img
              ref={imgRef}
              src={httpSrc ?? ""}
              alt="Imagem para edição"
              onLoad={() => setImageLoaded(true)}
              draggable={false}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                display: "block",
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${
                  flipH ? -1 : 1
                }) scaleY(${flipV ? -1 : 1})`,
                transformOrigin: "center",
                transition: dragMode ? "none" : "transform 0.1s ease-out",
                userSelect: "none",
                pointerEvents: "none",
              }}
              className="absolute inset-0 m-auto"
            />

            {/* Áreas Escurecidas Fora da Caixa de Corte (Dimmed Vignette) */}
            <div
              className="absolute left-0 right-0 top-0 bg-[#090C12]/75 pointer-events-none transition-opacity duration-150"
              style={{ height: Math.max(0, cropBox.y) }}
            />
            <div
              className="absolute left-0 right-0 bottom-0 bg-[#090C12]/75 pointer-events-none transition-opacity duration-150"
              style={{ top: Math.max(0, cropBox.y + cropBox.height) }}
            />
            <div
              className="absolute left-0 bg-[#090C12]/75 pointer-events-none transition-opacity duration-150"
              style={{
                top: cropBox.y,
                height: cropBox.height,
                width: Math.max(0, cropBox.x),
              }}
            />
            <div
              className="absolute right-0 bg-[#090C12]/75 pointer-events-none transition-opacity duration-150"
              style={{
                top: cropBox.y,
                height: cropBox.height,
                left: Math.max(0, cropBox.x + cropBox.width),
              }}
            />

            {/* Caixa de Corte Interativa (Crop Box) */}
            <div
              className="absolute border border-[#0FB9A8] shadow-[0_0_12px_rgba(15,185,168,0.35)] cursor-move group select-none"
              style={{
                left: cropBox.x,
                top: cropBox.y,
                width: cropBox.width,
                height: cropBox.height,
              }}
              onMouseDown={handleBoxMoveStart}
            >
              {/* Máscara Circular para Avatar */}
              {isAvatar && (
                <div className="absolute inset-0 rounded-full border-2 border-[#0FB9A8] shadow-[0_0_0_9999px_rgba(9,12,18,0.45)] pointer-events-none z-10" />
              )}

              {/* Grade de Regra dos Terços (3x3) */}
              <div
                className={`absolute inset-0 pointer-events-none transition-opacity duration-200 ${
                  dragMode ? "opacity-70" : "opacity-35 hover:opacity-60"
                }`}
              >
                {/* Linhas Verticais */}
                <div className="absolute top-0 bottom-0 left-1/3 w-px border-l border-dashed border-[#0FB9A8]/70" />
                <div className="absolute top-0 bottom-0 left-2/3 w-px border-l border-dashed border-[#0FB9A8]/70" />
                {/* Linhas Horizontais */}
                <div className="absolute left-0 right-0 top-1/3 h-px border-t border-dashed border-[#0FB9A8]/70" />
                <div className="absolute left-0 right-0 top-2/3 h-px border-t border-dashed border-[#0FB9A8]/70" />
              </div>

              {/* Cantoneiras Estilizadas (L-Shaped Brackets) */}
              {/* Top-Left */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-[#0FB9A8] pointer-events-none drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]" />
              {/* Top-Right */}
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-[#0FB9A8] pointer-events-none drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]" />
              {/* Bottom-Left */}
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-[#0FB9A8] pointer-events-none drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]" />
              {/* Bottom-Right */}
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-[#0FB9A8] pointer-events-none drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]" />

              {/* Barras Centrais de Borda */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-1.5 bg-[#0FB9A8] rounded-full pointer-events-none shadow-sm" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-1.5 bg-[#0FB9A8] rounded-full pointer-events-none shadow-sm" />
              <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-1.5 bg-[#0FB9A8] rounded-full pointer-events-none shadow-sm" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-6 w-1.5 bg-[#0FB9A8] rounded-full pointer-events-none shadow-sm" />

              {/* Alças de Redimensionamento Interativas (Hit Targets Ampliados) */}
              <div
                onMouseDown={(e) => handleResizeStart("nw", e)}
                className="absolute -top-3 -left-3 w-6 h-6 cursor-nwse-resize z-20"
                title="Redimensionar canto superior-esquerdo"
              />
              <div
                onMouseDown={(e) => handleResizeStart("ne", e)}
                className="absolute -top-3 -right-3 w-6 h-6 cursor-nesw-resize z-20"
                title="Redimensionar canto superior-direito"
              />
              <div
                onMouseDown={(e) => handleResizeStart("sw", e)}
                className="absolute -bottom-3 -left-3 w-6 h-6 cursor-nesw-resize z-20"
                title="Redimensionar canto inferior-esquerdo"
              />
              <div
                onMouseDown={(e) => handleResizeStart("se", e)}
                className="absolute -bottom-3 -right-3 w-6 h-6 cursor-nwse-resize z-20"
                title="Redimensionar canto inferior-direito"
              />

              <div
                onMouseDown={(e) => handleResizeStart("n", e)}
                className="absolute -top-2 left-3 right-3 h-4 cursor-ns-resize z-20"
                title="Redimensionar topo"
              />
              <div
                onMouseDown={(e) => handleResizeStart("s", e)}
                className="absolute -bottom-2 left-3 right-3 h-4 cursor-ns-resize z-20"
                title="Redimensionar base"
              />
              <div
                onMouseDown={(e) => handleResizeStart("w", e)}
                className="absolute -left-2 top-3 bottom-3 w-4 cursor-ew-resize z-20"
                title="Redimensionar esquerda"
              />
              <div
                onMouseDown={(e) => handleResizeStart("e", e)}
                className="absolute -right-2 top-3 bottom-3 w-4 cursor-ew-resize z-20"
                title="Redimensionar direita"
              />

              {/* Indicador Central de Movimento */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none">
                <ArrowsOutCardinal size={24} className="text-[#0FB9A8]" />
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Controles Inferior */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Zoom */}
          <div className="flex items-center gap-1.5 bg-[#1A202E] p-1 rounded-xl border border-[#242B3D]">
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.max(1, Number((prev - 0.1).toFixed(2))))}
              disabled={zoom <= 1}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              title="Diminuir zoom (−)"
            >
              −
            </button>
            <span className="text-xs text-[#E9EDF2] font-semibold w-11 text-center font-mono">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((prev) => Math.min(5, Number((prev + 0.1).toFixed(2))))}
              disabled={zoom >= 5}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
              title="Aumentar zoom (+)"
            >
              +
            </button>
          </div>

          {/* Rotação e Espelhamento */}
          <div className="flex items-center gap-1 bg-[#1A202E] p-1 rounded-xl border border-[#242B3D]">
            <button
              type="button"
              onClick={() => setRotation((prev) => prev - 90)}
              className="px-2.5 h-7 rounded-lg flex items-center justify-center text-xs text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer"
              title="Girar 90° à esquerda (Shift+R)"
            >
              ↺ 90°
            </button>
            <button
              type="button"
              onClick={() => setRotation((prev) => prev + 90)}
              className="px-2.5 h-7 rounded-lg flex items-center justify-center text-xs text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D] transition-colors cursor-pointer"
              title="Girar 90° à direita (R)"
            >
              ↻ 90°
            </button>
            <button
              type="button"
              onClick={() => setFlipH((prev) => !prev)}
              className={`px-2.5 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer ${
                flipH ? "bg-[#0FB9A8]/20 text-[#0FB9A8]" : "text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D]"
              }`}
              title="Espelhar horizontal (H)"
            >
              ↔
            </button>
            <button
              type="button"
              onClick={() => setFlipV((prev) => !prev)}
              className={`px-2.5 h-7 rounded-lg flex items-center justify-center text-xs transition-colors cursor-pointer ${
                flipV ? "bg-[#0FB9A8]/20 text-[#0FB9A8]" : "text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#242B3D]"
              }`}
              title="Espelhar vertical (V)"
            >
              ↕
            </button>
          </div>

          <div className="flex-1" />

          {error && <p className="text-xs text-red-400 font-medium">{error}</p>}

          {/* Botões de Ação */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-transparent border border-[#242B3D] text-xs font-semibold text-[#94A3B8] hover:text-[#E9EDF2] hover:bg-[#1A202E] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmCrop}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-[#0FB9A8] text-[#0D1017] text-xs font-bold hover:bg-[#14DAA6] transition-all active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
            >
              {isLoading ? "Processando…" : "Confirmar recorte"}
            </button>
          </div>
        </div>

        {/* Instruções */}
        <p className="mt-2.5 text-[11px] text-[#64748B] text-center">
          Arraste as alças para redimensionar a grade • Arraste o centro para mover • Scroll para zoom
        </p>
      </div>
    </div>
  )

  if (typeof document !== "undefined") {
    return createPortal(modalNode, document.body)
  }

  return modalNode
})

export default ImageEditor
