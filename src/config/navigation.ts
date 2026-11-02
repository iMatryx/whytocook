import type { IconName } from "@/components/ui/icon";

export type ShellNavigationItem = {
  href: string;
  label: string;
  icon: IconName;
  group: "discover" | "organize" | "account" | "admin";
};

export const shellNavigation = [
  { href: "/", label: "Acasă", icon: "home", group: "discover" },
  { href: "/recipes", label: "Rețete", icon: "book", group: "discover" },
  { href: "/ingredients", label: "Ingrediente", icon: "leaf", group: "discover" },
  { href: "/my-fridge", label: "Frigiderul meu", icon: "fridge", group: "organize" },
  { href: "/meal-planner", label: "Planificator de mese", icon: "calendar", group: "organize" },
  { href: "/shopping-list", label: "Lista de cumpărături", icon: "basket", group: "organize" },
  { href: "/favorites", label: "Favorite", icon: "heart", group: "organize" },
  { href: "/assistant", label: "Asistent", icon: "sparkles", group: "discover" },
  { href: "/profile", label: "Profil", icon: "user", group: "account" },
  { href: "/login", label: "Autentificare", icon: "user", group: "account" },
  { href: "/admin", label: "Admin", icon: "settings", group: "admin" },
] as const satisfies readonly ShellNavigationItem[];

export const shellNavigationGroups = [
  { key: "discover", label: "Descoperă" },
  { key: "organize", label: "Organizează" },
  { key: "account", label: "Cont" },
  { key: "admin", label: "Administrare" },
] as const;
