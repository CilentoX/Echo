/** Static placeholder communities — real Matrix spaces arrive in Tasks 8-9. */
const COMMUNITIES = [
  { id: "eco", initials: "EC", name: "Eco", active: true },
  { id: "litteris", initials: "LI", name: "Litteris", active: false },
];

/** Community rail: the leftmost 72px column. It never disappears. */
export default function CommunityRail() {
  return (
    <nav
      data-column="rail"
      aria-label="Comunidades"
      className="flex h-full w-[72px] shrink-0 flex-col items-center gap-3 border-r border-bd bg-rail py-4"
    >
      {COMMUNITIES.map((community) => (
        <button
          key={community.id}
          type="button"
          title={community.name}
          aria-label={community.name}
          aria-current={community.active ? "true" : undefined}
          className={`flex h-12 w-12 items-center justify-center rounded-full font-display text-sm transition-colors ${
            community.active
              ? "bg-acc text-bg"
              : "bg-surf2 text-mut hover:bg-acc-press hover:text-txt"
          }`}
        >
          {community.initials}
        </button>
      ))}
    </nav>
  );
}
