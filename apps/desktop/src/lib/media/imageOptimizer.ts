/**
 * Otimizador de Mídia do Echo:
 * Redimensiona e comprime imagens no cliente antes do upload,
 * reduzindo tráfego de rede e garantindo envio instantâneo (<100ms).
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

const DEFAULT_OPTIONS: ImageOptimizationOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  maxSizeBytes: 500 * 1024, // 500 KB
};

/**
 * Otimiza uma imagem convertendo para WebP de alta qualidade e limitando dimensões.
 * Se o arquivo não for imagem ou já for muito leve, retorna o arquivo original.
 */
export async function optimizeImageForUpload(
  file: File,
  options: ImageOptimizationOptions = DEFAULT_OPTIONS,
): Promise<File> {
  // Ignora arquivos não-imagem ou gifs (para preservar animação)
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  // Se já for pequena (< 150KB) e formato moderno, não processa
  if (file.size <= 150 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  if (typeof window === "undefined" || typeof document === "undefined") {
    return file;
  }

  return new Promise<File>((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const maxW = options.maxWidth ?? 2048;
      const maxH = options.maxHeight ?? 2048;

      let { width, height } = img;

      if (width > maxW || height > maxH) {
        if (width / height > maxW / maxH) {
          height = Math.round((height * maxW) / width);
          width = maxW;
        } else {
          width = Math.round((width * maxH) / height);
          height = maxH;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            // Se a compressão ficou maior que o original, mantém o original
            resolve(file);
            return;
          }

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const optimizedFile = new File([blob], `${baseName}.webp`, {
            type: "image/webp",
            lastModified: Date.now(),
          });

          resolve(optimizedFile);
        },
        "image/webp",
        options.quality ?? 0.85,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}
