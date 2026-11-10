import { Camera, Sparkle } from "@phosphor-icons/react";
import MxcImage from "@/components/media/MxcImage";
import type { GuildSummary } from "@/lib/matrix/types";

interface GuildBannerHeaderProps {
  activeGuild: GuildSummary;
  bannerFallbackGradient: string;
  onOpenSettings: () => void;
}

export function GuildBannerHeader({
  activeGuild,
  bannerFallbackGradient,
  onOpenSettings,
}: GuildBannerHeaderProps) {
  return (
    <div className="px-2.5 pt-2.5 pb-1 shrink-0">
      {activeGuild.bannerUrl ? (
        <div className="relative h-28 w-full overflow-hidden rounded-2xl border border-bd-subtle shadow-sm group/banner select-none">
          <MxcImage
            mxcUrl={activeGuild.bannerUrl}
            alt={activeGuild.name}
            className="h-full w-full object-cover group-hover/banner:scale-105 transition-transform duration-500"
            width={212}
            height={112}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          <button
            type="button"
            onClick={onOpenSettings}
            title="Alterar banner"
            aria-label="Alterar banner"
            className="cursor-pointer absolute top-2 right-2 rounded-lg p-1.5 text-white/90 bg-black/40 hover:bg-black/60 backdrop-blur-md opacity-0 group-hover/banner:opacity-100 transition-all border border-white/10"
          >
            <Camera size={13} />
          </button>
        </div>
      ) : (
        <div
          data-testid="guild-banner-fallback"
          className={`relative h-24 w-full overflow-hidden rounded-2xl border border-bd-subtle shadow-sm select-none group/banner transition-colors duration-300 ${bannerFallbackGradient}`}
        >
          {/* Glows sutis e dinâmicos */}
          <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-acc/15 blur-xl pointer-events-none" />
          <div className="absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-acc/10 blur-xl pointer-events-none" />

          {/* Marca d'água sutil com a inicial da guilda */}
          <div className="absolute right-3 -bottom-2 font-display text-6xl font-black text-txt/[0.05] select-none pointer-events-none tracking-tighter">
            {activeGuild.name.slice(0, 1).toUpperCase()}
          </div>

          {/* Badge elegante de Comunidade */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-surf/80 dark:bg-black/30 backdrop-blur-md border border-bd-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mut shadow-xs">
            <Sparkle size={10} className="text-acc" weight="fill" />
            <span>Comunidade</span>
          </div>

          {/* Atalho rápido no hover para personalizar banner */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Personalizar banner da guilda"
            aria-label="Personalizar banner da guilda"
            className="cursor-pointer absolute top-2 right-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-mut hover:text-txt bg-surf/80 dark:bg-black/40 hover:bg-surf backdrop-blur-md border border-bd-subtle opacity-0 group-hover/banner:opacity-100 transition-all"
          >
            <Camera size={12} />
            <span>Banner</span>
          </button>
        </div>
      )}
    </div>
  );
}
