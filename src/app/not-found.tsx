import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-5 px-6">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">Pagina nu a fost găsită</h1>
      <p className="text-muted-foreground">Adresa poate fi incompletă sau pagina nu mai există.</p>
      <Button asChild><Link href="/">Înapoi la început</Link></Button>
    </main>
  );
}
