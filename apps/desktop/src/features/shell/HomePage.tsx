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

export default function HomePage() {
  const guilds = useSyncStore((s) => s.guilds);
  const myUserId = useUiStore((s) => s.myUserId);
  const activeGuildId = useUiStore((s) => s.activeGuildId);
  const setActiveGuild = useUiStore((s) => s.setActiveGuild);
  const setActiveChannel = useUiStore((s) => s.setActiveChannel);

  const handleCreateGuild = async () => {
    // O modal de criação é aberto via CommunityRail; aqui apenas navegamos para o fluxo
    // O botão "+" na rail já dispara o modal
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-bg">
      {/* Header da Home */}
      <header className="flex shrink-0 items-center gap-3 border-b border-bd px-4 py-3 bg-bg/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-acc text-bg shrink-0">
          <Compass size={18} aria-hidden />
        </div>
        <h1 className="font-display text-sm font-semibold text-txt">Home</h1>
        <div className="flex-1" />
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        {/* Quick Actions */}
        <section className="flex flex-col gap-6 mb-8">
          <h2 className="text-xl font-display font-bold text-txt">Ações rápidas</h2>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <QuickActionCard
              icon={<Plus size={20} className="text-acc" />}
              title="Criar guilda"
              description="Crie sua primeira comunidade"
              onClick={() => {
                // Dispara o modal via CommunityRail (não há store exposto aqui,
                // mas o botão + na rail já faz isso)
              }}
              className="bg-acc/10 border-acc/20 hover:border-acc/40"
            />
            <QuickActionCard
              icon={<Users size={20} className="text-acc" />}
              title="Entrar em guilda"
              description="Aceite um convite ou busque uma comunidade"
              onClick={() => {}}
              className="bg-acc/10 border-acc/20 hover:border-acc/40"
            />
            <QuickActionCard
              icon={<ImageSquare size={20} className="text-acc" />}
              title="Criar canal"
              description="Organize conversas por tema"
              onClick={() => {}}
              className="bg-acc/10 border-acc/20 hover:border-acc/40"
            />
            <QuickActionCard
              icon={<User size={20} className="text-acc" />}
              title="Meu perfil"
              description="Edite foto, nome e biografia"
              onClick={() => {}}
              className="bg-acc/10 border-acc/20 hover:border-acc/40"
            />
          </div>
        </section>

        {/* Minhas Guildas */}
        {guilds.length > 0 && (
          <section className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-display font-bold text-txt">Minhas guildas</h2>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surf2 text-mut shrink-0">
                <Compass size={14} aria-hidden />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
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
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-display font-bold text-txt">Seu perfil</h2>
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-acc text-bg shrink-0">
                {myUserId.split(":")[0].replace("@", "").toUpperCase().slice(0, 2) || "U"}
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display font-semibold text-txt">
                  {myUserId.replace(/^@/, "").split(":")[0]}
                </h3>
                <p className="text-sm text-mut">{myUserId}</p>
              </div>
              <div className="flex-1" />
              <button
                type="button"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surf border border-bd text-sm font-medium text-txt hover:bg-surf2 transition-colors"
                onClick={() => {}}
              >
                <Gear size={14} className="text-mut" aria-hidden />
                <span className="text-mut">Editar perfil</span>
              </button>
            </div>

            <div className="bg-surf border border-bd rounded-xl p-4">
              <h4 className="font-display font-semibold text-txt mb-3">Sobre o Echo</h4>
              <p className="text-sm text-mut leading-relaxed mb-3">
                Bem-vindo ao seu espaço de comunicação seguro e descentralizado.
                Use as ações rápidas acima para criar sua primeira guilda, convidar
                sua comunidade e começar a conversar em tempo real.
              </p>
              <div className="flex gap-4 text-xs text-mut">
                <div className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-success" aria-hidden />
                  <span>Criptografia de ponta a ponta</span>
                </div>
                <div className="flex items-center gap-1">
                  <Globe size={12} className="text-acc" aria-hidden />
                  <span>Rede Matrix federada</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
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
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 p-5 rounded-xl border border-bd bg-surf hover:border-acc transition-colors cursor-pointer ${className ?? ""}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-acc/10 text-acc">
        {icon}
      </div>
      <h4 className="font-display font-semibold text-txt">{title}</h4>
      <p className="text-sm text-mut leading-relaxed">{description}</p>
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
      className={`flex flex-col gap-2 p-4 rounded-xl border border-bd bg-surf hover:border-acc hover:bg-surf2 transition-colors cursor-pointer ${
        isActive ? "bg-acc/10 border-acc" : ""
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-acc text-bg shrink-0">
        {initials}
      </div>
      <h4 className="font-display font-semibold text-txt truncate">{guild.name}</h4>
      {guild.unreadCount > 0 && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-err px-1 text-[11px] font-bold text-bg">
          {guild.unreadCount}
        </span>
      )}
    </button>
  );
}