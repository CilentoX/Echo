"use client";

import { useEffect, useCallback, useState } from "react";
import { X, User, Palette, Bell, Lock, Link, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "cn";
import { ProfileTab } from "./tabs/ProfileTab";
import { AppearanceTab } from "./tabs/AppearanceTab";
import { NotificationsTab } from "./components/NotificationsTab";
import { PrivacyTab } from "./tabs/PrivacyTab";
import { ConnectionsTab } from "./components/ConnectionsTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { useProfileStore } from "@/stores/profileStore";

export interface ProfileProps {
  open: boolean;
  onClose: () => void;
}

type TabKey =
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "connections"
  | "security";

const TAB_CONFIG: Record<TabKey, { label: string; icon: React.ReactNode }> = {
  profile: { label: "Perfil", icon: <User size={18} /> },
  appearance: { label: "Aparência", icon: <Palette size={18} /> },
  notifications: { label: "Notificações", icon: <Bell size={18} /> },
  privacy: { label: "Privacidade", icon: <Lock size={18} /> },
  connections: { label: "Conexões", icon: <Link size={18} /> },
  security: { label: "Segurança", icon: <ShieldCheck size={18} /> },
};

export default function Profile({ open, onClose }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setActiveTab("profile");
      setIsMounted(true);
    } else {
      setIsMounted(false);
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!open && !isMounted) {
    return null;
  }

  const renderTabContent = (tab: TabKey) => {
    switch (tab) {
      case "profile":
        return <ProfileTab onClose={onClose} />;
      case "appearance":
        return <AppearanceTab />;
      case "notifications":
        return <NotificationsTab />;
      case "privacy":
        return <PrivacyTab />;
      case "connections":
        return <ConnectionsTab />;
      case "security":
        return <SecurityTab />;
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        isMounted ? "fade-in-0 duration-200" : "opacity-0 pointer-events-none"
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Configurações do perfil"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Panel */}
      <div
        className={cn(
          "relative flex flex-row w-full max-w-4xl h-[90vh] max-h-[90vh] mx-auto my-6 bg-rail rounded-2xl border border-bd overflow-hidden shadow-2xl",
          isMounted
            ? "slide-in-from-right-1/4 duration-300 ease-out"
            : "opacity-0 translate-x-full"
        )}
      >
        {/* Sidebar Navigation */}
        <aside className="flex flex-col w-52 flex-shrink-0 bg-bg border-r border-bd p-4">
          <nav className="flex-1 space-y-1" aria-label="Categorias de configurações">
            {Object.entries(TAB_CONFIG).map(([key, config]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as TabKey)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-rail",
                  activeTab === key
                    ? "bg-surf text-txt font-medium"
                    : "text-mut hover:bg-surf2 hover:text-txt",
                  "data-[state=active]:bg-surf data-[state=active]:text-txt"
                )}
                data-state={activeTab === key ? "active" : "inactive"}
                role="tab"
                aria-selected={activeTab === key}
                aria-controls={`panel-${key}`}
              >
                <span className="flex-shrink-0" aria-hidden="true">{config.icon}</span>
                <span className="truncate font-medium">{config.label}</span>
              </button>
            ))}
          </nav>

          {/* User preview at bottom of sidebar */}
          <div className="pt-4 border-t border-bd">
            <ProfileSidebarPreview onClose={onClose} />
          </div>
        </aside>

        {/* Content Panel */}
        <div
          id={`panel-${activeTab}`}
          className="flex-1 flex flex-col min-w-0 overflow-hidden"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {renderTabContent(activeTab)}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileSidebarPreview({ onClose }: { onClose: () => void }) {
  const { displayName, username, appwriteAvatarUrl, nickname } = useProfileStore();

  const initials = (displayName ?? username ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <button
      type="button"
      onClick={onClose}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-all duration-200 text-mut hover:bg-surf2 hover:text-txt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acc focus-visible:ring-offset-2 focus-visible:ring-offset-rail"
      aria-label="Fechar configurações"
    >
      <div className="relative flex-shrink-0 w-10 h-10 rounded-full overflow-hidden bg-surf2 flex items-center justify-center">
        {appwriteAvatarUrl ? (
          <img src={appwriteAvatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-display text-sm font-bold text-txt">{initials}</span>
        )}
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-online border-2 border-bg" />
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="font-medium text-sm truncate text-txt">{displayName || username}</p>
        <p className="text-xs truncate text-mut">@{nickname || username.replace(/^@/, "")}</p>
      </div>
      <X size={16} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
