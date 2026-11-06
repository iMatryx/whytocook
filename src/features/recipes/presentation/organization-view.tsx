"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import type { OrganizationCommand, OrganizationSnapshot } from "../contracts/organization.schema";
import { useOrganization } from "./use-organization";
function RecipeLink({ recipeKey, data }: { recipeKey: string; data: OrganizationSnapshot }) {
  const [source, slug] = recipeKey.split(":");
  const title = data.titles[recipeKey] ?? slug!.replaceAll("-", " ");
  const unavailable = Object.hasOwn(data.titles, recipeKey) && data.titles[recipeKey] === null;
  return unavailable ? (
    <span className="min-w-0 break-words text-muted-foreground">{title} — indisponibilă</span>
  ) : (
    <Link
      className="min-w-0 break-words font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
      href={`/recipes/${slug}?source=${source}`}
    >
      {title}
    </Link>
  );
}
type Collection = OrganizationSnapshot["collections"][number];
type Run = (command: OrganizationCommand) => Promise<boolean>;
function CollectionCard({
  collection,
  data,
  busy,
  run,
}: {
  collection: Collection;
  data: OrganizationSnapshot;
  busy: boolean;
  run: Run;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <article className="min-w-0 rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="min-w-0 flex-1 break-words text-lg font-semibold">{collection.name}</h3>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => setEditing(!editing)}
          aria-label={`Redenumește ${collection.name}`}
        >
          Redenumește
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              disabled={busy}
              aria-label={`Șterge colecția ${collection.name}`}
            >
              Șterge
            </Button>
          </DialogTrigger>
          <DialogContent
            title="Ștergi colecția?"
            description="Rețetele favorite și istoricul sunt păstrate."
          >
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => void run({ kind: "deleteCollection", id: collection.id })}
            >
              Confirmă ștergerea colecției
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      {editing && (
        <form
          className="mt-4 flex flex-wrap gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name"));
            if (await run({ kind: "saveCollection", id: collection.id, name, create: false }))
              setEditing(false);
          }}
        >
          <label className="min-w-0 flex-1">
            Nume nou
            <Input name="name" defaultValue={collection.name} required maxLength={80} />
          </label>
          <Button type="submit" disabled={busy}>
            Salvează numele
          </Button>
        </form>
      )}
      {!collection.recipeKeys.length ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Colecția este goală. Adaugă rețete din favorite sau din istoric.
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {collection.recipeKeys.map((key) => (
            <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <RecipeLink recipeKey={key} data={data} />
              <Button
                variant="outline"
                disabled={busy}
                aria-label={`Elimină din ${collection.name}`}
                onClick={() =>
                  void run({
                    kind: "membership",
                    id: collection.id,
                    recipeKey: key,
                    enabled: false,
                  })
                }
              >
                Elimină
              </Button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
function CollectionChoices({
  recipeKey,
  data,
  busy,
  run,
}: {
  recipeKey: string;
  data: OrganizationSnapshot;
  busy: boolean;
  run: Run;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {data.collections.map((c) => (
        <Button
          key={c.id}
          className="h-auto min-h-9 max-w-full whitespace-normal break-all text-left"
          size="sm"
          variant="outline"
          disabled={busy}
          aria-pressed={c.recipeKeys.includes(recipeKey)}
          onClick={() =>
            void run({
              kind: "membership",
              id: c.id,
              recipeKey,
              enabled: !c.recipeKeys.includes(recipeKey),
            })
          }
        >
          {c.recipeKeys.includes(recipeKey) ? `Elimină din ${c.name}` : `Adaugă în ${c.name}`}
        </Button>
      ))}
    </div>
  );
}
export function OrganizationView() {
  const { data, busy, error, reload, run } = useOrganization();
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-primary">Bucătăria ta, organizată</p>
        <h1 className="font-display text-3xl sm:text-4xl">Favorite, colecții și istoric</h1>
        <p className="text-muted-foreground">
          Păstrează ideile preferate și revino la ce ai gătit.
        </p>
        <Button asChild variant="outline">
          <Link href="/recipes">Descoperă rețete</Link>
        </Button>
      </header>
      {error && (
        <ErrorState
          title="Organizarea rețetelor nu este disponibilă"
          description={error}
          onRetry={() => void reload()}
        />
      )}
      {!data && !error && <p role="status">Se încarcă rețetele salvate…</p>}
      {data && (
        <OrganizationContent key={data.accountId ?? "guest"} data={data} busy={busy} run={run} />
      )}
    </div>
  );
}
function OrganizationContent({
  data,
  busy,
  run,
}: {
  data: OrganizationSnapshot;
  busy: boolean;
  run: Run;
}) {
  const [confirmClear, setConfirmClear] = useState(false),
    [name, setName] = useState("");
  return (
    <>
      <p role="status" className="rounded-lg bg-muted p-4 text-sm">
        {busy
          ? "Se salvează…"
          : data.accountId
            ? "Salvat în contul tău. Rețetele demo folosesc doar memoria paginii și nu apar aici."
            : "Salvat în acest browser pentru invitați. Datele nu sunt importate automat în cont."}
      </p>
      <section aria-labelledby="favorite-heading" className="space-y-4">
        <h2 id="favorite-heading" className="text-2xl font-semibold">
          Rețete favorite
        </h2>
        {!data.favorites.length ? (
          <EmptyState
            compact
            icon="heart"
            title="Nu ai rețete favorite"
            description="Deschide o rețetă și apasă Adaugă la favorite."
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.favorites.map((key) => (
              <li key={key} className="min-w-0 space-y-4 rounded-xl border bg-card p-4">
                <RecipeLink recipeKey={key} data={data} />
                <div>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void run({ kind: "favorite", recipeKey: key, enabled: false })}
                  >
                    Elimină din favorite
                  </Button>
                </div>
                <CollectionChoices recipeKey={key} data={data} busy={busy} run={run} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="collections-heading" className="space-y-4">
        <h2 id="collections-heading" className="text-2xl font-semibold">
          Colecții personalizate
        </h2>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run({ kind: "saveCollection", id: crypto.randomUUID(), name, create: true }))
              setName("");
          }}
        >
          <label htmlFor="collection-name" className="min-w-0 flex-1 space-y-2">
            <span>Numele colecției</span>
            <Input
              id="collection-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fitness sau Rapid"
              required
              maxLength={80}
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy || data.collections.length >= 50 || !name.trim()}>
            Creează colecția
          </Button>
        </form>
        <p className="text-sm text-muted-foreground">
          Până la 50 de colecții, fiecare cu maximum 500 de rețete. Eliminarea din favorite
          păstrează rețeta în colecții.
        </p>
        {!data.collections.length ? (
          <EmptyState
            compact
            title="Nu ai colecții"
            description="Creează prima colecție, apoi adaugă rețete din favorite sau istoric."
          />
        ) : (
          data.collections.map((c) => (
            <CollectionCard key={c.id} collection={c} data={data} busy={busy} run={run} />
          ))
        )}
      </section>
      <section aria-labelledby="history-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="history-heading" className="text-2xl font-semibold">
            Istoric de preparări
          </h2>
          <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
            <DialogTrigger asChild>
              <Button variant="outline" disabled={busy || !data.cooked.length}>
                Șterge istoricul
              </Button>
            </DialogTrigger>
            <DialogContent
              title="Ștergi tot istoricul?"
              description="Toate preparările vor fi eliminate din istoric. Favoritele, colecțiile și cumpărăturile sunt păstrate."
              footer={
                <Button variant="outline" onClick={() => setConfirmClear(false)}>
                  Anulează
                </Button>
              }
            >
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  if (await run({ kind: "clearHistory" })) setConfirmClear(false);
                }}
              >
                Confirmă ștergerea istoricului
              </Button>
            </DialogContent>
          </Dialog>
        </div>
        <p className="text-sm text-muted-foreground">
          Ultimele 100 de preparări confirmate prin „Am gătit”. Aceeași rețetă poate fi preparată de
          mai multe ori.
        </p>
        {!data.cooked.length ? (
          <EmptyState
            compact
            title="Nu ai preparări înregistrate"
            description="După ce prepari o rețetă, confirmă Am gătit în pagina ei."
          />
        ) : (
          <ol className="space-y-3">
            {data.cooked.map((entry, i) => (
              <li
                key={`${entry.recipeKey}:${entry.at}:${i}`}
                className="space-y-3 rounded-xl border bg-card p-4"
              >
                <RecipeLink recipeKey={entry.recipeKey} data={data} />
                <p className="text-sm text-muted-foreground">
                  <time dateTime={entry.at}>
                    {new Intl.DateTimeFormat("ro-RO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.at))}
                  </time>{" "}
                  · {entry.servings} porții
                </p>
                <CollectionChoices recipeKey={entry.recipeKey} data={data} busy={busy} run={run} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
