import { shellNavigation } from "../../config/navigation.ts";
import { RECIPE_ROUTE_ID_MAX_LENGTH, RECIPE_ROUTE_ID_PATTERN } from "../contracts/route-id.ts";

export type BreadcrumbItem = { label: string; href?: string };

export function normalizePathname(pathname: string): string {
  return (pathname.split(/[?#]/)[0] ?? "/").replace(/\/+$/, "") || "/";
}

export function isRouteActive(pathname: string, href: string): boolean {
  const current = normalizePathname(pathname);
  const target = normalizePathname(href);
  return target === "/" ? current === "/" : current === target || current.startsWith(`${target}/`);
}

export function getBreadcrumbs(pathname: string): readonly BreadcrumbItem[] {
  const current = normalizePathname(pathname);
  if (current === "/") return [{ label: "Acasă" }];
  const home = { label: "Acasă", href: "/" };
  const exact = shellNavigation.find((item) => item.href === current);
  if (exact) return [home, { label: exact.label }];
  const authLabels: Readonly<Record<string, string>> = {
    "/register": "Creează cont",
    "/forgot-password": "Recuperează parola",
    "/auth/confirm": "Confirmă e-mailul",
    "/auth/resend": "Retrimite confirmarea",
    "/auth/reset-password": "Parolă nouă",
    "/auth/mfa": "Autentificare în doi pași",
  };
  if (authLabels[current]) return [home, { label: authLabels[current] }];
  const parts = current.split("/");
  const id = parts[2];
  if (
    parts.length === 3 &&
    parts[1] === "recipes" &&
    id &&
    id.length <= RECIPE_ROUTE_ID_MAX_LENGTH &&
    RECIPE_ROUTE_ID_PATTERN.test(id)
  ) {
    return [home, { label: "Rețete", href: "/recipes" }, { label: "Detalii rețetă" }];
  }
  return [home, { label: "Pagina nu a fost găsită" }];
}
