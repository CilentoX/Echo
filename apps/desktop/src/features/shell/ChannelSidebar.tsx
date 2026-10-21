import { X } from "@phosphor-icons/react";

/** Static placeholder channels — real Matrix rooms arrive in Tasks 8-9. */
const CATEGORIES = [
  {
    id: "geral",
    label: "Geral",
    channels: [
      { id: "geral", name: "geral" },
      { id: "anuncios", name: "anúncios" },
    ],
  },
  {
    id: "dev",
    label: "Desenvolvimento",
    channels: [
      { id: "dev", name: "dev" },
      { id: "design", name: "design" },
    ],
  },
];

export interface ChannelSidebarProps {
  /** `overlay` floats above the chat below 900px; `static` is the docked column. */
  variant?: "static" | "overlay";
  onClose?: () => void;
}

/** Channel sidebar: 232px column listing the community's channels. */
export default function ChannelSidebar({
  variant = "static",
  onClose,
}: ChannelSidebarProps) {
  const overlay = variant === "overlay";

  return (
    <aside
      data-column="sidebar"
      aria-label="Canais"
      className={`flex w-[232px] shrink-0 flex-col border-r border-bd bg-rail ${
        overlay
          ? "fixed inset-y-0 left-[72px] z-20 shadow-lg shadow-black/60"
          : "h-full"
      }`}
    >
      <header className="flex items-center justify-between border-b border-bd px-4 py-3">
        <h1 className="font-display text-base font-semibold text-txt">Eco</h1>
        {overlay && (
          <button
            type="button"
            aria-label="Fechar canais"
            onClick={onClose}
            className="flex items-center rounded p-1 text-mut hover:bg-surf2 hover:text-txt"
          >
            <X size={18} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {CATEGORIES.map((category) => (
          <section key={category.id} className="mb-4">
            <h2 className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-mut">
              {category.label}
            </h2>
            <ul>
              {category.channels.map((channel, index) => (
                <li key={channel.id}>
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm ${
                      index === 0 && category.id === "geral"
                        ? "bg-surf2 text-txt"
                        : "text-mut hover:bg-surf2 hover:text-txt"
                    }`}
                  >
                    <span className="text-mut">#</span> {channel.name}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
