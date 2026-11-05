/**
 * Sistema Completo de Permissões de Canais de Texto e Áudio do Echo.
 *
 * Suporta permissões por Cargo (Role) e por Membro Individual (Member Overrides),
 * resolução hierárquica baseada no padrão Discord, canais privados com chave de acesso
 * e persistência em cache de disco local.
 */

import type { GuildRole } from "@/lib/api/echoApi";

export type ChannelPermissionType =
  // Permissões Gerais de Canal
  | "VIEW_CHANNEL"      // Ver o canal na lista e acessar seu conteúdo
  | "MANAGE_CHANNELS"   // Alterar nome, tópico, permissões ou excluir o canal
  // Permissões de Canais de Texto
  | "SEND_MESSAGES"     // Enviar mensagens de texto
  | "ATTACH_FILES"      // Enviar imagens, anexos, mídias e áudios
  | "ADD_REACTIONS"     // Reagir com emojis a mensagens
  | "MANAGE_MESSAGES"   // Excluir ou fixar mensagens de outros membros
  // Permissões de Canais de Áudio / Voz
  | "CONNECT_VOICE"     // Entrar no canal de áudio
  | "SPEAK"             // Falar no canal (desativado = modo ouvinte)
  | "MUTE_MEMBERS"      // Silenciar outros membros na sala
  | "DEAFEN_MEMBERS"    // Ensurdecer outros membros na sala
  | "PRIORITY_SPEAKER"; // Reduz o volume dos demais quando falar

export type PermissionState = "allow" | "deny" | "inherit";

export interface PermissionDefinition {
  id: ChannelPermissionType;
  name: string;
  description: string;
  category: "general" | "text" | "voice";
}

export const ALL_CHANNEL_PERMISSIONS: PermissionDefinition[] = [
  // Permissões Gerais
  {
    id: "VIEW_CHANNEL",
    name: "Ver Canal",
    description: "Permite que membros vejam este canal na lista e acessem seu conteúdo.",
    category: "general",
  },
  {
    id: "MANAGE_CHANNELS",
    name: "Gerenciar Canal",
    description: "Permite alterar nome, tópico, permissões ou excluir este canal.",
    category: "general",
  },
  // Permissões de Texto
  {
    id: "SEND_MESSAGES",
    name: "Enviar Mensagens",
    description: "Permite enviar mensagens no canal de texto.",
    category: "text",
  },
  {
    id: "ATTACH_FILES",
    name: "Anexar Arquivos & Mídias",
    description: "Permite enviar fotos, imagens, arquivos e áudios gravados.",
    category: "text",
  },
  {
    id: "ADD_REACTIONS",
    name: "Adicionar Reações",
    description: "Permite reagir com emojis às mensagens publicadas.",
    category: "text",
  },
  {
    id: "MANAGE_MESSAGES",
    name: "Gerenciar Mensagens",
    description: "Permite excluir ou fixar mensagens de outros membros.",
    category: "text",
  },
  // Permissões de Áudio / Voz
  {
    id: "CONNECT_VOICE",
    name: "Conectar ao Áudio",
    description: "Permite entrar na sala de voz e ouvir os participantes.",
    category: "voice",
  },
  {
    id: "SPEAK",
    name: "Falar",
    description: "Permite transmitir microfone. Se negado, o membro fica em modo ouvinte.",
    category: "voice",
  },
  {
    id: "MUTE_MEMBERS",
    name: "Silenciar Membros",
    description: "Permite mutar outros participantes conectados nesta chamada.",
    category: "voice",
  },
  {
    id: "DEAFEN_MEMBERS",
    name: "Ensurdecer Membros",
    description: "Permite ensurdecer outros participantes conectados nesta chamada.",
    category: "voice",
  },
  {
    id: "PRIORITY_SPEAKER",
    name: "Voz Prioritária",
    description: "Abaixa o volume dos outros participantes quando este membro estiver falando.",
    category: "voice",
  },
];

export interface ChannelOverride {
  /** roleId (ex: "@everyone", "role_abc") ou userId (ex: "@nina:echo.litteris.online") */
  id: string;
  type: "role" | "member";
  name: string;
  avatarUrl?: string | null;
  color?: string | null;
  allow: ChannelPermissionType[];
  deny: ChannelPermissionType[];
}

export interface ChannelPermissionsConfig {
  channelId: string;
  isPrivate?: boolean;
  overrides: ChannelOverride[];
}

/**
 * Cria a configuração inicial de permissões para um canal.
 */
export function createDefaultChannelPermissions(
  channelId: string,
  options?: { isPrivate?: boolean },
): ChannelPermissionsConfig {
  const isPrivate = options?.isPrivate ?? false;

  return {
    channelId,
    isPrivate,
    overrides: [
      {
        id: "@everyone",
        type: "role",
        name: "@everyone",
        color: null,
        allow: isPrivate ? [] : ["VIEW_CHANNEL", "SEND_MESSAGES", "ATTACH_FILES", "ADD_REACTIONS", "CONNECT_VOICE", "SPEAK"],
        deny: isPrivate ? ["VIEW_CHANNEL"] : [],
      },
    ],
  };
}

export interface PermissionContext {
  userId: string;
  isGuildOwner?: boolean;
  userRoleIds: string[];
  guildRoles?: GuildRole[];
  channelConfig?: ChannelPermissionsConfig | null;
  channelType: "text" | "voice";
}

/**
 * Algoritmo Hierárquico de Resolução de Permissão do Discord/Echo:
 * 1. Dono da guilda (Guild Owner) tem 100% de permissão em tudo.
 * 2. Membros com cargo contendo MANAGE_GUILD têm permissão total.
 * 3. Se o canal for privado e não houver allow explícito para o membro ou seus cargos, VIEW_CHANNEL é false.
 * 4. Aplica sobrescrita do cargo @everyone.
 * 5. Aplica união das sobrescritas dos cargos (Roles) do membro.
 * 6. Aplica sobrescrita específica do membro individual (Member Override) com prioridade máxima.
 */
export function hasChannelPermission(
  permission: ChannelPermissionType,
  context: PermissionContext,
): boolean {
  // 1. Dono do servidor
  if (context.isGuildOwner) return true;

  // 2. Administrador / Gerente da guilda
  if (context.guildRoles && context.userRoleIds.length > 0) {
    const userRoles = context.guildRoles.filter((r) =>
      context.userRoleIds.includes((r as any).roleId || r.id),
    );
    if (userRoles.some((r) => r.permissions.includes("MANAGE_GUILD") || r.permissions.includes("ADMINISTRATOR"))) {
      return true;
    }
  }

  const config = context.channelConfig;

  // Se não houver configuração customizada de canal, usa permissões padrão confortáveis
  if (!config || !config.overrides || config.overrides.length === 0) {
    if (permission === "MANAGE_CHANNELS" || permission === "MANAGE_MESSAGES" || permission === "MUTE_MEMBERS" || permission === "DEAFEN_MEMBERS" || permission === "PRIORITY_SPEAKER") {
      return false;
    }
    return true;
  }

  // 3. Verificação de canal privado
  if (config.isPrivate && permission === "VIEW_CHANNEL") {
    // Procura sobrescrita específica do membro
    const memberOverride = config.overrides.find(
      (o) => o.type === "member" && o.id === context.userId,
    );
    if (memberOverride) {
      if (memberOverride.deny.includes("VIEW_CHANNEL")) return false;
      if (memberOverride.allow.includes("VIEW_CHANNEL")) return true;
    }

    // Procura sobrescritas dos cargos do membro
    const roleOverrides = config.overrides.filter(
      (o) => o.type === "role" && context.userRoleIds.includes(o.id),
    );
    if (roleOverrides.some((o) => o.allow.includes("VIEW_CHANNEL"))) {
      return true;
    }

    // Se privado e não há allow explícito para os cargos ou membro, nega acesso
    return false;
  }

  // 4. Sobrescrita @everyone
  let allowed = true;
  const everyoneOverride = config.overrides.find((o) => o.id === "@everyone");
  if (everyoneOverride) {
    if (everyoneOverride.deny.includes(permission)) {
      allowed = false;
    }
    if (everyoneOverride.allow.includes(permission)) {
      allowed = true;
    }
  }

  // 5. Sobrescrita dos Cargos do Usuário (União)
  const roleOverrides = config.overrides.filter(
    (o) => o.type === "role" && o.id !== "@everyone" && context.userRoleIds.includes(o.id),
  );

  let roleAllowed = false;
  let roleDenied = false;

  for (const ro of roleOverrides) {
    if (ro.deny.includes(permission)) {
      roleDenied = true;
    }
    if (ro.allow.includes(permission)) {
      roleAllowed = true;
    }
  }

  if (roleDenied) allowed = false;
  if (roleAllowed) allowed = true;

  // 6. Sobrescrita Específica do Membro (Prioridade Máxima)
  const memberOverride = config.overrides.find(
    (o) => o.type === "member" && o.id === context.userId,
  );

  if (memberOverride) {
    if (memberOverride.deny.includes(permission)) {
      return false;
    }
    if (memberOverride.allow.includes(permission)) {
      return true;
    }
  }

  return allowed;
}

/**
 * Obtém o estado de permissão para um cargo/membro específico na sobrescrita do canal.
 */
export function getOverrideState(
  override: ChannelOverride | undefined,
  permission: ChannelPermissionType,
): PermissionState {
  if (!override) return "inherit";
  if (override.allow.includes(permission)) return "allow";
  if (override.deny.includes(permission)) return "deny";
  return "inherit";
}

/**
 * Atualiza o estado de uma permissão em uma sobrescrita.
 */
export function setOverrideState(
  override: ChannelOverride,
  permission: ChannelPermissionType,
  state: PermissionState,
): ChannelOverride {
  const allow = override.allow.filter((p) => p !== permission);
  const deny = override.deny.filter((p) => p !== permission);

  if (state === "allow") {
    allow.push(permission);
  } else if (state === "deny") {
    deny.push(permission);
  }

  return {
    ...override,
    allow,
    deny,
  };
}
