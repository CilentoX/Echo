import type { Area } from "react-easy-crop";

/**
 * Cria um objeto HTMLImageElement de forma segura com suporte a CORS.
 */
export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", (error) => reject(error));
    image.setAttribute("crossOrigin", "anonymous");
    image.src = url;
  });

/**
 * Converte graus para radianos.
 */
export function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Calcula dimensões delimitadoras para uma imagem rotacionada.
 */
export function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Extrai e recorta a imagem com alta resolução, preservando detalhes originais,
 * aplicando rotação, flip e exportando em formato otimizado (WebP / JPEG).
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  maxOutputWidth = 1920,
  maxOutputHeight = 1080
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível inicializar contexto gráfico 2D do Canvas");
  }

  const naturalW = image.naturalWidth || image.width || 800;
  const naturalH = image.naturalHeight || image.height || 600;

  const rotRad = getRadianAngle(rotation);

  // Calcula bounding box para acomodar rotação sem cortes nas bordas
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(naturalW, naturalH, rotation);

  canvas.width = Math.max(1, Math.round(bBoxWidth));
  canvas.height = Math.max(1, Math.round(bBoxHeight));

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-naturalW / 2, -naturalH / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0);

  // Canvas final para o recorte selecionado
  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  if (!croppedCtx) {
    throw new Error("Não foi possível inicializar canvas de recorte");
  }

  // Dimensões pretendidas baseadas no recorte em pixels reais
  let outW = Math.max(1, Math.round(pixelCrop.width));
  let outH = Math.max(1, Math.round(pixelCrop.height));

  // Limite defensivo de resolução para não estourar memória do webview
  if (outW > maxOutputWidth || outH > maxOutputHeight) {
    const scale = Math.min(maxOutputWidth / outW, maxOutputHeight / outH);
    outW = Math.max(1, Math.round(outW * scale));
    outH = Math.max(1, Math.round(outH * scale));
  }

  croppedCanvas.width = outW;
  croppedCanvas.height = outH;

  croppedCtx.imageSmoothingEnabled = true;
  croppedCtx.imageSmoothingQuality = "high";

  // Desenha a porção recortada no canvas de saída final
  croppedCtx.drawImage(
    canvas,
    Math.max(0, Math.round(pixelCrop.x)),
    Math.max(0, Math.round(pixelCrop.y)),
    Math.max(1, Math.round(pixelCrop.width)),
    Math.max(1, Math.round(pixelCrop.height)),
    0,
    0,
    outW,
    outH
  );

  return new Promise<File>((resolve, reject) => {
    try {
      // Exporta em WebP com qualidade 0.90 (compressão de alta fidelidade)
      croppedCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], `cropped-${Date.now()}.webp`, { type: "image/webp" }));
          } else {
            // Fallback para JPEG se WebP falhar
            croppedCanvas.toBlob(
              (fallbackBlob) => {
                if (fallbackBlob) {
                  resolve(new File([fallbackBlob], `cropped-${Date.now()}.jpg`, { type: "image/jpeg" }));
                } else {
                  reject(new Error("Falha ao gerar arquivo de imagem recortada"));
                }
              },
              "image/jpeg",
              0.9
            );
          }
        },
        "image/webp",
        0.9
      );
    } catch (err) {
      reject(err);
    }
  });
}

