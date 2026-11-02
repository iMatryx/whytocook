import "server-only";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { currentSession } from "@/server/auth/session.server";
import { signOutAction } from "@/server/actions/auth-actions.server";

import { ThemeControl } from "@/components/theme/theme-control";
import { shellNavigation } from "@/config/navigation";

import { MobileNavigation } from "./mobile-navigation";
import { ShellNavigationLinks } from "./shell-navigation-links";

export async function ShellHeader() {
  let signedIn = false;
  try {
    signedIn = Boolean(await currentSession());
  } catch {
    /* Public navigation remains available when Auth is unconfigured. */
  }
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <Link
          href="/"
          aria-label="Cookly — pagina principală"
          className="rounded-sm text-2xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cookly<span className="text-primary">.</span>
        </Link>
        <div className="flex items-center gap-3 sm:gap-5">
          <nav aria-label="Navigare cont" className="hidden lg:block">
            <ShellNavigationLinks
              items={shellNavigation.filter(
                (item) => item.group === "account" && (!signedIn || item.href !== "/login"),
              )}
              horizontal
            />
          </nav>
          {signedIn && (
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Ieși din cont
              </Button>
            </form>
          )}
          <ThemeControl />
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
