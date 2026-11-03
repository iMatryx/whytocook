"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { expiryStatus, localCalendarDay } from "@/shared/domain/expiry";
import type { PantryItem } from "../contracts";
import { usePantry } from "./use-pantry";
import { filterPantry } from "./pantry-model";
import type { PantryFilters } from "./pantry-model";
import { PantryForm, locations, selectClass } from "./pantry-form";
import { ConsumptionForm } from "./consumption-form";
type DialogIntent =
  | { kind: "edit"; id: string; item: PantryItem | null }
  | { kind: "delete"; item: PantryItem }
  | { kind: "consume" };
type OpenDialog = DialogIntent & { scope: string };
const expiryLabels = {
  unknown: "Dată nespecificată",
  expired: "Data expirării a trecut",
  today: "Expiră astăzi",
  soon: "Expiră în curând",
  fresh: "Termen ulterior",
} as const;
export function PantryView() {
  const pantry = usePantry();
  const [today, setToday] = useState<string | null>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [filters, setFilters] = useState<PantryFilters>({
    query: "",
    categoryId: "",
    location: "",
    expiry: "",
    sort: "expiry",
  });
  useEffect(() => {
    const update = () => setToday(localCalendarDay());
    const timer = setTimeout(update, 0);
    const interval = setInterval(update, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, []);
  const visible = today ? filterPantry(pantry.items, filters, today) : [];
  const categories = [
    ...new Map(
      pantry.items
        .filter((item) => item.ingredient.categoryId)
        .map((item) => [
          item.ingredient.categoryId!,
          item.ingredient.categoryName ?? "Fără categorie",
        ]),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "ro"));
  const ready = pantry.status === "ready" && today !== null;
  const scope = pantry.accountId ?? "guest";
  function open(next: DialogIntent, button: HTMLElement) {
    opener.current = button;
    setActionError(null);
    setDialog({ ...next, scope });
  }
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Frigiderul meu</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Ce ai la îndemână, cât a rămas și ce expiră curând.
          </p>
          {ready && (
            <Badge className="mt-3" tone={pantry.mode === "guest" ? "neutral" : "success"}>
              {pantry.saving
                ? "Se salvează…"
                : pantry.mode === "guest"
                  ? "Salvat în acest browser"
                  : "Sincronizat cu contul"}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!ready || pantry.saving || !pantry.items.length}
            onClick={(event) => open({ kind: "consume" }, event.currentTarget)}
          >
            Am gătit
          </Button>
          <Button
            disabled={!ready || pantry.saving || pantry.items.length >= 500}
            onClick={(event) =>
              open({ kind: "edit", id: crypto.randomUUID(), item: null }, event.currentTarget)
            }
          >
            Adaugă ingredient
          </Button>
        </div>
      </header>
      {pantry.mode === "guest" && (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Inventarul de invitat rămâne pe acest dispozitiv.{" "}
          <Link href="/login?next=%2Fmy-fridge" className="font-medium text-foreground underline">
            Autentifică-te
          </Link>{" "}
          pentru inventarul contului, sincronizat între dispozitive. Cele două inventare sunt
          separate.
        </p>
      )}
      {pantry.status === "error" ? (
        <ErrorState
          title="Inventarul nu poate fi încărcat"
          description={pantry.error ?? "Reîncearcă."}
          onRetry={() => void pantry.reload()}
        />
      ) : !ready ? (
        <div role="status" aria-label="Se încarcă inventarul" className="space-y-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : (
        <>
          {pantry.items.length > 0 && (
            <fieldset className="grid items-end gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
              <legend className="sr-only">Filtrează inventarul</legend>
              <TextField
                label="Caută în inventar"
                value={filters.query}
                onChange={(event) => setFilters((old) => ({ ...old, query: event.target.value }))}
                maxLength={120}
              />
              <label className="space-y-2 text-sm">
                <span className="block">Categorie</span>
                <select
                  className={selectClass}
                  value={filters.categoryId}
                  onChange={(event) =>
                    setFilters((old) => ({ ...old, categoryId: event.target.value }))
                  }
                >
                  <option value="">Toate categoriile</option>
                  {categories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="block">Depozitare</span>
                <select
                  className={selectClass}
                  value={filters.location}
                  onChange={(event) =>
                    setFilters((old) => ({ ...old, location: event.target.value }))
                  }
                >
                  <option value="">Toate locurile</option>
                  {Object.entries(locations).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="block">Starea lotului</span>
                <select
                  className={selectClass}
                  value={filters.expiry}
                  onChange={(event) =>
                    setFilters((old) => ({ ...old, expiry: event.target.value }))
                  }
                >
                  <option value="">Toate loturile</option>
                  <option value="expired">Data expirării trecută</option>
                  <option value="today">Expiră astăzi</option>
                  <option value="soon">Astăzi și următoarele 3 zile</option>
                  <option value="unknown">Fără dată</option>
                  <option value="empty">Cantitate zero</option>
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="block">Sortează după</span>
                <select
                  className={selectClass}
                  value={filters.sort}
                  onChange={(event) =>
                    setFilters((old) => ({
                      ...old,
                      sort: event.target.value as PantryFilters["sort"],
                    }))
                  }
                >
                  <option value="expiry">Expirare</option>
                  <option value="name">Nume</option>
                  <option value="newest">Adăugate recent</option>
                </select>
              </label>
              <Button
                variant="ghost"
                onClick={() =>
                  setFilters({
                    query: "",
                    categoryId: "",
                    location: "",
                    expiry: "",
                    sort: "expiry",
                  })
                }
              >
                Resetează filtrele
              </Button>
            </fieldset>
          )}
          {!pantry.items.length ? (
            <EmptyState
              title="Frigiderul tău începe aici"
              description="Adaugă primul ingredient, cantitatea și data expirării. Fiecare lot poate avea propriul termen."
            />
          ) : !visible.length ? (
            <EmptyState
              title="Niciun lot pentru aceste filtre"
              description="Schimbă termenul căutat sau resetează filtrele. Ingredientele sunt păstrate în inventar."
            />
          ) : (
            <section aria-labelledby="pantry-results">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="pantry-results" className="font-semibold">
                  {visible.length} din {pantry.items.length} loturi
                </h2>
                <Button
                  variant="ghost"
                  disabled={pantry.saving}
                  onClick={() => void pantry.reload()}
                >
                  Reîncarcă inventarul
                </Button>
              </div>
              <ul
                aria-label="Loturi din inventar"
                className="divide-y divide-border border-y border-border"
              >
                {visible.map((item) => {
                  const status = expiryStatus(item.expiresOn, today!);
                  return (
                    <li key={item.id} className="grid gap-4 py-5 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold">
                          {item.ingredient.name}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.ingredient.categoryName ?? "Fără categorie"} ·{" "}
                          {locations[item.location]} · lot {item.id.slice(-6)}
                        </p>
                        <p className="mt-3 font-medium">
                          {item.quantity === null
                            ? "Cantitate necunoscută"
                            : `${item.quantity.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "")} ${item.unitCode === "piece" ? "bucăți" : item.unitCode}`}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Badge
                            tone={
                              status === "expired"
                                ? "danger"
                                : ["today", "soon"].includes(status)
                                  ? "warning"
                                  : "neutral"
                            }
                          >
                            {expiryLabels[status]}
                          </Badge>
                          {item.expiresOn && (
                            <time
                              className="text-sm text-muted-foreground"
                              dateTime={item.expiresOn}
                            >
                              {item.expiresOn}
                            </time>
                          )}
                          {!item.ingredient.active && <Badge>Ingredient retras din catalog</Badge>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        <Button
                          variant="outline"
                          disabled={pantry.saving}
                          onClick={(event) =>
                            open({ kind: "edit", id: item.id, item }, event.currentTarget)
                          }
                          aria-label={`Editează ${item.ingredient.name}, lot ${item.id.slice(-6)}`}
                        >
                          Editează
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={pantry.saving}
                          onClick={(event) => open({ kind: "delete", item }, event.currentTarget)}
                          aria-label={`Elimină ${item.ingredient.name}, lot ${item.id.slice(-6)}`}
                        >
                          Elimină
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !pantry.saving) setDialog(null);
        }}
      >
        <DialogContent
          title={
            dialog?.kind === "edit"
              ? dialog.item
                ? "Editează lotul"
                : "Adaugă un ingredient"
              : dialog?.kind === "delete"
                ? "Elimină lotul"
                : "Am gătit"
          }
          description={
            dialog?.kind === "consume"
              ? "Înregistrează consumul real și confirmă cantitățile rămase."
              : dialog?.kind === "delete"
                ? "Eliminarea afectează numai lotul selectat."
                : "Alege ingredientul exact și datele acestui lot."
          }
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            opener.current?.focus();
          }}
        >
          {dialog && dialog.scope !== scope ? (
            <p role="alert">
              Contul s-a schimbat. Închide formularul și verifică inventarul noului cont.
            </p>
          ) : (
            <div hidden={!ready}>
              {dialog?.kind === "edit" && (
                <PantryForm
                  key={dialog.id}
                  id={dialog.id}
                  item={dialog.item}
                  pending={pantry.saving || !ready}
                  onSave={(command, ingredient) => pantry.save(command, ingredient, dialog.scope)}
                  onCancel={() => setDialog(null)}
                />
              )}
              {dialog?.kind === "consume" && (
                <ConsumptionForm
                  items={pantry.items}
                  today={today ?? localCalendarDay()}
                  pending={pantry.saving || !ready}
                  onSave={(command) => pantry.save(command, null, dialog.scope)}
                  onCancel={() => setDialog(null)}
                />
              )}
              {dialog?.kind === "delete" && (
                <div className="space-y-5">
                  <p>
                    Elimini <strong>{dialog.item.ingredient.name}</strong>, lot{" "}
                    {dialog.item.id.slice(-6)}?
                  </p>
                  {actionError && (
                    <p role="alert" className="text-sm text-danger-foreground">
                      {actionError}
                    </p>
                  )}
                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      variant="outline"
                      disabled={pantry.saving}
                      onClick={() => setDialog(null)}
                    >
                      Anulează
                    </Button>
                    <Button
                      variant="destructive"
                      loading={pantry.saving}
                      onClick={() => {
                        void (async () => {
                          const message = await pantry.save(
                            {
                              kind: "delete",
                              id: dialog.item.id,
                              expectedRevision: dialog.item.revision,
                            },
                            null,
                            dialog.scope,
                          );
                          if (message) setActionError(message);
                          else setDialog(null);
                        })();
                      }}
                    >
                      Confirmă eliminarea
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {dialog && !ready && (
            <Skeleton className="h-40 rounded-lg" aria-label="Se verifică sesiunea" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
