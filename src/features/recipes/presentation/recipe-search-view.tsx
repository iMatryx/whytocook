"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { localCalendarDay } from "@/shared/domain/expiry";
import { parseRecipeQuery, recipeQueryString } from "../contracts/search-query";
import type { RecipeFilters, RecipeSearchRequest } from "../contracts/search.schema";
import { useRecipeSearch } from "./use-recipe-search";
import { RecipeFiltersForm } from "./recipe-filters";
import { RecipeResults } from "./recipe-results";
export function RecipeSearchView({
  inventory,
  accountId,
  inventoryStatus,
  inventoryError,
  onRetryInventory,
}: {
  inventory: RecipeSearchRequest["inventory"];
  accountId: string | null;
  inventoryStatus: "loading" | "ready" | "error";
  inventoryError: string | null;
  onRetryInventory: () => void;
}) {
  const params = useSearchParams(),
    router = useRouter(),
    query = params.toString();
  const parsed = useMemo(() => parseRecipeQuery(new URLSearchParams(query)), [query]);
  const filters = parsed.success ? parsed.data : null;
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const update = () => setToday(localCalendarDay());
    const timer = setTimeout(update, 0),
      interval = setInterval(update, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  const search = useRecipeSearch(filters, inventory, accountId, inventoryStatus === "ready", today);
  const data = search.data;
  useEffect(() => {
    if (data && filters && data.page !== filters.page)
      router.replace(`/recipes?${recipeQueryString({ ...filters, page: data.page })}`, {
        scroll: false,
      });
  }, [data, filters, router]);
  const reset = () =>
    router.push(params.get("source") === "demo" ? "/recipes?source=demo" : "/recipes", {
      scroll: false,
    });
  const apply = (next: RecipeFilters) =>
    router.push(`/recipes?${recipeQueryString({ ...next, page: 1 })}`, { scroll: false });
  const href = (page: number) => `/recipes?${recipeQueryString({ ...filters!, page })}`;
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Rețete pentru ce ai acasă</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Caută un preparat, alege ce contează pentru tine și verifică ingredientele din frigider.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/my-fridge">Deschide frigiderul</Link>
        </Button>
      </header>
      {!parsed.success ? (
        <ErrorState
          title="Filtrele din adresă nu sunt valide"
          description={parsed.message}
          onRetry={reset}
          retryLabel="Resetează filtrele"
        />
      ) : (
        <>
          {filters?.source === "demo" && (
            <p
              className="rounded-xl bg-warning px-5 py-4 text-sm text-warning-foreground"
              role="note"
            >
              Colecție demonstrativă: 72 de propuneri netestate practic. Costurile și nutriția nu
              sunt verificate. Nu sunt rețete publicate.
            </p>
          )}
          <div className="grid items-start gap-8 lg:grid-cols-[19rem_minmax(0,1fr)]">
            <aside className="min-w-0 rounded-2xl border border-border bg-card p-5">
              <details open className="group">
                <summary className="mb-5 cursor-pointer rounded-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Căutare și filtre
                </summary>
                <RecipeFiltersForm
                  key={query}
                  filters={filters!}
                  facets={search.facets}
                  onApply={apply}
                  onReset={reset}
                />
              </details>
            </aside>
            <section
              className="min-w-0 space-y-5"
              aria-label="Rezultate rețete"
              aria-busy={
                inventoryStatus === "loading" ||
                (inventoryStatus === "ready" && search.status === "loading")
              }
            >
              {inventoryStatus === "error" ? (
                <ErrorState
                  title="Inventarul nu poate fi încărcat"
                  description={
                    inventoryError ?? "Reîncarcă inventarul pentru compatibilitate corectă."
                  }
                  onRetry={onRetryInventory}
                />
              ) : search.status === "error" ? (
                <>
                  <ErrorState
                    title="Rețetele nu pot fi încărcate"
                    description={search.error ?? "Reîncearcă."}
                    onRetry={search.reload}
                  />
                  {filters?.source !== "demo" && (
                    <Button asChild variant="outline">
                      <Link href="/recipes?source=demo">Explorează exemplele demonstrative</Link>
                    </Button>
                  )}
                </>
              ) : !data ? (
                <div
                  role="status"
                  aria-label="Se încarcă rețetele"
                  className="grid gap-5 xl:grid-cols-2"
                >
                  <span className="sr-only">Se încarcă rețetele și compatibilitatea.</span>
                  {[0, 1, 2, 3].map((n) => (
                    <Skeleton key={n} className="h-72 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p role="status" aria-live="polite" className="text-sm font-medium">
                      {data.total} rețete găsite
                      {data.pages ? ` · Pagina ${data.page} din ${data.pages}` : ""}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Inventar {accountId ? "din cont" : "local"} · {inventory.length} loturi
                    </span>
                  </div>
                  {data.excludedCount > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {data.excludedCount} rețete excluse pentru alergii sau informații neverificate
                      despre alergeni.
                    </p>
                  )}
                  {!data.total ? (
                    <EmptyState
                      title="Nicio rețetă pentru aceste filtre"
                      description={
                        filters?.source === "published"
                          ? "Catalogul publicat poate fi gol. Încearcă mai puține filtre sau explorează colecția demonstrativă."
                          : "Încearcă mai puține filtre. Valorile necunoscute nu trec filtrele de buget sau nutriție."
                      }
                      action={
                        <div className="flex flex-wrap justify-center gap-3">
                          <Button onClick={reset}>Resetează filtrele</Button>
                          {filters?.source !== "demo" && (
                            <Button asChild variant="outline">
                              <Link href="/recipes?source=demo">Explorează exemplele</Link>
                            </Button>
                          )}
                        </div>
                      }
                    />
                  ) : (
                    <RecipeResults
                      key={`${query}:${accountId}:${JSON.stringify(inventory)}`}
                      data={data}
                      query={filters!}
                    />
                  )}
                  {data.pages > 1 && (
                    <nav
                      aria-label="Paginare rețete"
                      className="flex flex-wrap items-center gap-2 border-t border-border pt-5"
                    >
                      {data.page > 1 && (
                        <Button asChild variant="outline">
                          <Link href={href(data.page - 1)} scroll={false}>
                            Pagina anterioară
                          </Link>
                        </Button>
                      )}
                      {Array.from(
                        new Set([
                          1,
                          Math.max(1, data.page - 1),
                          data.page,
                          Math.min(data.pages, data.page + 1),
                          data.pages,
                        ]),
                      )
                        .sort((a, b) => a - b)
                        .map((page) => (
                          <Button
                            key={page}
                            asChild
                            variant={page === data.page ? "default" : "outline"}
                          >
                            <Link
                              href={href(page)}
                              scroll={false}
                              aria-label={`Pagina ${page}`}
                              aria-current={page === data.page ? "page" : undefined}
                            >
                              {page}
                            </Link>
                          </Button>
                        ))}
                      {data.page < data.pages && (
                        <Button asChild variant="outline">
                          <Link href={href(data.page + 1)} scroll={false}>
                            Pagina următoare
                          </Link>
                        </Button>
                      )}
                    </nav>
                  )}
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
