import {
  Compass,
  Plus,
  User,
  Gear,
  ShieldCheck,
  Globe,
  Users,
  ImageSquare,
} from "@phosphor-icons/react";
import { useSyncStore } from "@/stores/syncStore";
import { useUiStore } from "@/stores/uiStore";
import { useProfileStore } from "@/stores/profileStore";
import MxcImage from "@/components/media/MxcImage";

export interface HomePageProps {
  onCreateGuild?: () => void;
  onJoinGuild?: () => void;
  onOpenProfile?: () => void;
}

export default function HomePage({
  onCreateGuild,
  onJoinGuild,
  onOpenProfile,
}: HomePageProps = {}) {
  const guilds = useSyncStore((s) => s.guilds);
  const myUserId = useUiStore((s) => s.myUserId);
  const nickname = useProfileStore((s) => s.nickname);
  const displayName = useProfileStore((s) => s.displayName);
  const avatarUrl = useProfileStore((s) => s.avatarUrl ?? s.appwriteAvatarUrl);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);

  const effectiveAvatar = avatarUrl;
  const effectiveName = nickname || displayName || myUserId?.replace(/^@/, "").split(":")[0] || "Usuário";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-bg select-none">
      {/* Container centralizado com espaçamento lateral equilibrado equivalente à largura das sidebars */}
      <div className="mx-auto w-full max-w-[880px] xl:max-w-[940px] px-6 sm:px-10 lg:px-12 py-8 flex flex-col gap-8">
        {/* Boas-vindas / Cabeçalho de Introdução */}
        <section className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-acc/10 text-acc shrink-0 shadow-sm">
              <Compass size={20} weight="bold" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-txt">
              Início
            </h1>
          </div>
          <p className="text-sm text-mut pl-10.5">
            Bem-vindo ao seu espaço de comunicação seguro, descentralizado e em tempo real.
          </p>
        </section>

        {/* Quick Actions */}
        <section className="flex flex-col gap-3.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-mut">
            Ações rápidas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <QuickActionCard
              icon={<Plus size={22} weight="bold" className="text-acc" />}
              title="Criar guilda"
              description="Crie sua primeira comunidade"
              onClick={onCreateGuild}
            />
            <QuickActionCard
              icon={<Users size={22} weight="bold" className="text-acc" />}
              title="Entrar em guilda"
              description="Aceite um convite ou entre numa comunidade"
              onClick={onJoinGuild}
            />
            <QuickActionCard
              icon={<ImageSquare size={22} weight="bold" className="text-acc" />}
              title="Criar canal"
              description="Organize conversas por tema e tópicos"
              onClick={() => {
                const firstGuild = guilds[0];
                if (firstGuild) {
                  setActiveGuild(firstGuild.guildId);
                }
              }}
            />
            <QuickActionCard
              icon={<User size={22} weight="bold" className="text-acc" />}
              title="Meu perfil"
              description="Edite foto, banner, nome e biografia"
              onClick={onOpenProfile}
            />
          </div>
        </section>

        {/* Minhas Guildas (se houver) */}
        {guilds.length > 0 && (
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-mut">
                Minhas guildas ({guilds.length})
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {guilds.map((guild) => (
                <GuildCard
                  key={guild.guildId}
                  guild={guild}
                  isActive={guild.guildId === activeGuildId}
                  onClick={() => {
                    setActiveGuild(guild.guildId);
                    setActiveChannel(null);
                  }}
                />
              ))}
            </div>
          </section>
        )}

        {/* Informações do Perfil */}
        {myUserId && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-mut">
              Seu perfil
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 rounded-2xl bg-surf border border-bd/80 shadow-sm">
              <div className="relative shrink-0">
                {effectiveAvatar ? (
                  <MxcImage
                    mxcUrl={effectiveAvatar}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full object-cover border-2 border-bd/60 shadow-md"
                    width={64}
                    height={64}
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc font-display text-xl font-bold text-bg shadow-md">
                    {effectiveName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <h3 className="font-display font-bold text-lg text-txt truncate">
                  {effectiveName}
                </h3>
                <p className="text-xs text-mut font-mono truncate">{myUserId}</p>
              </div>
              <div className="sm:flex-1" />
              <button
                type="button"
                className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surf2 border border-bd text-xs font-semibold text-txt hover:bg-acc hover:text-bg hover:border-acc transition-all active:scale-95 shadow-sm"
                onClick={onOpenProfile}
              >
                <Gear size={16} aria-hidden />
                <span>Editar perfil</span>
              </button>
            </div>

            {/* Informações sobre a plataforma */}
            <div className="bg-surf/70 border border-bd/70 rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-acc shrink-0" aria-hidden />
                <h4 className="font-display font-semibold text-sm text-txt">Sobre o Echo</h4>
              </div>
              <p className="text-xs text-mut leading-relaxed">
                Bem-vindo ao seu espaço de comunicação seguro e descentralizado.
                Use as ações rápidas acima para criar sua primeira guilda, convidar
                sua comunidade e começar a conversar em tempo real.
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs text-mut border-t border-bd/40">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  <span>Criptografia ponta a ponta</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Globe size={13} className="text-acc" aria-hidden />
                  <span>Rede Matrix federada</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-start gap-3 p-4 sm:p-5 rounded-2xl border border-bd/80 bg-surf hover:bg-surf2/50 hover:border-acc/50 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98] text-left ${className ?? ""}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-acc/10 text-acc group-hover:bg-acc group-hover:text-bg transition-colors duration-200 shrink-0">
        {icon}
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <h4 className="font-display text-sm font-semibold text-txt group-hover:text-acc transition-colors truncate">
          {title}
        </h4>
        <p className="text-xs text-mut leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>
    </button>
  );
}

function GuildCard({
  guild,
  isActive,
  onClick,
}: {
  guild: { guildId: string; name: string; avatarUrl: string | null; unreadCount: number };
  isActive: boolean;
  onClick: () => void;
}) {
  const initials = guild.name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 p-3.5 rounded-2xl border border-bd/80 bg-surf hover:border-acc/50 hover:bg-surf2/50 transition-all cursor-pointer shadow-sm active:scale-[0.98] text-left ${
        isActive ? "bg-acc/10 border-acc ring-1 ring-acc" : ""
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-acc text-bg font-display font-bold text-sm shrink-0 shadow-sm">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="font-display font-semibold text-sm text-txt group-hover:text-acc transition-colors truncate">
          {guild.name}
        </h4>
      </div>
      {guild.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1.5 text-[11px] font-bold text-bg">
          {guild.unreadCount}
        </span>
      )}
    </button>
  );
}
