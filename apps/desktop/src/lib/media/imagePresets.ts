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
  /** Avatar de usuário/guilda - quadrado 1:1 */
  avatar: {
    small:   { width: 32,  height: 32  },   // 32px - lista de membros compacta
    medium:  { width: 48,  height: 48  },   // 48px - lista de membros padrão
    large:   { width: 64,  height: 64  },   // 64px - dropdown de membro
    xlarge:  { width: 128, height: 128 },   // 128px - perfil, modal
    xxlarge: { width: 256, height: 256 },   // 256px - alta resolução
    max:     { width: 512, height: 512 },   // 512px - máximo recomendado
  } as const,

  /** Banner de perfil - 16:9 (flexível) ou 5:2 (Discord-style) */
  banner: {
    // 16:9 - mais flexível para diferentes proporções de tela
    small:   { width: 320, height: 180 },   // 320x180  - preview pequeno
    medium:  { width: 640, height: 360 },   // 640x360  - dropdown/profile
    large:   { width: 960, height: 540 },   // 960x540  - alta qualidade
    max:     { width: 1280, height: 720 },  // 1280x720 - máximo (Discord usa 960x240 mas 16:9 é melhor)
    
    // Discord-style 5:2 (960x240) - mais largo
    discord: { width: 960, height: 240 },
  } as const,

  /** Ícone de guilda/servidor - quadrado 1:1 (mesmo que avatar) */
  guild: {
    small:   { width: 32,  height: 32  },
    medium:  { width: 48,  height: 48  },
    large:   { width: 64,  height: 64  },
    xlarge:  { width: 128, height: 128 },
    xxlarge: { width: 256, height: 256 },
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