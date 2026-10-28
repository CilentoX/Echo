import {
  User,
  Palette,
  Bell,
  Lock,
  Link,
  ShieldCheck,
  Users,
  Gift,
} from "@phosphor-icons/react";

export type TabKey =
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "connections"
  | "security";

export const PROFILE_TABS = [
  ["profile", "Perfil", <User size={14} />] as const,
  ["appearance", "Aparência", <Palette size={14} />] as const,
  ["notifications", "Notificações", <Bell size={14} />] as const,
  ["privacy", "Privacidade", <Lock size={14} />] as const,
  ["connections", "Conexões", <Link size={14} />] as const,
  ["security", "Segurança", <ShieldCheck size={14} />] as const,
] as const;

export const STATUS_OPTIONS = [
  { value: "online", label: "Online", color: "bg-online", desc: "Disponível" },
  { value: "unavailable", label: "Não perturbar", color: "bg-dnd", desc: "Ocupado" },
  { value: "idle", label: "Ausente", color: "bg-idle", desc: "Ausente" },
  { value: "offline", label: "Offline", color: "bg-offline", desc: "Invisível" },
] as const;

export const CONNECTION_OPTIONS = [
  { id: "google", name: "Google", icon: <ShieldCheck size={14} className="text-acc" />, color: "text-acc" },
  { id: "github", name: "GitHub", icon: <Users size={14} className="text-mut" />, color: "text-mut" },
  { id: "twitch", name: "Twitch", icon: <Gift size={14} className="text-mut" />, color: "text-mut" },
  { id: "discord", name: "Discord", icon: <Link size={14} className="text-acc" />, color: "text-acc" },
] as const;

export const STATUS_OPTIONS_LOCAL = [
  { value: "online", label: "Online", color: "bg-online", icon: <span className="h-2 w-2 rounded-full bg-online" /> },
  { value: "unavailable", label: "Não perturbar", color: "bg-dnd", icon: <span className="h-2 w-2 rounded-full bg-dnd" /> },
  { value: "idle", label: "Ausente", color: "bg-idle", icon: <span className="h-2 w-2 rounded-full bg-idle" /> },
  { value: "offline", label: "Offline", color: "bg-offline", icon: <span className="h-2 w-2 rounded-full bg-offline" /> },
] as const;

export const CONNECTION_OPTIONS_LOCAL = [
  { id: "google", name: "Google", icon: <ShieldCheck size={14} className="text-acc" />, color: "text-acc" },
  { id: "github", name: "GitHub", icon: <Users size={14} className="text-mut" />, color: "text-mut" },
  { id: "twitch", name: "Twitch", icon: <Gift size={14} className="text-mut" />, color: "text-mut" },
  { id: "discord", name: "Discord", icon: <Link size={14} className="text-acc" />, color: "text-acc" },
] as const;