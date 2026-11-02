import "server-only";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <section className="py-10">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="mt-4 font-display text-4xl">Pagina nu a fost găsită</h1>
      <p className="mt-4 max-w-lg text-muted-foreground">
        Verifică adresa sau revino la început pentru a continua.
      </p>
      <Button asChild className="mt-6">
        <Link href="/">Înapoi la început</Link>
      </Button>
    </section>
  );
}
