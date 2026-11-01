export default function Loading() {
  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-6 py-20" role="status" aria-label="Se încarcă pagina">
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="h-16 max-w-xl rounded bg-muted" />
        <div className="h-8 max-w-md rounded bg-muted" />
      </div>
      <span className="sr-only">Se încarcă pagina…</span>
    </main>
  );
}
