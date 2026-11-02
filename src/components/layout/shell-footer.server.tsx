import "server-only";

import Link from "next/link";

export function ShellFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-8">
        <p>Cookly · Idei pentru mesele de zi cu zi.</p>
        <Link
          href="/recipes"
          className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Descoperă rețetele
        </Link>
      </div>
    </footer>
  );
}
