"use client";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto flex min-h-svh max-w-xl flex-col items-start justify-center gap-5 px-6">
      <h1 className="text-3xl font-semibold">Pagina nu s-a putut încărca</h1>
      <p role="alert" className="text-muted-foreground">A apărut o problemă temporară. Încearcă din nou.</p>
      <Button onClick={reset}>Reîncearcă</Button>
    </main>
  );
}
