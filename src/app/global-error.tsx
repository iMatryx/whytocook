"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ro">
      <body>
        <main>
          <h1>Cookly nu s-a putut încărca</h1>
          <p role="alert">A apărut o problemă. Te rugăm să încerci din nou.</p>
          <button type="button" onClick={reset}>Reîncearcă</button>
        </main>
      </body>
    </html>
  );
}
