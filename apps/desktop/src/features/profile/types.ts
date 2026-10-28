// apps/desktop/src/features/profile/types.ts

export type TabKey =
  | "profile"
  | "appearance"
  | "notifications"
  | "privacy"
  | "connections"
  | "security";

export interface ProfileTabsConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export interface StatusOption {
  value: string;
  label: string;
  color: string;
  desc: string;
}

export interface ConnectionOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}

export interface ProfileTabsConfig {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export interface StatusOption {
  value: string;
  label: string;
  color: string;
  desc: string;
}

export interface ConnectionOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
}