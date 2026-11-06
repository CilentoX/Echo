/**
 * Tamanhos padrão de imagem para o Echo.
 * 
 * Baseado em padrões do Discord/Element Web:
 * - Avatar: 1:1, múltiplos de 48px (Discord usa 128, 256, 512, 1024)
 * - Banner: 16:9 ou 5:2 (Discord 960x240 = 4:1, mas 16:9 é mais flexível)
 * - Guild icon: 1:1 igual avatar
 * 
 * Synapse thumbnail API: width/height em pixels, method=crop|scale
 */

export const IMAGE_PRESETS = {
  /** Avatar de usuário/guilda - quadrado 1:1 de alta fidelidade (Discord padrão 512/1024) */
  avatar: {
    small:   { width: 64,   height: 64   },
    medium:  { width: 128,  height: 128  },
    large:   { width: 512,  height: 512  },
    xlarge:  { width: 512,  height: 512  },
    xxlarge: { width: 1024, height: 1024 },
    max:     { width: 1024, height: 1024 },
  } as const,

  /** Banner de perfil - 16:9 (flexível) ou 5:2 (Discord-style) */
  banner: {
    // 16:9 - alta qualidade para diferentes proporções de tela
    small:   { width: 480,  height: 270 },
    medium:  { width: 960,  height: 540 },
    large:   { width: 1280, height: 720 },
    max:     { width: 1920, height: 1080 },
    
    // Discord-style 5:2 (960x240 / 1920x480)
    discord: { width: 1920, height: 480 },
  } as const,

  /** Ícone de guilda/servidor - quadrado 1:1 em alta resolução */
  guild: {
    small:   { width: 64,   height: 64   },
    medium:  { width: 128,  height: 128  },
    large:   { width: 512,  height: 512  },
    xlarge:  { width: 512,  height: 512  },
    xxlarge: { width: 1024, height: 1024 },
    max:     { width: 1024, height: 1024 },
  } as const,

  /** Mensagem/attach - variável, mas thumbnails úteis */
  message: {
    thumbnail:  { width: 320, height: 240 }, // 4:3 thumbnail
    preview:    { width: 640, height: 480 }, // preview maior
  } as const,
} as const;

/** Tipos derivados para TypeScript */
export type AvatarPreset = keyof typeof IMAGE_PRESETS.avatar;
export type BannerPreset = keyof typeof IMAGE_PRESETS.banner;
export type GuildPreset = keyof typeof IMAGE_PRESETS.guild;
export type MessagePreset = keyof typeof IMAGE_PRESETS.message;

/**
 * Obtém dimensões para um preset
 */
export function getImageSize(
  type: "avatar" | "banner" | "guild" | "message",
  preset: string
): { width: number; height: number } | null {
  const presets = IMAGE_PRESETS[type];
  if (!presets) return null;
  return (presets as Record<string, { width: number; height: number }>)[preset] ?? null;
}

/**
 * Aspect ratios para crop
 */
export const CROP_ASPECTS = {
  avatar: 1,      // 1:1 quadrado
  banner: 16/9,   // 16:9 widescreen
  guild: 1,       // 1:1 quadrado
} as const;